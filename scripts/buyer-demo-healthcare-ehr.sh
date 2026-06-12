#!/usr/bin/env bash
# MK-01 buyer demo — Patient screening & triage (ehr_sync_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-healthcare-ehr.sh
# Override variant: ./buyer-demo-healthcare-ehr.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-healthcare-ehr.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "healthcare-clinic-screening" "$@"
