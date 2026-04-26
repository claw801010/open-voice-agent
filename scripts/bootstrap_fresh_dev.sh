#!/usr/bin/env bash
# One-command bootstrap: submodule hint, venv, API + UI install, local Docker infra, migrations, Vitest.
# After it succeeds, start API and UI in two terminals (see end-of-script message).
# Usage: bash scripts/bootstrap_fresh_dev.sh
#   SKIP_SUBMODULE=1   — do not run git submodule update
#   SKIP_DOCKER=1      — do not start docker-compose-local (use if Postgres/Redis/Minio already up)
#   SKIP_UI_TEST=1     — skip Vitest
#   SKIP_PIP=1         — skip pip install (reuse existing venv packages)
#   VENV_DIR=...       — default: repo/venv
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
VENV_DIR="${VENV_DIR:-$REPO_ROOT/venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "One-command local dev bootstrap (see READMEBUILDME.md §4)."
  echo "Run from repository root: bash scripts/bootstrap_fresh_dev.sh"
  echo "Env: SKIP_SUBMODULE=1 SKIP_DOCKER=1 SKIP_UI_TEST=1 SKIP_PIP=1 VENV_DIR=..."
  exit 0
fi

for cmd in "$PYTHON_BIN" node npm; do
  command -v "$cmd" >/dev/null 2>&1 || die "Missing required command: $cmd"
done

# --- 1) Git submodule (pipecat) ---------------------------------------------
if [[ -z "${SKIP_SUBMODULE:-}" ]]; then
  if [[ -d "$REPO_ROOT/.git" ]]; then
    info "Updating git submodules (pipecat)…"
    git submodule update --init --recursive
  else
    info "No .git directory — skip submodule (archive checkout?)"
  fi
else
  info "SKIP_SUBMODULE=1 — not running git submodule update"
fi

# --- 2) Python venv + API requirements --------------------------------------
if [[ -z "${SKIP_PIP:-}" ]]; then
  if [[ ! -d "$VENV_DIR" ]]; then
    info "Creating venv at $VENV_DIR"
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  fi
  # shellcheck source=/dev/null
  source "$VENV_DIR/bin/activate"
  info "Installing / upgrading API dependencies (this may take a few minutes)…"
  pip install --upgrade pip
  pip install -r "$REPO_ROOT/api/requirements.txt"
else
  # shellcheck source=/dev/null
  [[ -f "$VENV_DIR/bin/activate" ]] && source "$VENV_DIR/bin/activate" || die "SKIP_PIP=1 but venv missing: $VENV_DIR"
  info "SKIP_PIP=1 — reusing existing venv"
fi

# For Pipecat voice pipelines, still run: bash scripts/setup_pipecat.sh
info "Note: for full voice/Pipecat, also run: bash scripts/setup_pipecat.sh (optional for HTTP tool UI + DB smoke)"

# --- 3) api/.env ------------------------------------------------------------
if [[ ! -f "$REPO_ROOT/api/.env" ]]; then
  if [[ -f "$REPO_ROOT/api/.env.example" ]]; then
    info "Creating api/.env from api/.env.example (edit secrets for production)"
    cp "$REPO_ROOT/api/.env.example" "$REPO_ROOT/api/.env"
  else
    die "api/.env missing and no api/.env.example to copy"
  fi
else
  info "api/.env already present"
fi

# --- 4) Local infra (Postgres, Redis, Minio) via compose -------------------
DOCKER_COMPOSE=(docker compose)
if ! "${DOCKER_COMPOSE[@]}" version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE=(docker-compose)
  else
    die "Docker Compose not found. Install Docker Desktop / compose plugin, or set SKIP_DOCKER=1 if services already run."
  fi
fi

if [[ -z "${SKIP_DOCKER:-}" ]]; then
  command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker or set SKIP_DOCKER=1"
  info "Starting docker-compose-local.yaml (Postgres:5433, Redis, Minio)…"
  "${DOCKER_COMPOSE[@]}" -f "$REPO_ROOT/docker-compose-local.yaml" up -d
  info "Waiting for Postgres to accept connections…"
  for _ in $(seq 1 60); do
    if "${DOCKER_COMPOSE[@]}" -f "$REPO_ROOT/docker-compose-local.yaml" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
      info "Postgres is ready."
      break
    fi
    sleep 1
  done
  if ! "${DOCKER_COMPOSE[@]}" -f "$REPO_ROOT/docker-compose-local.yaml" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    die "Postgres did not become ready in time. Check: docker compose -f docker-compose-local.yaml ps"
  fi
else
  info "SKIP_DOCKER=1 — not starting containers (ensure DATABASE_URL/REDIS in api/.env match your running services)"
fi

# --- 5) Migrations ----------------------------------------------------------
info "Running Alembic migrations…"
# migrate.sh must run from repo root, with venv (alembic) on PATH
export PYTHONPATH="$REPO_ROOT"
bash "$REPO_ROOT/scripts/migrate.sh"

# --- 6) UI: npm + tests ------------------------------------------------------
info "Installing UI dependencies (npm ci)…"
cd "$REPO_ROOT/ui"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
if [[ -z "${SKIP_UI_TEST:-}" ]]; then
  info "Running Vitest (npm test)…"
  npm test
else
  info "SKIP_UI_TEST=1 — skipping npm test"
fi

# --- 7) Done ----------------------------------------------------------------
cd "$REPO_ROOT"
info "Bootstrap finished successfully."
cat <<'EOF'

Next (two terminals, from repository root, with venv active):

  Terminal 1 — API
    source venv/bin/activate
    uvicorn api.app:app --reload --port 8000

  Terminal 2 — UI
    cd ui && npm run dev

Smoke:
  curl -sS http://127.0.0.1:8000/api/v1/health
  Open http://localhost:3000 and sign in; open an HTTP API tool: Test API Call + call context pickers.

If the OpenAPI spec changed, regenerate the client (API must be up):
  cd ui && npm run generate-client

EOF
