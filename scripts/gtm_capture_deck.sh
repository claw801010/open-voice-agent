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

if [[ -z "${E2E_GTM_SAMPLE_CALL_ID:-}" ]]; then
  TOKEN="$(curl -sf -X POST "${E2E_BACKEND_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\"}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")"
  CALL_ID="$(curl -sf "${E2E_BACKEND_URL}/api/v1/analytics/calls?limit=1" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); items=d.get('items') or []; print(items[0]['call_id'] if items else '')" 2>/dev/null || true)"
  if [[ -z "${CALL_ID}" ]]; then
    echo "Seeding healthcare EHR demo call (tool spans + review inbox + chart sync)…"
    CALL_ID="$(PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/seed_gtm_healthcare_ehr_demo.py" "${E2E_EMAIL}" 2>/dev/null || true)"
    if [[ -z "${CALL_ID}" ]]; then
      echo "Fallback: basic analytics demo call…"
      CALL_ID="$(PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/seed_gtm_analytics_demo_call.py" "${E2E_EMAIL}" 2>/dev/null || true)"
    fi
  fi
  if [[ -n "${CALL_ID}" ]]; then
    export E2E_GTM_SAMPLE_CALL_ID="${CALL_ID}"
    echo "Using E2E_GTM_SAMPLE_CALL_ID=${E2E_GTM_SAMPLE_CALL_ID}"
  else
    echo "No calls in org — skipping call-detail / call-review PNGs."
  fi
fi

_seed_catalog_demo_call() {
  local slug="$1"
  local variant="$2"
  PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_demo_call.py" "${E2E_EMAIL}" "${slug}" "${variant}" 2>/dev/null || true
}

if [[ -z "${E2E_GTM_RETAIL_CALL_ID:-}" ]]; then
  echo "Seeding retail collections demo call…"
  RETAIL_ID="$(_seed_catalog_demo_call retail-wismo-faq collections_complex)"
  if [[ -n "${RETAIL_ID}" ]]; then
    export E2E_GTM_RETAIL_CALL_ID="${RETAIL_ID}"
    echo "Using E2E_GTM_RETAIL_CALL_ID=${E2E_GTM_RETAIL_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_TELECOM_CALL_ID:-}" ]]; then
  echo "Seeding telecom outage demo call…"
  TELECOM_ID="$(_seed_catalog_demo_call telecom-utilities-outage-faq outage_status_complex)"
  if [[ -n "${TELECOM_ID}" ]]; then
    export E2E_GTM_TELECOM_CALL_ID="${TELECOM_ID}"
    echo "Using E2E_GTM_TELECOM_CALL_ID=${E2E_GTM_TELECOM_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_B2B_CALL_ID:-}" ]]; then
  echo "Seeding B2B conversion demo call…"
  B2B_ID="$(_seed_catalog_demo_call b2b-saas-trial-nurture conversion_complex)"
  if [[ -n "${B2B_ID}" ]]; then
    export E2E_GTM_B2B_CALL_ID="${B2B_ID}"
    echo "Using E2E_GTM_B2B_CALL_ID=${E2E_GTM_B2B_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_INSURANCE_CALL_ID:-}" ]]; then
  echo "Seeding insurance claims lookup demo call…"
  INSURANCE_ID="$(_seed_catalog_demo_call insurance-fnol-faq claims_lookup_complex)"
  if [[ -n "${INSURANCE_ID}" ]]; then
    export E2E_GTM_INSURANCE_CALL_ID="${INSURANCE_ID}"
    echo "Using E2E_GTM_INSURANCE_CALL_ID=${E2E_GTM_INSURANCE_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_BANKING_CALL_ID:-}" ]]; then
  echo "Seeding banking balance lookup demo call…"
  BANKING_ID="$(_seed_catalog_demo_call financial-services-banking-faq balance_lookup_complex)"
  if [[ -n "${BANKING_ID}" ]]; then
    export E2E_GTM_BANKING_CALL_ID="${BANKING_ID}"
    echo "Using E2E_GTM_BANKING_CALL_ID=${E2E_GTM_BANKING_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_HOSPITALITY_CALL_ID:-}" ]]; then
  echo "Seeding hospitality waiver demo call…"
  HOSPITALITY_ID="$(_seed_catalog_demo_call hospitality-travel-concierge waiver_complex)"
  if [[ -n "${HOSPITALITY_ID}" ]]; then
    export E2E_GTM_HOSPITALITY_CALL_ID="${HOSPITALITY_ID}"
    echo "Using E2E_GTM_HOSPITALITY_CALL_ID=${E2E_GTM_HOSPITALITY_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_SMB_CALL_ID:-}" ]]; then
  echo "Seeding SMB franchise lead capture demo call…"
  SMB_ID="$(_seed_catalog_demo_call smb-franchise-location-faq lead_capture_complex)"
  if [[ -n "${SMB_ID}" ]]; then
    export E2E_GTM_SMB_CALL_ID="${SMB_ID}"
    echo "Using E2E_GTM_SMB_CALL_ID=${E2E_GTM_SMB_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_CIVIC_CALL_ID:-}" ]]; then
  echo "Seeding civic permit status demo call…"
  CIVIC_ID="$(_seed_catalog_demo_call public-sector-civic-services-faq permit_status_complex)"
  if [[ -n "${CIVIC_ID}" ]]; then
    export E2E_GTM_CIVIC_CALL_ID="${CIVIC_ID}"
    echo "Using E2E_GTM_CIVIC_CALL_ID=${E2E_GTM_CIVIC_CALL_ID}"
  fi
fi

if [[ -z "${E2E_GTM_HR_CALL_ID:-}" ]]; then
  echo "Seeding HR application status demo call…"
  HR_ID="$(_seed_catalog_demo_call hr-staffing-recruiting-faq application_status_complex)"
  if [[ -n "${HR_ID}" ]]; then
    export E2E_GTM_HR_CALL_ID="${HR_ID}"
    echo "Using E2E_GTM_HR_CALL_ID=${E2E_GTM_HR_CALL_ID}"
  fi
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

if [[ -z "${E2E_GTM_WORKFLOW_ID:-}" ]]; then
  echo "Seeding healthcare EHR catalog workflow…"
  WF_ID="$(GTM_CATALOG_SLUG=healthcare-clinic-screening GTM_CATALOG_VARIANT=ehr_sync_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${WF_ID}" ]]; then
    export E2E_GTM_WORKFLOW_ID="${WF_ID}"
    echo "Using E2E_GTM_WORKFLOW_ID=${E2E_GTM_WORKFLOW_ID}"
  else
    echo "Could not seed healthcare catalog workflow — skipping EHR wire / voice quick-pick PNGs."
  fi
fi

if [[ -z "${E2E_GTM_RETAIL_WORKFLOW_ID:-}" ]]; then
  echo "Seeding retail collections catalog workflow…"
  RETAIL_WF="$(GTM_CATALOG_SLUG=retail-wismo-faq GTM_CATALOG_VARIANT=collections_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${RETAIL_WF}" ]]; then
    export E2E_GTM_RETAIL_WORKFLOW_ID="${RETAIL_WF}"
    echo "Using E2E_GTM_RETAIL_WORKFLOW_ID=${E2E_GTM_RETAIL_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_TELECOM_WORKFLOW_ID:-}" ]]; then
  echo "Seeding telecom outage catalog workflow…"
  TELECOM_WF="$(GTM_CATALOG_SLUG=telecom-utilities-outage-faq GTM_CATALOG_VARIANT=outage_status_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${TELECOM_WF}" ]]; then
    export E2E_GTM_TELECOM_WORKFLOW_ID="${TELECOM_WF}"
    echo "Using E2E_GTM_TELECOM_WORKFLOW_ID=${E2E_GTM_TELECOM_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_B2B_WORKFLOW_ID:-}" ]]; then
  echo "Seeding B2B conversion catalog workflow…"
  B2B_WF="$(GTM_CATALOG_SLUG=b2b-saas-trial-nurture GTM_CATALOG_VARIANT=conversion_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${B2B_WF}" ]]; then
    export E2E_GTM_B2B_WORKFLOW_ID="${B2B_WF}"
    echo "Using E2E_GTM_B2B_WORKFLOW_ID=${E2E_GTM_B2B_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_INSURANCE_WORKFLOW_ID:-}" ]]; then
  echo "Seeding insurance claims lookup catalog workflow…"
  INSURANCE_WF="$(GTM_CATALOG_SLUG=insurance-fnol-faq GTM_CATALOG_VARIANT=claims_lookup_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${INSURANCE_WF}" ]]; then
    export E2E_GTM_INSURANCE_WORKFLOW_ID="${INSURANCE_WF}"
    echo "Using E2E_GTM_INSURANCE_WORKFLOW_ID=${E2E_GTM_INSURANCE_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_BANKING_WORKFLOW_ID:-}" ]]; then
  echo "Seeding banking balance lookup catalog workflow…"
  BANKING_WF="$(GTM_CATALOG_SLUG=financial-services-banking-faq GTM_CATALOG_VARIANT=balance_lookup_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${BANKING_WF}" ]]; then
    export E2E_GTM_BANKING_WORKFLOW_ID="${BANKING_WF}"
    echo "Using E2E_GTM_BANKING_WORKFLOW_ID=${E2E_GTM_BANKING_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_HOSPITALITY_WORKFLOW_ID:-}" ]]; then
  echo "Seeding hospitality waiver catalog workflow…"
  HOSPITALITY_WF="$(GTM_CATALOG_SLUG=hospitality-travel-concierge GTM_CATALOG_VARIANT=waiver_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${HOSPITALITY_WF}" ]]; then
    export E2E_GTM_HOSPITALITY_WORKFLOW_ID="${HOSPITALITY_WF}"
    echo "Using E2E_GTM_HOSPITALITY_WORKFLOW_ID=${E2E_GTM_HOSPITALITY_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_SMB_WORKFLOW_ID:-}" ]]; then
  echo "Seeding SMB lead capture catalog workflow…"
  SMB_WF="$(GTM_CATALOG_SLUG=smb-franchise-location-faq GTM_CATALOG_VARIANT=lead_capture_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${SMB_WF}" ]]; then
    export E2E_GTM_SMB_WORKFLOW_ID="${SMB_WF}"
    echo "Using E2E_GTM_SMB_WORKFLOW_ID=${E2E_GTM_SMB_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_CIVIC_WORKFLOW_ID:-}" ]]; then
  echo "Seeding civic permit lookup catalog workflow…"
  CIVIC_WF="$(GTM_CATALOG_SLUG=public-sector-civic-services-faq GTM_CATALOG_VARIANT=permit_status_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${CIVIC_WF}" ]]; then
    export E2E_GTM_CIVIC_WORKFLOW_ID="${CIVIC_WF}"
    echo "Using E2E_GTM_CIVIC_WORKFLOW_ID=${E2E_GTM_CIVIC_WORKFLOW_ID}"
  fi
fi

if [[ -z "${E2E_GTM_HR_WORKFLOW_ID:-}" ]]; then
  echo "Seeding HR application status catalog workflow…"
  HR_WF="$(GTM_CATALOG_SLUG=hr-staffing-recruiting-faq GTM_CATALOG_VARIANT=application_status_complex \
    PYTHONPATH="${ROOT}" E2E_PASSWORD="${E2E_PASSWORD}" \
    "${PYTHON}" "${ROOT}/scripts/seed_gtm_catalog_workflow.py" "${E2E_EMAIL}" 2>/dev/null || true)"
  if [[ -n "${HR_WF}" ]]; then
    export E2E_GTM_HR_WORKFLOW_ID="${HR_WF}"
    echo "Using E2E_GTM_HR_WORKFLOW_ID=${E2E_GTM_HR_WORKFLOW_ID}"
  fi
fi

export E2E_GTM_DECK_SCREENSHOTS=1
export PLAYWRIGHT_SKIP_WEBSERVER=1

if [[ -n "${E2E_GTM_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking catalog editor lock on workflow ${E2E_GTM_WORKFLOW_ID} (healthcare EHR / voice quick-pick)…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_RETAIL_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking retail collections workflow ${E2E_GTM_RETAIL_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_RETAIL_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_TELECOM_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking telecom outage workflow ${E2E_GTM_TELECOM_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_TELECOM_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_B2B_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking B2B conversion workflow ${E2E_GTM_B2B_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_B2B_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_INSURANCE_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking insurance claims lookup workflow ${E2E_GTM_INSURANCE_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_INSURANCE_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_BANKING_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking banking balance lookup workflow ${E2E_GTM_BANKING_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_BANKING_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_HOSPITALITY_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking hospitality waiver workflow ${E2E_GTM_HOSPITALITY_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_HOSPITALITY_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_SMB_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking SMB lead capture workflow ${E2E_GTM_SMB_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_SMB_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_CIVIC_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking civic permit lookup workflow ${E2E_GTM_CIVIC_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_CIVIC_WORKFLOW_ID}" || true
fi
if [[ -n "${E2E_GTM_HR_WORKFLOW_ID:-}" ]]; then
  echo "Unlocking HR application status workflow ${E2E_GTM_HR_WORKFLOW_ID}…"
  PYTHONPATH="${ROOT}" "${PYTHON}" "${ROOT}/scripts/gtm_unlock_workflow_editor.py" \
    "${E2E_EMAIL}" "${E2E_GTM_HR_WORKFLOW_ID}" || true
fi

echo "Optional env: E2E_GTM_*_WORKFLOW_ID / E2E_GTM_*_CALL_ID (all 10 vertical buyer demos)"
echo "  sample=${E2E_GTM_SAMPLE_CALL_ID:-unset} smb=${E2E_GTM_SMB_CALL_ID:-unset} civic=${E2E_GTM_CIVIC_CALL_ID:-unset} hr=${E2E_GTM_HR_CALL_ID:-unset}"

cd ui
npm run test:e2e -- gtm-deck

echo "Filling any missing GTM PNGs with stdlib placeholders (replace via live capture when API+UI up)…"
"${PYTHON}" "${ROOT}/scripts/gen_gtm_deck_placeholder_pngs.py" || true

echo "PNG files written under docs/images/ (gtm-*.png)"
