#!/usr/bin/env bash
# Stage files for one MK-01 split PR (git add only — does not commit).
#
# Usage (repo root):
#   ./scripts/stage_mk01_split.sh 1   # catalog + buyer matrix
#   ./scripts/stage_mk01_split.sh 2   # GTM seed + capture scripts
#   ./scripts/stage_mk01_split.sh 3   # UI marketplace + E2E
#   ./scripts/stage_mk01_split.sh 4   # GTM PNGs + docs + workflows
#   ./scripts/stage_mk01_split.sh all
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PR=""
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    1|2|3|4|all) PR="$1"; shift ;;
    *)
      echo "Usage: $0 [--dry-run] {1|2|3|4|all}" >&2
      echo "Hints: ./scripts/prepare_mk01_pr.sh --split-hints" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PR" ]]; then
  echo "Usage: $0 [--dry-run] {1|2|3|4|all}" >&2
  exit 1
fi

git_add() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  git add'
    for path in "$@"; do
      printf ' %q' "$path"
    done
    echo
    return 0
  fi
  git add "$@" 2>/dev/null || true
}

stage_pr1() {
  git_add \
    catalog/buyer-demo-defaults.json \
    catalog/buyer-demo-hints.json \
    catalog/recipes/buyer-demo-gtm-day.md \
    catalog/recipes/catalog-buyer-demo.md \
    catalog/voice-previews/ \
    scripts/buyer-demo-*.sh \
    scripts/gen_buyer_demo_shortcuts.py \
    scripts/check_buyer_demo_matrix.sh \
    scripts/run_all_buyer_demos.sh \
    scripts/catalog-buyer-demo.sh \
    api/tests/test_buyer_demo_defaults_unit.py \
    api/tests/test_buyer_demo_hints_unit.py \
    api/tests/test_buyer_demo_matrix_unit.py \
    api/tests/test_gen_buyer_demo_shortcuts_unit.py \
    api/tests/test_run_all_buyer_demos_unit.py
}

stage_pr2() {
  git_add \
    scripts/seed_gtm_all_buyer_demo_calls.py \
    scripts/seed_gtm_all_buyer_workflows.py \
    scripts/gtm_*.sh \
    scripts/start_mk01_gtm_stack.sh \
    scripts/start_ui_for_gtm.sh \
    scripts/ensure_mk01_api_env.sh \
    scripts/verify_mk01_buyer_shipped.sh \
    scripts/prepare_mk01_pr.sh \
    scripts/split_mk01_pr_hints.sh \
    scripts/stage_mk01_split.sh \
    api/tests/test_gtm_deck_inventory_sync_unit.py \
    api/tests/test_gtm_local_all_in_one_script_unit.py \
    api/tests/test_gtm_local_all_in_one.py
}

stage_pr3() {
  git_add \
    ui/src/components/catalog/CatalogBuyerVariantHintStrip.tsx \
    ui/src/components/catalog/MarketplaceCatalog.tsx \
    ui/src/lib/catalog/buyerDemoSeededCalls.ts \
    ui/src/lib/catalog/buyerDemoSeededCalls.test.ts \
    ui/src/lib/catalog/buyerDemoVoicePreview.test.ts \
    ui/e2e/analytics-buyer-demo-calls.spec.ts \
    ui/e2e/gtm-deck-screenshots.spec.ts \
    ui/src/components/settings/LocalEhrSection.tsx \
    ui/src/lib/healthcareLiveWorkflow.ts \
    ui/src/components/analytics/LiveWorkflowTimeline.tsx \
    ui/src/app/analytics/review/ReviewInboxClient.tsx \
    ui/src/lib/analyticsCallReviewApi.ts
}

stage_pr4() {
  git_add \
    docs/images/gtm-mk01-*.png \
    docs/images/README.md \
    READMENEWRELEASES.md \
    READMEPLANTOEXECUTE.md \
    DOCS.md \
    READMEBUILDME.md \
    .github/pull_request_template.md \
    .github/workflows/api-pytest-usage-rollup.yml \
    .github/workflows/ui-playwright.yml \
    .github/workflows/ui-vitest.yml
}

case "$PR" in
  1) stage_pr1 ;;
  2) stage_pr2 ;;
  3) stage_pr3 ;;
  4) stage_pr4 ;;
  all)
    stage_pr1
    stage_pr2
    stage_pr3
    stage_pr4
    ;;
  *)
    echo "Unknown split PR: $PR (use 1–4 or all)" >&2
    exit 1
    ;;
esac

if [[ "$DRY_RUN" == "1" ]]; then
  echo ""
  echo "Dry run — MK-01 split PR ${PR} paths above (no git add)."
else
  echo "Staged MK-01 split PR ${PR}. Review: git status --short"
fi
echo "Commit when ready (MK-01-SHIP-PR still Incomplete until pushed/merged)."
