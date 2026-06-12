#!/usr/bin/env bash
# MK-01 — high-value buyer path: install catalog variant → print workflow + analytics URLs.
#
# Usage (repo root, API + UI running):
#   export E2E_EMAIL='demo@example.com'
#   export E2E_PASSWORD='…'
#   ./scripts/catalog-buyer-demo.sh healthcare-clinic-screening
#   ./scripts/buyer-demo-retail-collections.sh
#   BUYER_DEMO_SEED_CALL=1 ./scripts/buyer-demo-telecom-outage.sh
#
# Defaults (catalog/buyer-demo-defaults.json):
#   healthcare → ehr_sync_complex · retail → collections_complex · telecom → outage_status_complex · …
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-${BUYER_DEMO_SLUG:-healthcare-clinic-screening}}"
VARIANT="${2:-${BUYER_DEMO_VARIANT:-}}"

export E2E_BACKEND_URL="${E2E_BACKEND_URL:-${BACKEND_API_ENDPOINT:-http://127.0.0.1:8000}}"
export UI_BASE_URL="${UI_BASE_URL:-http://127.0.0.1:3000}"

[[ -n "${E2E_EMAIL:-}" ]] || { echo "catalog-buyer-demo: set E2E_EMAIL" >&2; exit 1; }
[[ -n "${E2E_PASSWORD:-}" ]] || { echo "catalog-buyer-demo: set E2E_PASSWORD" >&2; exit 1; }

if [[ -n "${VARIANT}" ]]; then
  OUT="$(python3 "${ROOT}/scripts/seed_catalog_buyer_demo.py" "${SLUG}" "${VARIANT}")"
else
  OUT="$(python3 "${ROOT}/scripts/seed_catalog_buyer_demo.py" "${SLUG}")"
fi

RESOLVED_VARIANT="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["catalog_variant_id"])' <<<"${OUT}")"
SETTINGS_URL="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("settings_local_module_url") or "")' <<<"${OUT}")"

echo "== Catalog buyer demo: ${SLUG} (${RESOLVED_VARIANT}) =="
echo "API: ${E2E_BACKEND_URL}"
echo "UI:  ${UI_BASE_URL}"
echo ""
echo "${OUT}"

echo ""
echo "== Next steps (buyer / SE) =="
echo "1. Open workflow_editor_url — Wire local * buttons on the catalog guide card"
echo "2. Run Web test or LoopTalk persona from marketplace"
echo "3. Open analytics_calls_proof_url for HTTP mapped_data on call detail"
if [[ -n "${SETTINGS_URL}" ]]; then
  echo "4. Open settings_local_module_url (${SETTINGS_URL}) for local all-in-one module"
fi
if [[ "${RESOLVED_VARIANT}" == "ehr_sync_complex" ]]; then
  echo "5. Open review_inbox_url for human-in-the-loop SMS approval"
fi
echo "6. Optional demo call: BUYER_DEMO_SEED_CALL=1 re-run this script (needs Postgres)"
echo ""
echo "Local module smoke (optional):"
echo "  ./scripts/gtm-local-all-in-one-demo.sh \"${E2E_BACKEND_URL%\}/\""
