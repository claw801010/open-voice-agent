# Catalog voice previews (MK-01)

Hosted WAV samples for marketplace **Voice preview** (`GET /api/v1/catalog/vertical-packs/{slug}/voice-preview/audio`).

| Action | Command |
|--------|---------|
| Regenerate (silent placeholders) | `./scripts/regen_catalog_voice_previews.sh` |
| Regenerate (ElevenLabs speech) | Add `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` to `api/.env`, then `./scripts/regen_catalog_voice_previews.sh` |
| Inventory check | `python scripts/generate_catalog_voice_preview_audio.py --check` |
| Silent vs spoken report | `python scripts/generate_catalog_voice_preview_audio.py --report` |
| Advisory gate (Incomplete OK) | `./scripts/check_voice_previews_spoken.sh` |
| Strict gate (spoken only) | `./scripts/check_voice_previews_spoken.sh --strict` |

Files are committed under this directory (`.gitignore` allows `catalog/voice-previews/*.wav` only).
