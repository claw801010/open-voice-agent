#!/usr/bin/env bash
# WE-01-VISUAL-DEPTH — headless Lighthouse (public and optional authenticated via Cookie header file).
#
# Public (no cookie):
#   npm run dev
#   npm run perf:lighthouse
#   npm run perf:lighthouse:mobile
#
# Authenticated (copy lighthouse-extra-headers.example.json → lighthouse-extra-headers.local.json):
#   npm run perf:lighthouse:auth
#   # or: LIGHTHOUSE_PATHS="/usage" LIGHTHOUSE_EXTRA_HEADERS_FILE=./lighthouse-extra-headers.local.json npm run perf:lighthouse
# One-shot (cookie from OSS login/signup + auth + dual summary): npm run perf:lighthouse:auth:full — see lighthouse-auth-full.sh
#
# Environment:
#   BASE_URL            default http://127.0.0.1:3000 (use the same host Next prints, e.g. localhost, or Turbopack /_next loads may fail in headless Chrome)
#   LIGHTHOUSE_PATHS    default "/templates", or "/usage /workflow/catalog" with cookie file
#   LIGHTHOUSE_EXTRA_HEADERS_FILE  JSON file of HTTP headers (see lighthouse-extra-headers.example.json)
#   LIGHTHOUSE_OUT_DIR  default .lighthouse (under ui/, gitignored)
#   LIGHTHOUSE_CPU_SLOWDOWN  default 4
#   LIGHTHOUSE_WAIT_SECS  default 90
#   LIGHTHOUSE_FORM_FACTOR  default desktop (mobile for perf:lighthouse:mobile)
#   LIGHTHOUSE_SKIP_WAIT  if 1, skip per-path HTTP wait (e.g. auth routes where curl has no session)
#   LIGHTHOUSE_AUTH_EXAMPLE  if 1 (npm run perf:lighthouse:auth), set paths + default header file
#
# Pure DevTools runs (no cookies in repo) remain valid — see READMENEWRELEASES.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${LIGHTHOUSE_AUTH_EXAMPLE:-0}" == "1" ]]; then
  PATHS="${LIGHTHOUSE_PATHS:-/usage /workflow/catalog}"
  export LIGHTHOUSE_EXTRA_HEADERS_FILE="${LIGHTHOUSE_EXTRA_HEADERS_FILE:-lighthouse-extra-headers.local.json}"
  export LIGHTHOUSE_SKIP_WAIT="${LIGHTHOUSE_SKIP_WAIT:-1}"
else
  PATHS="${LIGHTHOUSE_PATHS:-/templates}"
fi

OUT_DIR="${LIGHTHOUSE_OUT_DIR:-.lighthouse}"
mkdir -p "$OUT_DIR"
BASE="${BASE_URL:-http://127.0.0.1:3000}"
STAMP="$(date +%Y%m%d-%H%M%S)"
CPU="${LIGHTHOUSE_CPU_SLOWDOWN:-4}"
FORM="${LIGHTHOUSE_FORM_FACTOR:-desktop}"
HEADER_FILE_ABS=""

if [[ -n "${LIGHTHOUSE_EXTRA_HEADERS_FILE:-}" ]]; then
  if [[ "${LIGHTHOUSE_EXTRA_HEADERS_FILE}" = /* ]]; then
    HEADER_FILE_ABS="${LIGHTHOUSE_EXTRA_HEADERS_FILE}"
  else
    HEADER_FILE_ABS="${ROOT}/${LIGHTHOUSE_EXTRA_HEADERS_FILE}"
  fi
  if [[ ! -f "${HEADER_FILE_ABS}" ]]; then
    echo "ERROR: LIGHTHOUSE_EXTRA_HEADERS_FILE not found: ${HEADER_FILE_ABS}"
    echo "  Copy lighthouse-extra-headers.example.json to lighthouse-extra-headers.local.json and paste a Cookie (see file header in README / READMENEWRELEASES)."
    exit 1
  fi
  if [[ -z "${LIGHTHOUSE_SKIP_WAIT+x}" ]]; then
    LIGHTHOUSE_SKIP_WAIT=1
  fi
fi

auth_warn_for_path() {
  local p="$1"
  if [[ -n "${HEADER_FILE_ABS}" ]]; then
    return 0
  fi
  if [[ "$p" == /usage* ]] || [[ "$p" == *workflow/catalog* ]]; then
    echo "WARNING: ${p} is usually behind auth. Set LIGHTHOUSE_EXTRA_HEADERS_FILE=... (see lighthouse-extra-headers.example.json) or you may get the sign-in / wrong document."
  fi
}

wait_for_http() {
  local url="$1"
  if [[ "${LIGHTHOUSE_SKIP_WAIT:-0}" == "1" ]]; then
    echo "==> Skipping HTTP preflight (LIGHTHOUSE_SKIP_WAIT=1) for ${url}"
    return 0
  fi
  local max="${LIGHTHOUSE_WAIT_SECS:-90}"
  local i=0
  echo "==> Waiting up to ${max}s for ${url} ..."
  while (( i < max )); do
    if curl -sf -o /dev/null "$url"; then
      echo "==> Server ready (${i}s)"
      return 0
    fi
    sleep 1
    ((i += 1)) || true
  done
  echo "ERROR: no HTTP response from ${url} after ${max}s (start Next: npm run dev; or set LIGHTHOUSE_SKIP_WAIT=1 for auth-only header runs)"
  return 1
}

lighthouse_mode_args() {
  if [[ "${FORM}" == "mobile" ]]; then
    printf '%s\n' --form-factor=mobile --throttling-method=simulate "--throttling.cpuSlowdownMultiplier=${CPU}"
  else
    printf '%s\n' --preset=desktop --throttling-method=simulate "--throttling.cpuSlowdownMultiplier=${CPU}"
  fi
}

run_one() {
  local path="$1"
  local name
  name="$(echo "$path" | sed 's|^/||;s|/|_|g')"
  if [[ -z "$name" ]]; then
    name="root"
  fi
  local suffix=""
  if [[ "${FORM}" == "mobile" ]]; then
    suffix="-mobile"
  fi
  local auth_suffix=""
  if [[ -n "${HEADER_FILE_ABS}" ]]; then
    auth_suffix="-authed"
  fi
  local prefix="${OUT_DIR}/${STAMP}-${name}${suffix}${auth_suffix}.report"
  echo "==> Lighthouse ${BASE}${path}  (form-factor=${FORM}, cpuSlowdown=${CPU}x) -> ${prefix}.(html|json)"
  # shellcheck disable=SC2046,SC2086
  npx --yes lighthouse@11.7.1 "${BASE}${path}" \
    $(lighthouse_mode_args) \
    --only-categories=performance,accessibility \
    --quiet \
    --output=json,html \
    --output-path="${prefix}" \
    ${HEADER_FILE_ABS:+--extra-headers="${HEADER_FILE_ABS}"} \
    --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage --ignore-certificate-errors"
}

read -r -a PATH_ARRAY <<<"${PATHS}"
for p in "${PATH_ARRAY[@]}"; do
  [[ -z "${p}" ]] && continue
  [[ "${p}" != /* ]] && p="/${p}"
  auth_warn_for_path "${p}"
  wait_for_http "${BASE}${p}"
  run_one "${p}"
done

echo "Done. Open HTML reports under ${OUT_DIR}/ (${FORM})."
