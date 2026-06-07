#!/usr/bin/env bash
# MK-01-VOICE-SPOKEN advisory — report silent vs spoken catalog voice previews.
#
# Usage (repo root):
#   ./scripts/check_voice_previews_spoken.sh           # warn if silent (exit 0)
#   ./scripts/check_voice_previews_spoken.sh --strict  # exit 1 when any silent
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -x "${ROOT}/venv/bin/python" ]]; then
  PYTHON="${ROOT}/venv/bin/python"
else
  PYTHON="python3"
fi

STRICT=0
[[ "${1:-}" == "--strict" ]] && STRICT=1

echo "== Catalog voice preview report (MK-01-VOICE-SPOKEN) =="
REPORT="$("${PYTHON}" "${ROOT}/scripts/generate_catalog_voice_preview_audio.py" --report 2>&1)"
echo "$REPORT"

SILENT="$(echo "$REPORT" | sed -n 's/^Summary: .* \([0-9][0-9]*\) silent.*/\1/p' | tail -1)"
SILENT="${SILENT:-0}"

if [[ "$SILENT" -gt 0 ]]; then
  echo ""
  echo "WARN: ${SILENT} silent placeholder preview(s) — MK-01-VOICE-SPOKEN Incomplete."
  echo "  ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… ./scripts/regen_catalog_voice_previews.sh"
  if [[ "$STRICT" == "1" ]]; then
    exit 1
  fi
else
  echo ""
  echo "OK — all catalog voice previews are spoken or custom-sized."
fi

exit 0
