#!/usr/bin/env bash
# Pull lean OSS models for MK-01 local / hybrid inference profiles (Ollama + Speaches).
#
# Usage (repo root):
#   ./scripts/setup_local_inference.sh
#   SKIP_LOCAL_MODELS=1 ./scripts/setup_local_inference.sh   # no-op
#   LOCAL_INFERENCE_MODELS=llama3.2:3b ./scripts/setup_local_inference.sh
#   LOCAL_INFERENCE_BUNDLE=/path/to/local-inference-bundle.tar.gz ./scripts/setup_local_inference.sh
#
# Requires (optional per runtime):
#   - ollama — LLM pulls (https://ollama.com)
#   - speaches — STT/TTS served separately; this script only documents endpoints
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

info() { echo "==> $*"; }
warn() { echo "WARN: $*" >&2; }

if [[ "${SKIP_LOCAL_MODELS:-}" == "1" ]]; then
  info "SKIP_LOCAL_MODELS=1 — skipping local model downloads."
  exit 0
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Pull Ollama models listed in catalog/inference-profiles.json (local_edge_lean)."
  echo "Env: SKIP_LOCAL_MODELS=1  LOCAL_INFERENCE_MODELS='llama3.2:3b qwen2.5:3b'"
  echo "     LOCAL_INFERENCE_BUNDLE=/path/to/bundle.tar.gz  (air-gapped import)"
  exit 0
fi

if [[ -n "${LOCAL_INFERENCE_BUNDLE:-}" ]]; then
  info "LOCAL_INFERENCE_BUNDLE set — importing Ollama artifacts (air-gapped)."
  bash "$ROOT/scripts/import_local_inference_bundle.sh"
  info "Speaches (STT/TTS) — OpenAI-compatible server on http://127.0.0.1:8100/v1"
  info "  Start: ./scripts/start_local_inference.sh  (Docker Compose profile local-inference)"
  info "Done."
  exit 0
fi

CATALOG="${ROOT}/catalog/inference-profiles.json"
if [[ ! -f "$CATALOG" ]]; then
  warn "Missing $CATALOG"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  warn "python3 required to read inference profile catalog"
  exit 1
fi

OLLAMA_MODELS="$(
  python3 - <<'PY'
import json, os
from pathlib import Path
cat = json.loads(Path("catalog/inference-profiles.json").read_text())
extra = os.environ.get("LOCAL_INFERENCE_MODELS", "").split()
models = []
for p in cat.get("profiles", []):
    if p.get("tier") not in ("local", "hybrid"):
        continue
    for m in p.get("local_models") or []:
        if m.get("runtime") == "ollama" and m.get("model"):
            models.append(m["model"])
for m in extra:
    m = m.strip()
    if m:
        models.append(m)
seen = []
for m in models:
    if m not in seen:
        seen.append(m)
print("\n".join(seen))
PY
)"

if [[ -z "$OLLAMA_MODELS" ]]; then
  info "No Ollama models listed in inference profiles."
else
  if command -v ollama >/dev/null 2>&1; then
    while IFS= read -r model; do
      [[ -z "$model" ]] && continue
      info "ollama pull $model"
      ollama pull "$model"
    done <<< "$OLLAMA_MODELS"
  else
    warn "ollama not installed — skip LLM pulls. Install from https://ollama.com"
    warn "Suggested models:"
    while IFS= read -r model; do
      [[ -z "$model" ]] && continue
      echo "  ollama pull $model"
    done <<< "$OLLAMA_MODELS"
  fi
fi

info "Speaches (STT/TTS) — OpenAI-compatible server on http://127.0.0.1:8100/v1"
info "  Start: ./scripts/start_local_inference.sh  (Docker Compose profile local-inference)"
info "  Docs: https://github.com/speaches-ai/speaches"
info "  Profile STT model: Systran/faster-distil-whisper-small.en"
info "  Profile TTS model: hexgrad/Kokoro-82M"
info ""
info "Ollama LLM endpoint: http://localhost:11434/v1 (profile local_edge_lean)"
info "After services are up, switch profile at Model configurations → Inference profile."
info "Done."
