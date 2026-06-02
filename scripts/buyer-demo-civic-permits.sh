#!/usr/bin/env bash
# MK-01 buyer demo — Civic services & permits FAQ (permit_status_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-civic-permits.sh
# Override variant: ./buyer-demo-civic-permits.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-civic-permits.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "public-sector-civic-services-faq" "$@"
