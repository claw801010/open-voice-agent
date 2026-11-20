# Outstanding / deferred work (MK-01)

Items **shipped in repo** but intentionally **not finished** — safe to demo offline. Ask *“what’s outstanding?”* or say *“I’m ready for voice previews”* to pick these up.

## MK-01-VOICE-SPOKEN (slice 2) — spoken catalog WAVs

**Status:** Deferred (slice 1 regen infrastructure is **Done**)

**Why deferred:** Requires `ELEVENLABS_API_KEY` + voice id(s), or local Speaches on `:8100`. Silent placeholders ship on `main` and do not block verify.

**When ready:**

```bash
# Option A — ElevenLabs (cloud)
# Fill api/.env and optionally catalog/voice-preview-elevenlabs-ids.json
./scripts/regen_catalog_voice_previews.sh
./scripts/check_voice_previews_spoken.sh --strict   # must show 0 silent

# Option B — Speaches (local Kokoro)
./scripts/regen_catalog_voice_previews.sh --local-tts
```

**Acceptance:** all **14** `catalog/voice-previews/{slug}.wav` files are spoken (not ≤20 KB silent placeholders); optional GTM frame refresh for natural-delivery copy.

**Docs:** [voice-previews/README.md](voice-previews/README.md), [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md) § MK-01-VOICE-SPOKEN.

---

## Optional polish (not blocking)

| Item | Notes |
|------|--------|
| OpenAPI client regen | ~~New analytics `capability_module_id` param~~ — run `bash scripts/generate_ui_openapi_client.sh --full --offline` when API routes change |
| Live GTM deck capture | `./scripts/gtm_capture_deck.sh` when API+UI+Postgres up |
| Strict voice gate in CI | `./scripts/check_voice_previews_spoken.sh --strict` after slice 2 |

---

## Quick status command

```bash
./scripts/check_voice_previews_spoken.sh          # advisory — OK while silent
python3 scripts/generate_catalog_voice_preview_audio.py --report
./scripts/check_buyer_demo_matrix.sh              # 14-vertical matrix (no API)
```
