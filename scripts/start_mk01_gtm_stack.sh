#!/usr/bin/env bash
# MK-01 — start Docker infra and print commands for API, UI, and GTM capture.
#
# Usage (repo root):
#   ./scripts/start_mk01_gtm_stack.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running. Start Docker Desktop, then re-run this script." >&2
  exit 1
fi

DOCKER_COMPOSE=(docker compose)
if ! "${DOCKER_COMPOSE[@]}" version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
fi
if [[ -x "${ROOT}/scripts/ensure_mk01_api_env.sh" ]]; then
  "${ROOT}/scripts/ensure_mk01_api_env.sh"
fi

"${DOCKER_COMPOSE[@]}" -f "${ROOT}/docker-compose-local.yaml" up -d postgres redis minio
for _ in $(seq 1 30); do
  if "${DOCKER_COMPOSE[@]}" -f "${ROOT}/docker-compose-local.yaml" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cat <<EOF

MK-01 stack — next steps:

  1. Migrate (once):
     cd api && alembic upgrade head

  2. API (enable local all-in-one in api/.env):
     source venv/bin/activate
     uvicorn api.app:app --reload --host 127.0.0.1 --port 8000

  3. UI (GTM / Playwright):
     ./scripts/start_ui_for_gtm.sh
     # or: cd ui && npm run build && ./scripts/start_ui_for_gtm.sh

  4. Offline verify (any time):
     ./scripts/verify_mk01_buyer_shipped.sh

  5. Live GTM deck capture:
     ./scripts/gtm_live_capture_ready.sh --run-capture

EOF
