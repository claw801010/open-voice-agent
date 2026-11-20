#!/usr/bin/env bash
# Export a tarball of Ollama model artifacts for air-gapped local inference installs.
#
# Usage (repo root, connected machine with models already pulled):
#   ./scripts/setup_local_inference.sh
#   ./scripts/export_local_inference_bundle.sh
#   ./scripts/export_local_inference_bundle.sh -o /tmp/local-inference-bundle.tar.gz
#   ./scripts/export_local_inference_bundle.sh --include-speaches-cache
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

OUTPUT="dist/local-inference-bundle.tar.gz"
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Export Ollama manifests/blobs for catalog/local_edge_lean into a tarball."
      echo "Run setup_local_inference.sh first on a connected machine."
      echo "Options: -o PATH  --include-speaches-cache"
      exit 0
      ;;
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    --include-speaches-cache)
      EXTRA+=(--include-speaches-cache)
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "==> Exporting local inference bundle to ${OUTPUT}"
"${PYTHON}" "${ROOT}/scripts/local_inference_bundle.py" export -o "${OUTPUT}" "${EXTRA[@]}"
echo "==> Done. Copy ${OUTPUT} to air-gapped hosts and run:"
echo "    LOCAL_INFERENCE_BUNDLE=${OUTPUT} ./scripts/setup_local_inference.sh"
