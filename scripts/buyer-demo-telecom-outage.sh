#!/usr/bin/env bash
# MK-01 buyer demo — Outage & billing FAQ (outage_status_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-telecom-outage.sh
# Override variant: ./buyer-demo-telecom-outage.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-telecom-outage.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "telecom-utilities-outage-faq" "$@"
