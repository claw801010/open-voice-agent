#!/usr/bin/env bash
# MK-01 buyer demo — Candidate FAQ & interview scheduling (application_status_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-hr-recruiting.sh
# Override variant: ./buyer-demo-hr-recruiting.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-hr-recruiting.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "hr-staffing-recruiting-faq" "$@"
