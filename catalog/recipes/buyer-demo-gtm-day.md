# Buyer demo + GTM day (MK-01)

**Audience:** sales / SE / solutions engineer running a **10-vertical** local all-in-one demo without external buyer systems.

**Time:** ~45 minutes (offline checks 5 min · stack 10 min · seed + walkthrough 30 min).

## Before the meeting (offline)

```bash
./scripts/verify_mk01_buyer_shipped.sh
```

Confirms: buyer defaults/hints/scripts, **41** GTM PNG frames on disk, voice WAV inventory, pytest + Vitest.

## Start stack

```bash
./scripts/start_mk01_gtm_stack.sh
# Terminal 1: uvicorn api.app:app --reload --port 8000  (ENABLE_LOCAL_* in api/.env)
# Terminal 2: cd ui && npm run dev
```

## Seed demo org (API + Postgres up)

```bash
export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
./scripts/gtm_buyer_demo_pack.sh --seed-workflows --seed-calls
# Or install one vertical:
./scripts/buyer-demo-retail-collections.sh
BUYER_DEMO_SEED_CALL=1 ./scripts/buyer-demo-healthcare-ehr.sh
```

## Demo flow (per vertical)

1. **Template catalog** — buyer-demo strip, **Preview voice**, **Try (Web)** / **LoopTalk** (buyer variant pre-selected).
2. **Install** → **Customize** → catalog guide **Wire local** (calendar / payments / integrations / EHR / messaging).
3. **Web test** or **LoopTalk** from marketplace or editor.
4. **Analytics → Calls** — proof link from pack card; open call detail for HTTP **mapped_data**.
5. **Settings** — local demo module records (payments, integrations, EHR, calendar).

Matrix: [prebuild-vertical-demo-matrix.md](prebuild-vertical-demo-matrix.md)

## Refresh live deck shots (after UI/API changes)

```bash
./scripts/gtm_live_capture_ready.sh --run-capture
# Expect: 42 passed — PNGs under docs/images/gtm-mk01-*.png
```

## Spoken voice previews (MK-01-VOICE-SPOKEN — Incomplete until regen)

```bash
./scripts/check_voice_previews_spoken.sh
ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… ./scripts/regen_catalog_voice_previews.sh
./scripts/check_voice_previews_spoken.sh --strict   # gate: 0 silent
```

## Land the slice (MK-01-SHIP-PR — Incomplete until merge)

```bash
./scripts/prepare_mk01_pr.sh
./scripts/prepare_mk01_pr.sh --dry-stage 1   # preview split PR file lists
./scripts/prepare_mk01_pr.sh --stage all     # git add (no commit)
```

## Related

- [catalog-buyer-demo.md](catalog-buyer-demo.md)
- [local-all-in-one-gtm-demo.md](local-all-in-one-gtm-demo.md)
- [http-api-analytics-redaction-gtm-demo.md](http-api-analytics-redaction-gtm-demo.md)
