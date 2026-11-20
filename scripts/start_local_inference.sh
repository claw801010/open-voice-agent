#!/usr/bin/env bash
# Start local edge inference services (Speaches STT/TTS in Docker; Ollama on host).
#
# Usage (repo root):
#   ./scripts/start_local_inference.sh
#   ./scripts/start_local_inference.sh --pull-models   # also run setup_local_inference.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

info() { echo "==> $*"; }

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose-local.yaml}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Start Speaches (STT/TTS) via Docker Compose profile local-inference."
  echo "Ollama LLM: install separately (https://ollama.com) — see setup_local_inference.sh"
  echo "Env: COMPOSE_FILE=docker-compose-local.yaml"
  exit 0
fi

if [[ "${1:-}" == "--pull-models" ]]; then
  bash "$ROOT/scripts/setup_local_inference.sh"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "WARN: docker not found — cannot start Speaches container" >&2
  exit 1
fi

info "Starting Speaches on http://127.0.0.1:8100/v1 (profile: local-inference)…"
docker compose -f "$COMPOSE_FILE" --profile local-inference up -d speaches

info "Speaches STT/TTS endpoint: http://127.0.0.1:8100/v1"
info "Ollama LLM endpoint: http://127.0.0.1:11434/v1"
info "Apply profile at Model configurations → Inference profile → Local edge (lean)."
info "Done."
