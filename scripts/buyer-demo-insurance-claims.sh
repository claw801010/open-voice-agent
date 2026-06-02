#!/usr/bin/env bash
# MK-01 buyer demo — FNOL guidance & policy FAQ (claims_lookup_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-insurance-claims.sh
# Override variant: ./buyer-demo-insurance-claims.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-insurance-claims.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "insurance-fnol-faq" "$@"
