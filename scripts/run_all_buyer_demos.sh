#!/usr/bin/env bash
# MK-01 — validate or install all 10 catalog buyer-demo verticals.
#
# Default (dry run): matrix check + list slugs/scripts — no API calls.
# Install all:       BUYER_DEMO_INSTALL=1 E2E_EMAIL=… E2E_PASSWORD=… ./scripts/run_all_buyer_demos.sh
#
# Optional:
#   BUYER_DEMO_SEED_CALL=1  — pass through to each catalog-buyer-demo.sh
#   BUYER_DEMO_SKIP_CHECK=1 — skip ./scripts/check_buyer_demo_matrix.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${BUYER_DEMO_SKIP_CHECK:-}" != "1" ]]; then
  "${ROOT}/scripts/check_buyer_demo_matrix.sh"
fi

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

SLUGS="$("${PYTHON}" -c "
import json
from pathlib import Path
d = json.loads((Path('catalog') / 'buyer-demo-defaults.json').read_text(encoding='utf-8'))
for slug in sorted((d.get('defaults') or {}).keys()):
    print(slug)
")"

echo ""
echo "== Buyer demo verticals (default variant from buyer-demo-defaults.json) =="
while IFS= read -r slug; do
  [[ -n "$slug" ]] || continue
  variant="$("${PYTHON}" -c "
import json
from pathlib import Path
d = json.loads((Path('catalog') / 'buyer-demo-defaults.json').read_text(encoding='utf-8'))
print((d.get('defaults') or {})['${slug}'])
")"
  script="$("${PYTHON}" -c "
import json
from pathlib import Path
hints = json.loads((Path('catalog') / 'buyer-demo-hints.json').read_text(encoding='utf-8'))
v = hints.get('by_slug', {}).get('${slug}', {}).get('variants', {}).get('${variant}', {})
print(v.get('script') or '')
")"
  echo "  ${slug} → ${variant}  ${script:+(./scripts/${script})}"
done <<<"${SLUGS}"

if [[ "${BUYER_DEMO_INSTALL:-}" != "1" ]]; then
  echo ""
  echo "Dry run complete. To install all workflows:"
  echo "  export E2E_EMAIL=… E2E_PASSWORD=…"
  echo "  BUYER_DEMO_INSTALL=1 ./scripts/run_all_buyer_demos.sh"
  exit 0
fi

[[ -n "${E2E_EMAIL:-}" ]] || { echo "run_all_buyer_demos: set E2E_EMAIL" >&2; exit 1; }
[[ -n "${E2E_PASSWORD:-}" ]] || { echo "run_all_buyer_demos: set E2E_PASSWORD" >&2; exit 1; }

export E2E_BACKEND_URL="${E2E_BACKEND_URL:-http://127.0.0.1:8000}"
export UI_BASE_URL="${UI_BASE_URL:-http://127.0.0.1:3000}"
echo ""
echo "== Installing all buyer-demo workflows (API must be up) =="
while IFS= read -r slug; do
  [[ -n "$slug" ]] || continue
  echo ""
  echo "--- ${slug} ---"
  if [[ "${BUYER_DEMO_SEED_CALL:-}" == "1" ]]; then
    BUYER_DEMO_SEED_CALL=1 "${ROOT}/scripts/catalog-buyer-demo.sh" "${slug}"
  else
    "${ROOT}/scripts/catalog-buyer-demo.sh" "${slug}"
  fi
done <<<"${SLUGS}"

echo ""
echo "OK — installed ${SLUGS//$'\n'/ } workflows. Local smoke: ./scripts/gtm-local-all-in-one-demo.sh"
