#!/usr/bin/env bash
# MK-01 buyer demo — Trial nurture & PQL voice qual (conversion_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-b2b-conversion.sh
# Override variant: ./buyer-demo-b2b-conversion.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-b2b-conversion.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "b2b-saas-trial-nurture" "$@"
