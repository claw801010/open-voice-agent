#!/usr/bin/env bash
# MK-01 — one-command buyer/GTM prep (matrix check, local smoke, seed calls, capture hints).
#
# Usage (repo root):
#   ./scripts/gtm_buyer_demo_pack.sh              # checks only (no API)
#   ./scripts/gtm_buyer_demo_pack.sh --smoke-api  # + local all-in-one curl smoke
#   ./scripts/gtm_buyer_demo_pack.sh --seed-calls E2E_EMAIL=…  # + Postgres demo calls
#   ./scripts/gtm_buyer_demo_pack.sh --seed-workflows E2E_EMAIL=… E2E_PASSWORD=…
#   ./scripts/gtm_buyer_demo_pack.sh --capture    # full deck (API + UI + Playwright)
#   ./scripts/gtm_buyer_demo_pack.sh --verify     # full offline ship gate only
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

SMOKE_API=0
SEED_CALLS=0
SEED_WORKFLOWS=0
CAPTURE=0
VERIFY_ONLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --smoke-api) SMOKE_API=1; shift ;;
    --seed-calls) SEED_CALLS=1; shift ;;
    --seed-workflows) SEED_WORKFLOWS=1; shift ;;
    --capture) CAPTURE=1; SMOKE_API=1; SEED_CALLS=1; SEED_WORKFLOWS=1; shift ;;
    --verify) VERIFY_ONLY=1; shift ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

if [[ "$VERIFY_ONLY" == "1" ]]; then
  exec "${ROOT}/scripts/verify_mk01_buyer_shipped.sh"
fi

echo "== 1/4 Buyer demo matrix =="
"${ROOT}/scripts/check_buyer_demo_matrix.sh"

echo ""
echo "== 2/4 Buyer vertical map (dry run) =="
"${ROOT}/scripts/run_all_buyer_demos.sh"

if [[ "$SMOKE_API" == "1" ]]; then
  echo ""
  echo "== 3/4 Local all-in-one API smoke =="
  BASE="${E2E_BACKEND_URL:-http://127.0.0.1:8000}"
  "${ROOT}/scripts/gtm-local-all-in-one-demo.sh" "${BASE%/}/"
else
  echo ""
  echo "== 3/4 Local API smoke skipped (pass --smoke-api) =="
fi

STEP=4
if [[ "$SEED_WORKFLOWS" == "1" ]]; then
  echo ""
  echo "== ${STEP}/5 Seed all buyer-demo catalog workflows =="
  [[ -n "${E2E_EMAIL:-}" && -n "${E2E_PASSWORD:-}" ]] || {
    echo "Set E2E_EMAIL and E2E_PASSWORD for --seed-workflows" >&2
    exit 1
  }
  while IFS= read -r line; do
    [[ -n "$line" ]] && eval "$line"
  done < <("${PYTHON}" "${ROOT}/scripts/seed_gtm_all_buyer_workflows.py" "${E2E_EMAIL}" --export-lines)
  STEP=$((STEP + 1))
fi

if [[ "$SEED_CALLS" == "1" ]]; then
  echo ""
  echo "== ${STEP}/5 Seed all buyer-demo analytics calls =="
  [[ -n "${E2E_EMAIL:-}" ]] || { echo "Set E2E_EMAIL for --seed-calls" >&2; exit 1; }
  export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@localhost:5433/postgres}"
  while IFS= read -r line; do
    [[ -n "$line" ]] && eval "$line"
  done < <("${PYTHON}" "${ROOT}/scripts/seed_gtm_all_buyer_demo_calls.py" "${E2E_EMAIL}" --export-lines)
  echo "Seeded call env vars (use with Playwright gtm-deck / analytics E2E)."
else
  echo ""
  echo "== ${STEP}/5 Call seed skipped (pass --seed-calls with E2E_EMAIL) =="
fi

if [[ "$CAPTURE" == "1" ]]; then
  echo ""
  echo "== GTM deck capture =="
  exec "${ROOT}/scripts/gtm_capture_deck.sh"
fi

echo ""
echo "OK — next: ./scripts/gtm_capture_deck.sh (API+UI) or BUYER_DEMO_INSTALL=1 ./scripts/run_all_buyer_demos.sh"
echo "Incomplete: MK-01-SHIP-PR · MK-01-VOICE-SPOKEN (./scripts/check_voice_previews_spoken.sh)"
