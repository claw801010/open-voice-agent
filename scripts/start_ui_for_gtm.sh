#!/usr/bin/env bash
# Start UI for Playwright GTM capture (stable on :3000).
#
# Prefers production standalone when .next/standalone exists; otherwise next dev.
# Usage (repo root):
#   ./scripts/start_ui_for_gtm.sh
#   ./scripts/start_ui_for_gtm.sh --foreground
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI="${ROOT}/ui"
FOREGROUND=0
USE_DEV=0
for arg in "$@"; do
  [[ "$arg" == "--foreground" ]] && FOREGROUND=1
  [[ "$arg" == "--dev" ]] && USE_DEV=1
done

cd "$UI"
if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
fi

export PORT="${PORT:-3000}"
# Do not use shell HOSTNAME (machine name) — bind loopback for Playwright.
export GTM_UI_HOST="${GTM_UI_HOST:-127.0.0.1}"
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
export NEXT_PUBLIC_BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL:-$BACKEND_URL}"
export HOSTNAME="$GTM_UI_HOST"

STANDALONE_SERVER="${UI}/.next/standalone/open-voice-agent/ui/server.js"
if [[ "$USE_DEV" != "1" && -f "$STANDALONE_SERVER" ]]; then
  mkdir -p "${UI}/.next/standalone/open-voice-agent/ui/.next"
  rsync -a "${UI}/.next/static/" "${UI}/.next/standalone/open-voice-agent/ui/.next/static/" 2>/dev/null || true
  rsync -a "${UI}/public/" "${UI}/.next/standalone/open-voice-agent/ui/public/" 2>/dev/null || true
  echo "Starting Next.js standalone on http://${HOSTNAME}:${PORT} …"
  if [[ "$FOREGROUND" == "1" ]]; then
    exec node "$STANDALONE_SERVER"
  fi
  nohup node "$STANDALONE_SERVER" > /tmp/ova-ui-gtm.log 2>&1 &
else
  if [[ ! -d "${UI}/.next" ]]; then
    echo "No .next build — run: cd ui && npm run build" >&2
    exit 1
  fi
  echo "Starting next dev on http://${HOSTNAME}:${PORT} …"
  if [[ "$FOREGROUND" == "1" ]]; then
    exec npm run dev -- --hostname "$HOSTNAME" --port "$PORT"
  fi
  nohup npm run dev -- --hostname "$HOSTNAME" --port "$PORT" > /tmp/ova-ui-gtm.log 2>&1 &
fi

for _ in $(seq 1 90); do
  if curl -sf "http://${HOSTNAME}:${PORT}/templates" >/dev/null 2>&1; then
    echo "OK — UI ready at http://${HOSTNAME}:${PORT}"
    exit 0
  fi
  sleep 2
done

echo "ERROR: UI did not become ready — see /tmp/ova-ui-gtm.log" >&2
tail -20 /tmp/ova-ui-gtm.log >&2 || true
exit 1
