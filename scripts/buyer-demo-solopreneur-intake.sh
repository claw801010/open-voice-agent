#!/usr/bin/env bash
# MK-01 buyer demo — Solopreneur FAQ & discovery calls (lead_capture_complex)
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./buyer-demo-solopreneur-intake.sh
# Override variant: ./buyer-demo-solopreneur-intake.sh booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./buyer-demo-solopreneur-intake.sh
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/catalog-buyer-demo.sh" "solopreneur-coach-faq" "$@"
