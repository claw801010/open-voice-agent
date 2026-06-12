#!/usr/bin/env bash
# MK-01 buyer demo — WISMO & store policy FAQ (collections_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-retail-collections.sh
# Override variant: ./buyer-demo-retail-collections.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-retail-collections.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "retail-wismo-faq" "$@"
