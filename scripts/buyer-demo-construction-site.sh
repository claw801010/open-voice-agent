#!/usr/bin/env bash
# MK-01 buyer demo — Construction FAQ & site visits (booking_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-construction-site.sh
# Override variant: ./buyer-demo-construction-site.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-construction-site.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "construction-trades-faq" "$@"
