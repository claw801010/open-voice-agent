#!/usr/bin/env bash
# MK-01 — smoke local scheduling, payments, and integrations (no :8765 stub).
#
# Usage (repo root, API running):
#   ./scripts/gtm-local-all-in-one-demo.sh
#   ./scripts/gtm-local-all-in-one-demo.sh http://127.0.0.1:8000
#
# Optional auth (records list endpoints only):
#   GTM_DEMO_BEARER_TOKEN=… ./scripts/gtm-local-all-in-one-demo.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${1:-${BACKEND_API_ENDPOINT:-http://127.0.0.1:8000}}"
BASE="${BASE%/}"
TOKEN="${GTM_DEMO_BEARER_TOKEN:-}"

pretty_json() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -m json.tool
  else
    cat
  fi
}

die() {
  echo "gtm-local-all-in-one-demo: $*" >&2
  exit 1
}

echo "== Local all-in-one demo (base ${BASE}) =="

echo ""
echo "== GET local-scheduling/config =="
code="$(curl -sS -o /tmp/gtm-ls.json -w "%{http_code}" "${BASE}/api/v1/local-scheduling/config")" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "local-scheduling config failed"
pretty_json </tmp/gtm-ls.json | head -20

echo ""
echo "== GET local-payments/config =="
code="$(curl -sS -o /tmp/gtm-lp.json -w "%{http_code}" "${BASE}/api/v1/local-payments/config")" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "local-payments config failed"
pretty_json </tmp/gtm-lp.json | head -20

echo ""
echo "== GET local-integrations/config =="
code="$(curl -sS -o /tmp/gtm-li.json -w "%{http_code}" "${BASE}/api/v1/local-integrations/config")" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "local-integrations config failed"
pretty_json </tmp/gtm-li.json | head -24

echo ""
echo "== POST local-scheduling book (catalog alias) =="
SLOT_START="$(python3 -c 'import datetime,random; d=datetime.date(2026,12,random.randint(1,28)); print(d.isoformat()+"T10:00:00Z")')"
code="$(curl -sS -o /tmp/gtm-book.json -w "%{http_code}" \
  -X POST "${BASE}/api/v1/local-scheduling/api/v1/appointments" \
  -H "Content-Type: application/json" \
  -d "{\"slot_start\":\"${SLOT_START}\",\"patient_name\":\"GTM Demo\",\"organization_id\":1}")" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "book appointment failed"
pretty_json </tmp/gtm-book.json

APPT_ID="$(python3 -c 'import json; print(json.load(open("/tmp/gtm-book.json"))["appointment"]["id"])')"

echo ""
echo "== POST local-scheduling reschedule =="
RESCHED_SLOT="$(python3 -c 'import datetime,random; d=datetime.date(2026,12,random.randint(1,28)); print(d.isoformat()+"T14:00:00Z")')"
code="$(curl -sS -o /tmp/gtm-resched.json -w "%{http_code}" \
  -X POST "${BASE}/api/v1/local-scheduling/api/v1/appointments/reschedule" \
  -H "Content-Type: application/json" \
  -d "{\"appointment_id\":\"${APPT_ID}\",\"slot_start\":\"${RESCHED_SLOT}\",\"organization_id\":1}")" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "reschedule failed"
pretty_json </tmp/gtm-resched.json

echo ""
echo "== POST local-payments payment promise =="
code="$(curl -sS -o /tmp/gtm-pay.json -w "%{http_code}" \
  -X POST "${BASE}/api/v1/local-payments/api/v1/payment-promises" \
  -H "Content-Type: application/json" \
  -d '{"account_reference":"GTM-1","promised_amount":"25.00","organization_id":1}')" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "payment promise failed"
pretty_json </tmp/gtm-pay.json

echo ""
echo "== POST local-integrations outage status =="
code="$(curl -sS -o /tmp/gtm-out.json -w "%{http_code}" \
  -X POST "${BASE}/api/v1/local-integrations/api/v1/outages/status" \
  -H "Content-Type: application/json" \
  -d '{"utility_name":"Demo Utility","service_area_code":"90210","organization_id":1}')" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "outage status failed"
pretty_json </tmp/gtm-out.json

echo ""
echo "== POST local-ehr patient context (Maria Rodriguez demo) =="
code="$(curl -sS -o /tmp/gtm-ehr-ctx.json -w "%{http_code}" \
  -X POST "${BASE}/api/v1/local-ehr/api/v1/patients/context" \
  -H "Content-Type: application/json" \
  -d '{"patient_token":"maria-rodriguez","organization_id":1}')" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "local-ehr patient context failed"
pretty_json </tmp/gtm-ehr-ctx.json | head -24

echo ""
echo "== POST local-ehr prior auth status =="
code="$(curl -sS -o /tmp/gtm-ehr-pa.json -w "%{http_code}" \
  -X POST "${BASE}/api/v1/local-ehr/api/v1/prior-auth/status" \
  -H "Content-Type: application/json" \
  -d '{"patient_token":"maria-rodriguez","procedure_code":"73721","organization_id":1}')" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "local-ehr prior auth failed"
pretty_json </tmp/gtm-ehr-pa.json | head -16

echo ""
echo "== POST local-messaging SMS confirmation =="
code="$(curl -sS -o /tmp/gtm-msg.json -w "%{http_code}" \
  -X POST "${BASE}/api/v1/local-messaging/api/v1/messages/sms" \
  -H "Content-Type: application/json" \
  -d '{"to":"+15550199","body":"Your knee MRI is Tuesday 3pm at MetroWest Imaging.","patient_name":"Maria Rodriguez","organization_id":1}')" || true
echo "HTTP ${code}"
[[ "$code" == "200" ]] || die "local-messaging sms failed"
pretty_json </tmp/gtm-msg.json

if [[ -n "$TOKEN" ]]; then
  echo ""
  echo "== GET local-scheduling/appointments (Bearer) =="
  curl -sS "${BASE}/api/v1/local-scheduling/appointments" \
    -H "Authorization: Bearer ${TOKEN}" | pretty_json | head -30

  echo ""
  echo "== GET local-payments/records (Bearer) =="
  curl -sS "${BASE}/api/v1/local-payments/records" \
    -H "Authorization: Bearer ${TOKEN}" | pretty_json | head -20

  echo ""
  echo "== GET local-integrations/records (Bearer) =="
  curl -sS "${BASE}/api/v1/local-integrations/records" \
    -H "Authorization: Bearer ${TOKEN}" | pretty_json | head -20
else
  echo ""
  echo "(Skip authenticated record lists — set GTM_DEMO_BEARER_TOKEN to verify Settings UI data.)"
fi

echo ""
echo "OK — local scheduling, payments, integrations, EHR, and messaging are ready for GTM (no external stack)."
