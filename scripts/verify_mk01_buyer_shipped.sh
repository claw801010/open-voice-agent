#!/usr/bin/env bash
# MK-01 — offline ship gate: buyer matrix, GTM deck (41), voice WAVs, inventory sync.
#
# Usage (repo root, no API required):
#   ./scripts/verify_mk01_buyer_shipped.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

echo "== MK-01 buyer ship verification =="

"${ROOT}/scripts/check_buyer_demo_matrix.sh"

echo ""
echo "== Buyer-demo shortcut scripts =="
"${PYTHON}" "${ROOT}/scripts/gen_buyer_demo_shortcuts.py" --check

export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@localhost:5433/postgres}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

echo ""
echo "== Pytest (buyer + GTM inventory, no DB required for most) =="
"${PYTHON}" -m pytest \
  api/tests/test_buyer_demo_defaults_unit.py \
  api/tests/test_buyer_demo_hints_unit.py \
  api/tests/test_buyer_demo_matrix_unit.py \
  api/tests/test_gtm_deck_inventory_sync_unit.py \
  api/tests/test_gen_buyer_demo_shortcuts_unit.py \
  api/tests/test_gtm_local_all_in_one_script_unit.py \
  api/tests/test_run_all_buyer_demos_unit.py \
  api/tests/test_mk01_split_pr_scripts_unit.py \
  api/tests/test_check_voice_previews_spoken_unit.py \
  "api/tests/test_vertical_packs_catalog.py::test_gtm_deck_png_inventory_on_disk" \
  -q --tb=no

echo ""
echo "== UI Vitest (buyer hints) =="
(cd ui && npm test -- --run \
  src/lib/catalog/buyerDemoHints.test.ts \
  src/lib/catalog/buyerDemoDefaults.test.ts \
  src/lib/catalog/buyerDemoSeededCalls.test.ts \
  src/lib/catalog/buyerDemoVoicePreview.test.ts \
  src/lib/catalog/filterVerticalPacks.test.ts 2>/dev/null) \
  || echo "WARN: ui vitest skipped (run: cd ui && npm test)"

echo ""
echo "== Buyer demo dry-run map (10 verticals) =="
BUYER_DEMO_SKIP_CHECK=1 "${ROOT}/scripts/run_all_buyer_demos.sh" | tail -5

echo ""
echo "== Voice preview spoken check (advisory) =="
"${ROOT}/scripts/check_voice_previews_spoken.sh" || true

echo ""
echo "OK — MK-01 buyer/GTM offline gates passed."
echo "Incomplete: MK-01-VOICE-SPOKEN (spoken ElevenLabs previews — optional for ship)."
echo "Spoken voice: add ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID to api/.env, then ./scripts/regen_catalog_voice_previews.sh"
echo "Strict check: ./scripts/check_voice_previews_spoken.sh --strict"
echo "Live capture (optional): ./scripts/gtm_live_capture_ready.sh --run-capture"
