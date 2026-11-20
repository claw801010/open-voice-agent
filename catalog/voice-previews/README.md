# Catalog voice previews (MK-01-VOICE-SPOKEN)

Hosted WAV samples for marketplace **Voice preview** (`GET /api/v1/catalog/vertical-packs/{slug}/voice-preview/audio`).

## Regeneration (fallback chain)

| Priority | Source | When |
|----------|--------|------|
| 1 | **ElevenLabs** | `ELEVENLABS_API_KEY` in `api/.env` + voice id (env or [voice-preview-elevenlabs-ids.json](../voice-preview-elevenlabs-ids.json)) |
| 2 | **Speaches (local)** | `./scripts/regen_catalog_voice_previews.sh --local-tts` with Speaches on `:8100` ([voice-preview-tts-config.json](../voice-preview-tts-config.json)) |
| 3 | **Silent placeholder** | Default on `main` when no keys / no local TTS |

| Action | Command |
|--------|---------|
| Regenerate (auto-detect) | `./scripts/regen_catalog_voice_previews.sh` |
| Regenerate (local Speaches) | `./scripts/regen_catalog_voice_previews.sh --local-tts` |
| Regenerate (silent only) | `python scripts/generate_catalog_voice_preview_audio.py --silent-only` |
| One slug | `./scripts/regen_catalog_voice_previews.sh --slug healthcare-clinic-screening` |
| Inventory check | `python scripts/generate_catalog_voice_preview_audio.py --check` |
| Silent vs spoken report | `python scripts/generate_catalog_voice_preview_audio.py --report` |
| Advisory gate (Incomplete OK) | `./scripts/check_voice_previews_spoken.sh` |
| Strict gate (spoken only) | `./scripts/check_voice_previews_spoken.sh --strict` |

## Per-vertical ElevenLabs voices

Fill [voice-preview-elevenlabs-ids.json](../voice-preview-elevenlabs-ids.json):

- **`by_profile_id`** — one voice per industry preset (construction + handyman share `vertical_trades`)
- **`by_slug`** — override a single pack

Empty values fall back to `ELEVENLABS_VOICE_ID`. Vertical delivery settings (stability, similarity) come from built-in voice profiles.

Files are committed under this directory (`.gitignore` allows `catalog/voice-previews/*.wav` only).
