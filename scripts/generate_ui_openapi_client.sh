#!/usr/bin/env bash
# Regenerate UI API clients.
#
# Workflow import (no running API required):
#   python scripts/gen_workflow_import_openapi.py
#   cd ui && npm run generate-client:workflow-import
#
# Full Dograh API (API must be on :8000):
#   OPENAPI_URL=http://127.0.0.1:8000/api/v1/openapi.json bash scripts/generate_ui_openapi_client.sh --full
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Regenerating workflow-import OpenAPI + client..."
python "${ROOT}/scripts/gen_workflow_import_openapi.py"
(
  cd "${ROOT}/ui"
  npm run generate-client:workflow-import
)

if [[ "${1:-}" == "--full" ]]; then
  SNAPSHOT="${ROOT}/ui/.openapi.snapshot.json"
  if [[ "${2:-}" == "--offline" ]] || ! curl -sf "${OPENAPI_URL:-http://127.0.0.1:8000/api/v1/openapi.json}" -o /dev/null 2>/dev/null; then
    echo "Exporting full OpenAPI from api.app (offline)..."
    PYTHONPATH="${ROOT}" LOG_LEVEL=WARNING python "${ROOT}/scripts/export_openapi_json.py" > "${SNAPSHOT}"
  else
    OPENAPI_URL="${OPENAPI_URL:-http://127.0.0.1:8000/api/v1/openapi.json}"
    echo "Fetching full OpenAPI from ${OPENAPI_URL}..."
    curl -sf "${OPENAPI_URL}" -o "${SNAPSHOT}"
  fi
  (
    cd "${ROOT}/ui"
    OPENAPI_INPUT="${SNAPSHOT}" npm run generate-client
  )
  echo "Review: git diff ui/src/client"
fi

echo "Done. Review: git diff ui/src/client/workflowImport catalog/openapi/workflow-import.openapi.json"
