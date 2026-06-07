#!/usr/bin/env bash
# WE-01-DUALMODE + MK-01 — quick API checks for GTM (analytics + redaction RBAC).
#
# Usage (repo root):
#   export GTM_DEMO_BEARER_TOKEN='…'   # required unless passed as 2nd arg
#   ./scripts/gtm-http-api-analytics-redaction-demo.sh
#   ./scripts/gtm-http-api-analytics-redaction-demo.sh https://api.example.com "$GTM_DEMO_BEARER_TOKEN"
#
# Optional:
#   GTM_DEMO_API_KEY   — if set, runs API-key PUT disable probe (expect 403).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${1:-${BACKEND_API_ENDPOINT:-http://localhost:8000}}"
BASE="${BASE%/}"
TOKEN="${2:-${GTM_DEMO_BEARER_TOKEN:-}}"

pretty_json() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -m json.tool
  else
    cat
  fi
}

die() {
  echo "gtm-http-api-analytics-redaction-demo: $*" >&2
  exit 1
}

[[ -n "$TOKEN" ]] || die "Set GTM_DEMO_BEARER_TOKEN or pass token as second argument."

echo "== GET redaction-policy (Bearer) =="
code_rp="$(curl -sS -o /tmp/gtm-rp.json -w "%{http_code}" \
  "${BASE}/api/v1/analytics/redaction-policy" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Accept: application/json')" || true
echo "HTTP ${code_rp}"
if [[ "$code_rp" == "200" ]]; then
  pretty_json </tmp/gtm-rp.json
else
  cat /tmp/gtm-rp.json >&2 || true
  die "redaction-policy GET failed"
fi

echo ""
echo "== GET analytics insights ?days=7 (Bearer) =="
code_in="$(curl -sS -o /tmp/gtm-in.json -w "%{http_code}" \
  "${BASE}/api/v1/analytics/insights?days=7" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Accept: application/json')" || true
echo "HTTP ${code_in}"
if [[ "$code_in" == "200" ]]; then
  pretty_json </tmp/gtm-in.json
else
  cat /tmp/gtm-in.json >&2 || true
  echo "(insights may be empty or require org context — check HTTP code)" >&2
fi

echo ""
echo "== GET analytics/qm-export-schedule (Bearer) =="
code_qm="$(curl -sS -o /tmp/gtm-qm.json -w "%{http_code}" \
  "${BASE}/api/v1/analytics/qm-export-schedule" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Accept: application/json')" || true
echo "HTTP ${code_qm}"
if [[ "$code_qm" == "200" ]]; then
  pretty_json </tmp/gtm-qm.json
  # MK-01-ANALYTICS-VERTICAL: assert next_run_at_utc matches server contract
  # (non-null iff schedule.enabled and deployment cron_enabled).
  python3 - <<'PY'
import json
import re
import sys

path = "/tmp/gtm-qm.json"
with open(path, encoding="utf-8") as f:
    data = json.load(f)

if "next_run_at_utc" not in data:
    print("gtm-http-api-analytics-redaction-demo: qm-export-schedule missing next_run_at_utc", file=sys.stderr)
    sys.exit(1)

sched = data.get("schedule") or {}
enabled = bool(sched.get("enabled"))
cron_on = bool(data.get("cron_enabled"))
nr = data["next_run_at_utc"]
iso_z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

if enabled and cron_on:
    if nr is None:
        print(
            "gtm-http-api-analytics-redaction-demo: next_run_at_utc expected ISO string "
            "when schedule enabled and cron_enabled",
            file=sys.stderr,
        )
        sys.exit(1)
    if not isinstance(nr, str) or not iso_z.match(nr):
        print(
            "gtm-http-api-analytics-redaction-demo: next_run_at_utc must be ISO-8601 UTC …Z "
            f"(got {nr!r})",
            file=sys.stderr,
        )
        sys.exit(1)
else:
    if nr is not None:
        print(
            "gtm-http-api-analytics-redaction-demo: next_run_at_utc expected null "
            "when schedule disabled or cron_enabled is false "
            f"(got {nr!r})",
            file=sys.stderr,
        )
        sys.exit(1)

print("qm-export-schedule probe: next_run_at_utc OK")
PY
else
  cat /tmp/gtm-qm.json >&2 || true
  echo "(qm-export-schedule may require org context — check HTTP code)" >&2
fi

echo ""
echo "== GET organizations/http-integration-cache-policy (Bearer) =="
code_hp="$(curl -sS -o /tmp/gtm-hp.json -w "%{http_code}" \
  "${BASE}/api/v1/organizations/http-integration-cache-policy" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Accept: application/json')" || true
echo "HTTP ${code_hp}"
if [[ "$code_hp" == "200" ]]; then
  pretty_json </tmp/gtm-hp.json
else
  cat /tmp/gtm-hp.json >&2 || true
  echo "(http-integration-cache-policy may require org context — check HTTP code)" >&2
fi

if [[ -n "${GTM_DEMO_API_KEY:-}" ]]; then
  echo ""
  echo "== GET redaction-policy (X-API-Key) — expect may_disable_detail_redaction false =="
  curl -sS "${BASE}/api/v1/analytics/redaction-policy" \
    -H "X-API-Key: ${GTM_DEMO_API_KEY}" \
    -H 'Accept: application/json' | pretty_json || true

  echo ""
  echo "== PUT redaction-policy disable (X-API-Key) — expect HTTP 403 =="
  code_put="$(curl -sS -o /tmp/gtm-put-ak.json -w "%{http_code}" -X PUT \
    "${BASE}/api/v1/analytics/redaction-policy" \
    -H "X-API-Key: ${GTM_DEMO_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d '{"detail_redaction_enabled":false}')" || true
  echo "HTTP ${code_put}"
  cat /tmp/gtm-put-ak.json >&2 || true
  if [[ "$code_put" != "403" ]]; then
    echo "Note: expected 403 when API keys must not disable redaction (see redaction_policy_rbac.py)." >&2
  fi
else
  echo ""
  echo "(Skip API-key probes: set GTM_DEMO_API_KEY to demonstrate 403 on disable.)"
fi

echo ""
echo "== GET catalog voice-preview (retail + healthcare, no auth) =="
for slug in retail-wismo-faq healthcare-clinic-screening; do
  code_vp="$(curl -sS -o "/tmp/gtm-vp-${slug}.json" -w "%{http_code}" \
    "${BASE}/api/v1/catalog/vertical-packs/${slug}/voice-preview" \
    -H 'Accept: application/json')" || true
  echo "  ${slug}/voice-preview → HTTP ${code_vp}"
  if [[ "$code_vp" == "200" ]]; then
    python3 -c "
import json,sys
d=json.load(open('/tmp/gtm-vp-${slug}.json'))
assert d.get('preview_audio_url','').find('voice-preview/audio')>=0, d
print('    profile:', d.get('profileId') or d.get('profile_id'))
" || die "voice-preview JSON invalid for ${slug}"
    code_audio="$(curl -sS -o /dev/null -w "%{http_code}" \
      "${BASE}/api/v1/catalog/vertical-packs/${slug}/voice-preview/audio")" || true
    echo "    audio → HTTP ${code_audio}"
    [[ "$code_audio" == "200" ]] || die "voice-preview/audio failed for ${slug}"
  else
    die "voice-preview GET failed for ${slug}"
  fi
done

echo ""
echo "Done. UI demo steps: catalog/recipes/http-api-analytics-redaction-gtm-demo.md"
