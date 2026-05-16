#!/usr/bin/env bash
# Opt-in GTM deck PNG capture (1280×720 → docs/images/gtm-*.png).
# Prereqs: API :8000, UI (dev or prod on E2E_BASE_URL), Playwright chromium.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export E2E_BACKEND_URL="${E2E_BACKEND_URL:-http://127.0.0.1:8000}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:3000}"

if [[ ! -f ui/.env && -f ui/.env.example ]]; then
  cp ui/.env.example ui/.env
  echo "Created ui/.env from .env.example (BACKEND_URL for session route)."
fi

if [[ -z "${E2E_EMAIL:-}" || -z "${E2E_PASSWORD:-}" ]]; then
  SUFFIX="$(date +%s)"
  export E2E_EMAIL="playwright-e2e-local-${SUFFIX}@example.com"
  export E2E_PASSWORD="PlaywrightE2E-test-99"
  echo "Seeding OSS user ${E2E_EMAIL} …"
  curl -sf -X POST "${E2E_BACKEND_URL}/api/v1/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\",\"name\":\"Playwright E2E\"}" >/dev/null
fi

if [[ -z "${E2E_GTM_SAMPLE_CALL_ID:-}" ]]; then
  TOKEN="$(curl -sf -X POST "${E2E_BACKEND_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\"}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")"
  CALL_ID="$(curl -sf "${E2E_BACKEND_URL}/api/v1/analytics/calls?limit=1" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); items=d.get('items') or []; print(items[0]['call_id'] if items else '')" 2>/dev/null || true)"
  if [[ -n "${CALL_ID}" ]]; then
    export E2E_GTM_SAMPLE_CALL_ID="${CALL_ID}"
    echo "Using E2E_GTM_SAMPLE_CALL_ID=${E2E_GTM_SAMPLE_CALL_ID}"
  else
    echo "No calls in org yet — skipping call-detail / call-review PNGs (run a Web test first)."
  fi
fi

export E2E_GTM_DECK_SCREENSHOTS=1
export PLAYWRIGHT_SKIP_WEBSERVER=1

echo "Optional: E2E_GTM_WORKFLOW_ID, E2E_GTM_HTTP_TOOL_UUID (override E2E_GTM_SAMPLE_CALL_ID=${E2E_GTM_SAMPLE_CALL_ID:-unset})"

cd ui
npm run test:e2e -- gtm-deck

echo "PNG files written under docs/images/ (gtm-*.png)"
