#!/usr/bin/env bash
# MK-01 — pre-PR gate: verify offline checks and summarize git state (does not commit).
#
# Usage (repo root):
#   ./scripts/prepare_mk01_pr.sh
#   ./scripts/prepare_mk01_pr.sh --branch feat/mk01-local-all-in-one-gtm
#   ./scripts/prepare_mk01_pr.sh --split-hints
#   ./scripts/prepare_mk01_pr.sh --stage 1   # git add split PR 1 only
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET_BRANCH=""
SPLIT_HINTS=0
STAGE_PR=""
STAGE_DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      TARGET_BRANCH="${2:-}"
      shift 2
      ;;
    --branch=*)
      TARGET_BRANCH="${1#--branch=}"
      shift
      ;;
    --split-hints)
      SPLIT_HINTS=1
      shift
      ;;
    --stage)
      STAGE_PR="${2:-}"
      shift 2
      ;;
    --stage=*)
      STAGE_PR="${1#--stage=}"
      shift
      ;;
    --dry-stage)
      STAGE_PR="${2:-}"
      STAGE_DRY_RUN=1
      shift 2
      ;;
    --dry-stage=*)
      STAGE_PR="${1#--dry-stage=}"
      STAGE_DRY_RUN=1
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [[ "$SPLIT_HINTS" == "1" ]]; then
  exec "${ROOT}/scripts/split_mk01_pr_hints.sh"
fi

if [[ -n "$STAGE_PR" ]]; then
  if [[ "$STAGE_DRY_RUN" == "1" ]]; then
    exec "${ROOT}/scripts/stage_mk01_split.sh" --dry-run "$STAGE_PR"
  fi
  exec "${ROOT}/scripts/stage_mk01_split.sh" "$STAGE_PR"
fi

echo "== MK-01 pre-PR preparation =="
"${ROOT}/scripts/verify_mk01_buyer_shipped.sh"

echo ""
echo "== GTM deck + voice inventory (offline) =="
"${ROOT}/scripts/gtm_live_capture_ready.sh"

echo ""
echo "== Git summary =="
git status --short | head -60
untracked="$(git status --short | grep -c '^??' || true)"
if [[ "$untracked" -gt 0 ]]; then
  echo ""
  echo "Untracked files: ${untracked} (include new scripts/tests before commit)"
  git status --short | grep '^??' | head -25
fi
echo ""
echo "Branch: $(git branch --show-current)"
echo "Ahead of origin/main: $(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?') commits"

if [[ -n "${TARGET_BRANCH}" ]]; then
  if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
    echo ""
    echo "Tip: checkout feature branch before commit:"
    echo "  git checkout ${TARGET_BRANCH}"
  elif git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    echo ""
    echo "Tip: track remote feature branch:"
    echo "  git checkout -b ${TARGET_BRANCH} origin/${TARGET_BRANCH}"
  fi
fi

echo ""
echo "Status: MK-01-SHIP-PR Done (merged PR #1). Remaining: MK-01-VOICE-SPOKEN (ElevenLabs)."
echo "Split options: ./scripts/prepare_mk01_pr.sh --split-hints"
echo "Stage split:    ./scripts/prepare_mk01_pr.sh --stage {1|2|3|4|all}"
echo "Dry-run stage:  ./scripts/prepare_mk01_pr.sh --dry-stage {1|2|3|4|all}"
echo ""
echo "When ready to commit (example):"
echo "  git add catalog/ scripts/ ui/ api/ docs/images/ .github/workflows/ READMENEWRELEASES.md DOCS.md READMEBUILDME.md READMEPLANTOEXECUTE.md"
echo "  git commit -m \"MK-01: buyer demo matrix, GTM deck, try-flow, voice previews\""
echo "  git push -u origin HEAD"
