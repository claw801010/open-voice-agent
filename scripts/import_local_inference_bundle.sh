#!/usr/bin/env bash
# Import an air-gapped local inference bundle (Ollama manifests/blobs).
#
# Usage (repo root):
#   ./scripts/import_local_inference_bundle.sh /path/to/local-inference-bundle.tar.gz
#   LOCAL_INFERENCE_BUNDLE=/path/to/bundle.tar.gz ./scripts/setup_local_inference.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

BUNDLE="${1:-${LOCAL_INFERENCE_BUNDLE:-}}"

if [[ -z "$BUNDLE" ]]; then
  echo "Usage: $0 /path/to/local-inference-bundle.tar.gz" >&2
  echo "Or set LOCAL_INFERENCE_BUNDLE." >&2
  exit 1
fi

if [[ ! -f "$BUNDLE" ]]; then
  echo "ERROR: bundle not found: $BUNDLE" >&2
  exit 1
fi

echo "==> Importing local inference bundle from ${BUNDLE}"
"${PYTHON}" "${ROOT}/scripts/local_inference_bundle.py" import "$BUNDLE"
echo "==> Ollama models imported. Start Ollama, then ./scripts/start_local_inference.sh"
