#!/usr/bin/env bash
# MK-01 buyer demo — Salon FAQ & appointments (booking_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-salon-booking.sh
# Override variant: ./buyer-demo-salon-booking.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-salon-booking.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "barber-beauty-salon-faq" "$@"
