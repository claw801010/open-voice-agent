#!/usr/bin/env bash
# MK-01 buyer demo — Travel concierge & booking FAQ (waiver_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-hospitality-waiver.sh
# Override variant: ./buyer-demo-hospitality-waiver.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-hospitality-waiver.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "hospitality-travel-concierge" "$@"
