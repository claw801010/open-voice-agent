#!/usr/bin/env bash
# WE-01-VISUAL-DEPTH — one-shot authenticated Lighthouse after cookie generation.
#
# Prerequisites (from ui/):
#   - Next dev (or start) + API reachable (same as perf:lighthouse:oss-headers)
#   - LIGHTHOUSE_OSS_PASSWORD (≥8 chars) and either LIGHTHOUSE_OSS_EMAIL or LIGHTHOUSE_OSS_AUTO_SIGNUP=1
#
# Usage:
#   LIGHTHOUSE_OSS_AUTO_SIGNUP=1 LIGHTHOUSE_OSS_PASSWORD='your-long-pass' \
#   LIGHTHOUSE_UI_ORIGIN=http://localhost:3000 npm run perf:lighthouse:auth:full
#
# Sets BASE_URL for the Lighthouse script to match LIGHTHOUSE_UI_ORIGIN when BASE_URL is unset.
#
# LIGHTHOUSE_AUTH_FULL_SKIP_PREFLIGHT=1 — skip curl health (e.g. unusual proxy setups).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ORIGIN="${LIGHTHOUSE_UI_ORIGIN:-http://localhost:3000}"
export BASE_URL="${BASE_URL:-$ORIGIN}"

if [[ "${LIGHTHOUSE_AUTH_FULL_SKIP_PREFLIGHT:-0}" != "1" ]]; then
  if ! curl -sf --max-time 10 "${ORIGIN}/api/v1/health" >/dev/null; then
    echo "ERROR: ${ORIGIN}/api/v1/health did not return HTTP 200 — start Next (this origin) and the API (Next rewrites /api/v1 to BACKEND_URL). See READMEBUILDME.md §4." >&2
    echo "To skip this check: LIGHTHOUSE_AUTH_FULL_SKIP_PREFLIGHT=1" >&2
    exit 1
  fi
fi

npm run perf:lighthouse:oss-headers
npm run perf:lighthouse:auth
npm run perf:lighthouse:summary:latest-auth
echo ""
echo "==> Paste the two WE-01-VISUAL-DEPTH lines into READMENEWRELEASES.md (Unreleased), then [x] the authenticated Lighthouse item in READMEPLANTOEXECUTE.md."
