#!/usr/bin/env bash
# Preflight for ./scripts/gtm_capture_deck.sh — exit 0 when stack looks ready.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="${E2E_BACKEND_URL:-http://127.0.0.1:8000}"
UI="${E2E_BASE_URL:-http://127.0.0.1:3000}"

fail=0
warn() { echo "WARN: $*" >&2; }
die() { echo "ERROR: $*" >&2; fail=1; }

echo "Checking GTM capture prerequisites…"
echo "  API: ${BACKEND}"
echo "  UI:  ${UI}"

if ! curl -sf "${BACKEND}/api/v1/health" >/dev/null 2>&1; then
  die "API not reachable at ${BACKEND}/api/v1/health"
fi

for path in local-scheduling/config local-payments/config local-integrations/config local-ehr/config local-messaging/config; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "${BACKEND}/api/v1/${path}" || true)"
  if [[ "$code" != "200" ]]; then
    warn "GET /api/v1/${path} returned HTTP ${code} — set ENABLE_LOCAL_SCHEDULING/PAYMENTS/INTEGRATIONS on API"
  fi
done

ui_code="$(curl -sS -o /dev/null -w "%{http_code}" "${UI}/" 2>/dev/null || echo "000")"
if [[ "$ui_code" != "200" && "$ui_code" != "307" && "$ui_code" != "308" ]]; then
  die "UI not reachable at ${UI} (HTTP ${ui_code})"
fi

if [[ ! -d "${ROOT}/ui/node_modules/@playwright/test" ]]; then
  warn "Run 'cd ui && npm ci && npx playwright install chromium' before capture"
fi

missing=0
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  if [[ ! -f "${ROOT}/docs/images/${name}" ]]; then
    echo "  missing PNG: docs/images/${name}"
    missing=$((missing + 1))
  fi
done <<'EOF'
gtm-mk01-settings-local-all-in-one.png
gtm-mk01-settings-local-ehr-records.png
gtm-mk01-analytics-live-workflow.png
gtm-mk01-analytics-review-inbox.png
gtm-mk01-analytics-call-detail-retail-collections.png
gtm-mk01-analytics-call-detail-telecom-outage.png
gtm-mk01-analytics-call-detail-b2b-conversion.png
gtm-mk01-analytics-call-detail-insurance-claims.png
gtm-mk01-analytics-call-detail-banking-balance.png
gtm-mk01-analytics-call-detail-hospitality-waiver.png
gtm-mk01-workflow-wire-banking-integrations.png
gtm-mk01-workflow-wire-hospitality-integrations.png
gtm-mk01-settings-local-payments-collections.png
gtm-mk01-workflow-wire-retail-payments.png
gtm-mk01-workflow-wire-b2b-integrations.png
gtm-mk01-workflow-wire-insurance-integrations.png
gtm-mk01-workflow-wire-telecom-integrations.png
gtm-mk01-settings-local-integrations-outage.png
gtm-we01-voice-profiles-natural-delivery.png
EOF

if [[ "$missing" -gt 0 ]]; then
  warn "${missing} deck PNG(s) missing — placeholders: python3 scripts/gen_gtm_deck_placeholder_pngs.py"
fi

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Fix the errors above, then run: ./scripts/gtm_capture_deck.sh"
  exit 1
fi

echo "OK — ready for ./scripts/gtm_capture_deck.sh"
exit 0
