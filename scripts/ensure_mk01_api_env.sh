#!/usr/bin/env bash
# Idempotently append MK-01 local all-in-one flags to api/.env.
#
# Usage (repo root):
#   ./scripts/ensure_mk01_api_env.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/api/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f "${ROOT}/api/.env.example" ]]; then
    cp "${ROOT}/api/.env.example" "${ENV_FILE}"
    echo "Created api/.env from api/.env.example"
  else
    echo "ERROR: api/.env missing and no api/.env.example" >&2
    exit 1
  fi
fi

ensure_api_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    return 0
  fi
  echo "${key}=${value}" >>"${ENV_FILE}"
  echo "Appended ${key}=${value} to api/.env"
}

ensure_api_env ENVIRONMENT local
ensure_api_env ENABLE_LOCAL_SCHEDULING true
ensure_api_env ENABLE_LOCAL_PAYMENTS true
ensure_api_env ENABLE_LOCAL_INTEGRATIONS true
ensure_api_env ENABLE_LOCAL_EHR true
ensure_api_env ENABLE_LOCAL_MESSAGING true
