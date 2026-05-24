#!/usr/bin/env bash
# READMEPLANTOEXECUTE / WE-01-VISUAL-DEPTH — optional one-shot E2E for authenticated Lighthouse.
#
# Does (when Docker is available):
#   1) docker compose -f docker-compose-local.yaml up -d (Postgres, Redis, MinIO, coturn)
#   2) Ensures api/.env exists (copies api/.env.example once if missing)
#   3) alembic upgrade head
#   4) Starts uvicorn (8000) and Next dev (3000) in the background
#   5) cd ui && npm run perf:lighthouse:auth:full (default) or auth:operator:full (--operator)
#
# Env:
#   LIGHTHOUSE_OSS_PASSWORD   required for auth:full (≥8 chars)
#   WE01_UI_PORT              Next dev port (default 3000)
#   WE01_SKIP_DOCKER=1        skip compose up (use existing Postgres+Redis + api/.env)
#   WE01_DOCKER_DOWN=1        run `docker compose … down` on exit (default: leave infra running)
#
# Usage (repo root):
#   chmod +x scripts/we01-lighthouse-auth-e2e.sh
#   LIGHTHOUSE_OSS_PASSWORD='your-long-pass!' ./scripts/we01-lighthouse-auth-e2e.sh
#   LIGHTHOUSE_OSS_PASSWORD='your-long-pass!' ./scripts/we01-lighthouse-auth-e2e.sh --operator
#   ./scripts/we01-lighthouse-auth-e2e.sh --help

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE=()
compose_init() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose -f "$ROOT/docker-compose-local.yaml")
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose -f "$ROOT/docker-compose-local.yaml")
  else
    COMPOSE=()
  fi
}

UVICORN_PID_FILE="${TMPDIR:-/tmp}/we01-lh-uvicorn.pid"
NEXT_PID_FILE="${TMPDIR:-/tmp}/we01-lh-next.pid"
PASS="${LIGHTHOUSE_OSS_PASSWORD:-}"
UI_PORT="${WE01_UI_PORT:-3000}"
UI_ORIGIN="http://127.0.0.1:${UI_PORT}"
# docker-compose-local publishes Postgres on host 5433 (see docker-compose-local.yaml)
POSTGRES_PORT="${WE01_POSTGRES_PORT:-5433}"
OPERATOR_MODE=0
if [[ "${1:-}" == "--operator" ]]; then
  OPERATOR_MODE=1
  shift
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
WE-01-VISUAL-DEPTH — one-shot authenticated Lighthouse (READMEPLANTOEXECUTE).

  LIGHTHOUSE_OSS_PASSWORD='min8chars!' ./scripts/we01-lighthouse-auth-e2e.sh
  LIGHTHOUSE_OSS_PASSWORD='min8chars!' ./scripts/we01-lighthouse-auth-e2e.sh --operator

  --operator   Run /overview + /reports (npm run perf:lighthouse:auth:operator:full)
               instead of default /usage + /workflow/catalog (auth:full).

Env:
  LIGHTHOUSE_OSS_PASSWORD   required (≥8 characters)
  WE01_UI_PORT              Next port (default 3000)
  WE01_SKIP_DOCKER=1        use existing Postgres/Redis (no compose up)
  WE01_DOCKER_DOWN=1        docker compose down on script exit
  WE01_POSTGRES_PORT        host Postgres port (default 5433; matches docker-compose-local)

Requires: Docker (compose v2 or docker-compose v1), Python + alembic + uvicorn
(api deps; prefer repo venv/), Node/npm in ui/.
See READMEBUILDME.md §4 and READMEPLANTOEXECUTE WE-01-VISUAL-DEPTH.
EOF
  exit 0
fi

if [[ -z "$PASS" || "${#PASS}" -lt 8 ]]; then
  echo "ERROR: Set LIGHTHOUSE_OSS_PASSWORD (at least 8 characters)." >&2
  exit 1
fi

cleanup() {
  if [[ -f "$NEXT_PID_FILE" ]]; then
    kill "$(cat "$NEXT_PID_FILE")" 2>/dev/null || true
    rm -f "$NEXT_PID_FILE"
  fi
  if [[ -f "$UVICORN_PID_FILE" ]]; then
    kill "$(cat "$UVICORN_PID_FILE")" 2>/dev/null || true
    rm -f "$UVICORN_PID_FILE"
  fi
  if [[ "${WE01_DOCKER_DOWN:-0}" == "1" && "${WE01_SKIP_DOCKER:-0}" != "1" ]] && docker info >/dev/null 2>&1 && [[ ${#COMPOSE[@]} -gt 0 ]]; then
    "${COMPOSE[@]}" down 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

compose_init
if [[ "${WE01_SKIP_DOCKER:-0}" != "1" ]]; then
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker is not running (start Docker Desktop / daemon), or set WE01_SKIP_DOCKER=1 with Postgres+Redis already up." >&2
    exit 1
  fi
  if [[ ${#COMPOSE[@]} -eq 0 ]]; then
    echo "ERROR: Need Docker Compose (try: docker compose version) or docker-compose (v1) on PATH." >&2
    exit 1
  fi
  "${COMPOSE[@]}" up -d
fi

wait_port() {
  local host="$1" port="$2" label="$3" max="${4:-90}"
  local i=0
  echo "==> Waiting for $label ($host:$port) ..."
  while (( i < max )); do
    if nc -z "$host" "$port" 2>/dev/null; then
      echo "==> $label ready (${i}s)"
      return 0
    fi
    sleep 1
    ((i += 1)) || true
  done
  echo "ERROR: $label not reachable on $host:$port after ${max}s" >&2
  return 1
}

if [[ ! -f "$ROOT/api/.env" ]]; then
  echo "==> Creating api/.env from api/.env.example (DATABASE_URL/REDIS_URL match docker-compose-local)"
  cp "$ROOT/api/.env.example" "$ROOT/api/.env"
fi

wait_port 127.0.0.1 "${POSTGRES_PORT}" "Postgres" 90
wait_port 127.0.0.1 6379 "Redis" 90

export PYTHONPATH="$ROOT"
set -a
# shellcheck disable=SC1090
source "$ROOT/api/.env"
set +a

PY="python3"
if [[ -x "$ROOT/venv/bin/python" ]]; then
  PY="$ROOT/venv/bin/python"
fi

echo "==> Verifying Python can import api.app ($PY)"
if ! (
  cd "$ROOT"
  export PYTHONPATH="$ROOT"
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/api/.env"
  set +a
  "$PY" -c "import api.app" 2>/dev/null
); then
  echo "ERROR: $PY cannot import api.app (missing deps?). Example: python3 -m venv venv && source venv/bin/activate && pip install -r api/requirements.txt" >&2
  exit 1
fi

ALEMBIC=("$PY" -m alembic -c api/alembic.ini upgrade head)
if command -v alembic >/dev/null 2>&1 && [[ "$PY" == "python3" ]]; then
  ALEMBIC=(alembic -c api/alembic.ini upgrade head)
fi

echo "==> alembic upgrade head"
( cd "$ROOT" && "${ALEMBIC[@]}" )

UV_CMD=("$PY" -m uvicorn api.app:app --host 127.0.0.1 --port 8000)
if command -v uvicorn >/dev/null 2>&1 && [[ "$PY" == "python3" ]]; then
  UV_CMD=(uvicorn api.app:app --host 127.0.0.1 --port 8000)
fi

echo "==> Starting API (8000) in background"
(
  cd "$ROOT"
  export PYTHONPATH="$ROOT"
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/api/.env"
  set +a
  exec "${UV_CMD[@]}"
) >"${TMPDIR:-/tmp}/we01-lh-api.log" 2>&1 &
echo $! >"$UVICORN_PID_FILE"
sleep 2

echo "==> Waiting for API http://127.0.0.1:8000/api/v1/health"
for i in {1..60}; do
  if curl -sf --max-time 3 "http://127.0.0.1:8000/api/v1/health" >/dev/null; then
    echo "==> API ready (${i}s)"
    break
  fi
  if (( i == 60 )); then
    echo "ERROR: API did not become healthy on :8000. Tail api log:" >&2
    tail -60 "${TMPDIR:-/tmp}/we01-lh-api.log" >&2 || true
    exit 1
  fi
  sleep 1
done

if [[ ! -d "$ROOT/ui/node_modules" ]]; then
  echo "==> ui/node_modules missing; running npm install in ui/"
  ( cd "$ROOT/ui" && npm install )
fi

echo "==> Starting Next (${UI_PORT}) in background"
(
  cd "$ROOT/ui"
  exec npm run dev -- --port "${UI_PORT}"
) >"${TMPDIR:-/tmp}/we01-lh-next.log" 2>&1 &
echo $! >"$NEXT_PID_FILE"

echo "==> Waiting for Next ${UI_ORIGIN}/api/v1/health (rewrite to API)"
for i in {1..120}; do
  if curl -sf --max-time 3 "${UI_ORIGIN}/api/v1/health" >/dev/null; then
    echo "==> Next+API ready (${i}s)"
    break
  fi
  if (( i == 120 )); then
    echo "ERROR: ${UI_ORIGIN}/api/v1/health did not become healthy. Logs:" >&2
    tail -40 "${TMPDIR:-/tmp}/we01-lh-api.log" >&2 || true
    tail -40 "${TMPDIR:-/tmp}/we01-lh-next.log" >&2 || true
    exit 1
  fi
  sleep 1
done

echo "==> Running authenticated Lighthouse ($([[ "$OPERATOR_MODE" == "1" ]] && echo 'auth:operator:full' || echo 'auth:full'))"
export LIGHTHOUSE_OSS_AUTO_SIGNUP=1
export LIGHTHOUSE_OSS_PASSWORD="$PASS"
export LIGHTHOUSE_UI_ORIGIN="$UI_ORIGIN"
export BASE_URL="$UI_ORIGIN"
(
  cd "$ROOT/ui"
  if [[ "$OPERATOR_MODE" == "1" ]]; then
    npm run perf:lighthouse:auth:operator:full
  else
    npm run perf:lighthouse:auth:full
  fi
)

echo ""
if [[ "$OPERATOR_MODE" == "1" ]]; then
  echo "==> Done. Paste the two WE-01-VISUAL-DEPTH summary lines into READMENEWRELEASES.md (Unreleased) and [x] READMEPLANTOEXECUTE operator-shell Lighthouse item."
else
  echo "==> Done. Paste the two WE-01-VISUAL-DEPTH summary lines into READMENEWRELEASES.md (Unreleased) and [x] READMEPLANTOEXECUTE optional Lighthouse (authenticated)."
fi
echo "    API log: ${TMPDIR:-/tmp}/we01-lh-api.log  Next log: ${TMPDIR:-/tmp}/we01-lh-next.log"
if [[ ${#COMPOSE[@]} -gt 0 ]]; then
  echo "    Docker infra keeps running; stop with: ${COMPOSE[*]} down"
else
  echo "    (Compose command not detected — stop Postgres/Redis the way you started them.)"
fi
echo "    Re-run with WE01_DOCKER_DOWN=1 to tear down compose on exit."
