#!/usr/bin/env bash
# MK-01 — preflight before replacing GTM placeholder PNGs with live Playwright captures.
#
# Usage (repo root):
#   ./scripts/gtm_live_capture_ready.sh
#   ./scripts/gtm_live_capture_ready.sh --run-capture   # exec gtm_capture_deck.sh when ready
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

RUN_CAPTURE=0
for arg in "$@"; do
  [[ "$arg" == "--run-capture" ]] && RUN_CAPTURE=1
done

echo "== Buyer demo + deck inventory (offline) =="
"${ROOT}/scripts/check_buyer_demo_matrix.sh"
"${PYTHON}" "${ROOT}/scripts/gen_gtm_deck_placeholder_pngs.py" --check
"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" --report

echo ""
echo "== Stack readiness (live capture) =="
"${ROOT}/scripts/check_gtm_capture_prereqs.sh" || {
  echo ""
  echo "Start stack:"
  echo "  ./scripts/start_services_dev.sh"
  echo "  cd api && alembic upgrade head && uvicorn api.app:app --host 127.0.0.1 --port 8000"
  echo "  cd ui && npm run dev   # or npm run build && npm run start"
  echo ""
  echo "Enable in api/.env: ENABLE_LOCAL_SCHEDULING, PAYMENTS, INTEGRATIONS, EHR, MESSAGING"
  exit 1
}

if [[ "$RUN_CAPTURE" == "1" ]]; then
  echo ""
  echo "== Live GTM capture =="
  exec "${ROOT}/scripts/gtm_capture_deck.sh"
fi

echo ""
echo "OK — stack ready. Run: ./scripts/gtm_capture_deck.sh"
echo "Or: ./scripts/gtm_buyer_demo_pack.sh --capture"
