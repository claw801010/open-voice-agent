#!/usr/bin/env bash
# Regenerate catalog/voice-previews/{slug}.wav for all vertical packs (MK-01-VOICE-SPOKEN).
#
# Fallback chain:
#   1. ElevenLabs when ELEVENLABS_API_KEY (+ ELEVENLABS_VOICE_ID or catalog/voice-preview-elevenlabs-ids.json)
#   2. Speaches local TTS when --local-tts or CATALOG_VOICE_REGEN_LOCAL_TTS=1
#   3. Silent stdlib placeholders (ships on main without keys)
#
# Usage (repo root):
#   ./scripts/regen_catalog_voice_previews.sh
#   ./scripts/regen_catalog_voice_previews.sh --slug healthcare-clinic-screening
#   ./scripts/regen_catalog_voice_previews.sh --local-tts
#   ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… ./scripts/regen_catalog_voice_previews.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/api/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${ROOT}/api/.env"
  set +a
fi

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

ARGS=()
for arg in "$@"; do
  ARGS+=("$arg")
done

LOCAL_TTS=0
for arg in "$@"; do
  [[ "$arg" == "--local-tts" ]] && LOCAL_TTS=1
done

if [[ -n "${ELEVENLABS_API_KEY:-}" ]]; then
  echo "ElevenLabs API key set — synthesizing spoken previews (per-slug ids from catalog/voice-preview-elevenlabs-ids.json when set)."
  if [[ -z "${ELEVENLABS_VOICE_ID:-}" ]] && ! grep -q '"by_slug"' "${ROOT}/catalog/voice-preview-elevenlabs-ids.json" 2>/dev/null; then
    echo "WARN: set ELEVENLABS_VOICE_ID or fill catalog/voice-preview-elevenlabs-ids.json" >&2
  fi
elif [[ "$LOCAL_TTS" == "1" ]] || [[ "${CATALOG_VOICE_REGEN_LOCAL_TTS:-}" =~ ^(1|true|yes)$ ]]; then
  echo "No ElevenLabs key — trying Speaches local TTS (http://127.0.0.1:8100/v1)."
  ARGS+=("--local-tts")
else
  echo "No ELEVENLABS_API_KEY — writing silent WAV placeholders."
  echo "  Spoken local: ./scripts/regen_catalog_voice_previews.sh --local-tts (Speaches on :8100)"
  echo "  Spoken cloud: add keys to api/.env, then re-run this script"
  ARGS+=("--silent-only")
fi

"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" "${ARGS[@]}"

echo ""
"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" --report

echo ""
echo "Done. Hosted at GET /api/v1/catalog/vertical-packs/{slug}/voice-preview/audio"
"${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" --check
