#!/usr/bin/env bash
# Regenerate catalog/voice-previews/{slug}.wav for all vertical packs (MK-01 depth).
#
# Without ELEVENLABS_API_KEY: writes short silent WAV placeholders (stdlib only).
# With ELEVENLABS_API_KEY (+ ELEVENLABS_VOICE_ID): synthesizes speech via ElevenLabs + ffmpeg.
#
# Usage (repo root):
#   ./scripts/regen_catalog_voice_previews.sh
#   ./scripts/regen_catalog_voice_previews.sh --slug healthcare-clinic-screening
#   ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… ./scripts/regen_catalog_voice_previews.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

ARGS=()
for arg in "$@"; do
  ARGS+=("$arg")
done

if [[ -n "${ELEVENLABS_API_KEY:-}" ]]; then
  echo "ElevenLabs API key set — synthesizing spoken previews where possible."
  if [[ -z "${ELEVENLABS_VOICE_ID:-}" ]]; then
    echo "WARN: set ELEVENLABS_VOICE_ID for spoken output (using silent fallback per slug otherwise)." >&2
  fi
else
  echo "No ELEVENLABS_API_KEY — writing silent WAV placeholders."
  ARGS+=("--silent-only")
fi

"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" "${ARGS[@]}"

echo ""
"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" --report

echo ""
echo "Done. Hosted at GET /api/v1/catalog/vertical-packs/{slug}/voice-preview/audio"
"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" --check
