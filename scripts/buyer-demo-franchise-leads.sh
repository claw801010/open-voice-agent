#!/usr/bin/env bash
# MK-01 buyer demo — Multi-location FAQ & lead callback (lead_capture_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-franchise-leads.sh
# Override variant: ./buyer-demo-franchise-leads.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-franchise-leads.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "smb-franchise-location-faq" "$@"
