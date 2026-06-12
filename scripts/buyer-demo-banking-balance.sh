#!/usr/bin/env bash
# MK-01 buyer demo — Card & branch banking FAQ (balance_lookup_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-banking-balance.sh
# Override variant: ./buyer-demo-banking-balance.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-banking-balance.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "financial-services-banking-faq" "$@"
