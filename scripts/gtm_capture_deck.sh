#!/usr/bin/env bash
# Opt-in GTM deck PNG capture (1280×720 → docs/images/gtm-*.png).
# Prereqs: Docker infra (postgres:5433, redis), API :8000, UI on E2E_BASE_URL, Playwright chromium.
#   ./scripts/start_services_dev.sh && alembic upgrade head (from api/)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

export E2E_BACKEND_URL="${E2E_BACKEND_URL:-http://127.0.0.1:8000}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:3000}"

echo "Smoke local all-in-one APIs at ${E2E_BACKEND_URL} …"
if "${ROOT}/scripts/gtm-local-all-in-one-demo.sh" "${E2E_BACKEND_URL}"; then
  echo "Local all-in-one API smoke OK."
else
  echo "WARN: local all-in-one smoke failed — ensure API is up with ENABLE_LOCAL_SCHEDULING/PAYMENTS/INTEGRATIONS." >&2
fi

if [[ "${GTM_SKIP_BUYER_MATRIX_CHECK:-}" != "1" ]] && [[ -x "${ROOT}/scripts/check_buyer_demo_matrix.sh" ]]; then
  echo "Buyer demo matrix check…"
  "${ROOT}/scripts/check_buyer_demo_matrix.sh" || \
    echo "WARN: buyer demo matrix check failed — hints/defaults may be out of sync." >&2
fi

if [[ "${GTM_SKIP_PREREQ_CHECK:-}" != "1" ]]; then
  "${ROOT}/scripts/check_gtm_capture_prereqs.sh" || echo "WARN: GTM preflight failed — capture may skip frames." >&2
fi

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

echo "Seeding buyer-demo analytics calls (all 10 verticals)…"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@localhost:5433/postgres}"
while IFS= read -r line; do
  [[ -n "$line" ]] && eval "$line"
done < <("${PYTHON}" "${ROOT}/scripts/seed_gtm_all_buyer_demo_calls.py" "${E2E_EMAIL}" --export-lines 2>/dev/null || true)

if [[ -z "${E2E_GTM_SAMPLE_CALL_ID:-}" ]]; then
  echo "Seeding healthcare EHR demo call (tool spans + review inbox + chart sync)…"
  CALL_ID="$(PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/seed_gtm_healthcare_ehr_demo.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -z "${CALL_ID}" ]]; then
    echo "Fallback: basic analytics demo call…"
    CALL_ID="$(PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/seed_gtm_analytics_demo_call.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  fi
  if [[ -n "${CALL_ID}" ]]; then
    export E2E_GTM_SAMPLE_CALL_ID="${CALL_ID}"
  else
    echo "No healthcare sample call — skipping live-workflow / call-detail / call-review PNGs."
  fi
fi
if [[ -n "${E2E_GTM_SAMPLE_CALL_ID:-}" ]]; then
  echo "Using E2E_GTM_SAMPLE_CALL_ID=${E2E_GTM_SAMPLE_CALL_ID} (healthcare EHR / live workflow)"
fi

if [[ -z "${E2E_GTM_HTTP_TOOL_UUID:-}" ]]; then
  TOOL_UUID="$(PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/seed_gtm_http_tool.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${TOOL_UUID}" ]]; then
    export E2E_GTM_HTTP_TOOL_UUID="${TOOL_UUID}"
    echo "Using E2E_GTM_HTTP_TOOL_UUID=${E2E_GTM_HTTP_TOOL_UUID}"
  else
    echo "Could not seed HTTP tool — skipping gtm-we01-http-tool-happy-path.png."
  fi
fi

echo "Seeding buyer-demo catalog workflows (all 10 verticals)…"
while IFS= read -r line; do
  [[ -n "$line" ]] && eval "$line"
done < <("${PYTHON}" "${ROOT}/scripts/seed_gtm_all_buyer_workflows.py" "${E2E_EMAIL}" --export-lines 2>/dev/null || true)

GTM_WORKFLOW_ENV_VARS=(
  E2E_GTM_WORKFLOW_ID
  E2E_GTM_RETAIL_WORKFLOW_ID
  E2E_GTM_TELECOM_WORKFLOW_ID
  E2E_GTM_B2B_WORKFLOW_ID
  E2E_GTM_INSURANCE_WORKFLOW_ID
  E2E_GTM_BANKING_WORKFLOW_ID
  E2E_GTM_HOSPITALITY_WORKFLOW_ID
  E2E_GTM_SMB_WORKFLOW_ID
  E2E_GTM_CIVIC_WORKFLOW_ID
  E2E_GTM_HR_WORKFLOW_ID
)
echo "Unlocking catalog workflows for wire-local / editor captures…"
for env_name in "${GTM_WORKFLOW_ENV_VARS[@]}"; do
  wf_id="${!env_name:-}"
  if [[ -n "${wf_id}" ]]; then
    PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
      "${E2E_EMAIL}" "${wf_id}" || true
  fi
done

export E2E_GTM_DECK_SCREENSHOTS=1
export PLAYWRIGHT_SKIP_WEBSERVER=1

if ! curl -sf "${E2E_BASE_URL}/templates" >/dev/null 2>&1; then
  echo "UI not up — starting via start_ui_for_gtm.sh …"
  "${ROOT}/scripts/start_ui_for_gtm.sh" --dev || {
    echo "ERROR: start UI on ${E2E_BASE_URL} (cd ui && npm run build && ./scripts/start_ui_for_gtm.sh)" >&2
    exit 1
  }
fi

echo "Optional env: E2E_GTM_*_WORKFLOW_ID / E2E_GTM_*_CALL_ID (all 10 vertical buyer demos)"
echo "  sample=${E2E_GTM_SAMPLE_CALL_ID:-unset} smb=${E2E_GTM_SMB_CALL_ID:-unset} civic=${E2E_GTM_CIVIC_CALL_ID:-unset} hr=${E2E_GTM_HR_CALL_ID:-unset}"

cd ui
npm run test:e2e -- gtm-deck

echo "Filling any missing GTM PNGs with stdlib placeholders (replace via live capture when API+UI up)…"
"${PYTHON}" "${ROOT}/scripts/gen_gtm_deck_placeholder_pngs.py" || true

echo "PNG files written under docs/images/ (gtm-*.png)"
