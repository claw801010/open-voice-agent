#!/usr/bin/env bash
# MK-01 buyer demo — Handyman FAQ & service booking (quote_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-handyman-quote.sh
# Override variant: ./buyer-demo-handyman-quote.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-handyman-quote.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "handyman-home-services-faq" "$@"
