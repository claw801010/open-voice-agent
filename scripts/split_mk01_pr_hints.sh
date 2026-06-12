#!/usr/bin/env bash
# Suggested PR splits for the MK-01 buyer/GTM slice (does not commit or push).
#
# Usage (repo root):
#   ./scripts/split_mk01_pr_hints.sh
#
set -euo pipefail

cat <<'EOF'
MK-01 — suggested PR splits (reviewable, bisect-friendly):

  PR 1 — Catalog + buyer matrix data
    catalog/buyer-demo-defaults.json catalog/buyer-demo-hints.json
    catalog/recipes/buyer-demo-gtm.md catalog/recipes/catalog-buyer-demo.md
    catalog/voice-previews/ scripts/buyer-demo-*.sh scripts/gen_buyer_demo_shortcuts.py
    scripts/check_buyer_demo_matrix.sh scripts/run_all_buyer_demos.sh
    api/tests/test_buyer_demo_* api/tests/test_gen_buyer_demo_shortcuts_unit.py

  PR 2 — GTM seed + capture scripts
    scripts/seed_gtm_all_buyer_*.py scripts/gtm_*.sh scripts/start_*.sh
    scripts/ensure_mk01_api_env.sh scripts/verify_mk01_buyer_shipped.sh
    scripts/prepare_mk01_pr.sh scripts/split_mk01_pr_hints.sh
    api/tests/test_gtm_* api/tests/test_run_all_buyer_demos_unit.py

  PR 3 — UI marketplace + analytics E2E
    ui/src/components/catalog/CatalogBuyerVariantHintStrip.tsx
    ui/src/lib/catalog/buyerDemo*.ts*
    ui/e2e/analytics-buyer-demo-calls.spec.ts ui/e2e/gtm-deck-screenshots.spec.ts
    ui/src/components/settings/LocalEhrSection.tsx

  PR 4 — GTM deck PNGs + docs (large binary diff)
    docs/images/gtm-mk01-*.png docs/images/README.md
    READMENEWRELEASES.md READMEPLANTOEXECUTE.md DOCS.md READMEBUILDME.md
    .github/workflows/

Stage (no commit):
  ./scripts/prepare_mk01_pr.sh --stage 1   # … through --stage 4 or --stage all

Or one PR: ./scripts/prepare_mk01_pr.sh (all paths in the example git add).

Incomplete until merged: MK-01-SHIP-PR · MK-01-VOICE-SPOKEN (ElevenLabs).
EOF
