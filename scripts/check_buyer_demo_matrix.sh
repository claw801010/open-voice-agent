#!/usr/bin/env bash
# MK-01 — validate buyer-demo matrix (defaults, hints, scripts, voice previews) without API.
#
# Usage (repo root):
#   ./scripts/check_buyer_demo_matrix.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

echo "== Buyer demo matrix (pytest, no DB) =="
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@localhost:5433/postgres}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
"${PYTHON}" -m pytest api/tests/test_buyer_demo_defaults_unit.py api/tests/test_buyer_demo_hints_unit.py api/tests/test_buyer_demo_matrix_unit.py -q --tb=no

echo ""
echo "== Catalog voice preview WAV inventory =="
"${PYTHON}" scripts/generate_catalog_voice_preview_audio.py --check

echo ""
echo "== Buyer-demo shortcut drift (gen_buyer_demo_shortcuts.py --check) =="
"${PYTHON}" "${ROOT}/scripts/gen_buyer_demo_shortcuts.py" --check

echo ""
echo "== Shortcut scripts (10 verticals) =="
for s in "${ROOT}"/scripts/buyer-demo-*.sh; do
  [[ -f "$s" ]] || continue
  echo "  scripts/$(basename "$s")"
done

echo ""
echo "== GTM deck PNG inventory (41 frames) =="
"${PYTHON}" "${ROOT}/scripts/gen_gtm_deck_placeholder_pngs.py" --check

echo ""
echo "== Voice preview report =="
"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" --report

echo ""
echo "OK — buyer demo matrix aligned (install shortcuts: ./scripts/catalog-buyer-demo.sh <slug>)"
echo "Live capture when API+UI up: ./scripts/gtm_live_capture_ready.sh --run-capture"
