# GTM demo: all-in-one local vertical stack (MK-01)

**Audience:** sales engineering, solutions, buyer technical deep-dive.  
**Time:** ~10 minutes live (or **2 minutes API-only** with [gtm-local-all-in-one-demo.sh](../../scripts/gtm-local-all-in-one-demo.sh)).

## Story arc

1. **Zero external deps** — Dograh runs booking, payments, and buyer integrations in-process (`ENABLE_LOCAL_*` flags; default on in `ENVIRONMENT=local`).
2. **Install** — Template catalog → complex variant (e.g. telecom `outage_status_complex`); **`install-from-catalog`** auto-wires `*_api_base_url` template vars.
3. **Wire** — Workflow editor catalog guide card → **Wire local calendar / payments / integrations** (one click each).
4. **Prove** — Web test call → **Analytics → call detail** shows HTTP spans + **`mapped_data`**.
5. **Governance** — Optional tie-in to [http-api-analytics-redaction-gtm-demo.md](http-api-analytics-redaction-gtm-demo.md) for PII redaction + QM export.

## Prerequisites

- API + UI running locally or on staging.
- `api/.env`: `ENVIRONMENT=local`, `ENABLE_LOCAL_SCHEDULING=true`, `ENABLE_LOCAL_PAYMENTS=true`, `ENABLE_LOCAL_INTEGRATIONS=true`.
- Signed-in operator account for UI steps.

## API smoke (no auth)

```bash
./scripts/gtm-local-all-in-one-demo.sh
# With Settings record verification:
export GTM_DEMO_BEARER_TOKEN='…'
./scripts/gtm-local-all-in-one-demo.sh
```

Exercises: config endpoints, book + reschedule, payment promise, outage status lookup — all booking-shaped JSON for **`response_mapping`**.

## UI checklist

| Step | Where | Talking point |
|------|--------|----------------|
| A | **Settings → Local demo calendar** | Persisted appointments + `.ics` invites; open schedule config. |
| B | **Settings → Local demo payments** | Collections + redirect + concierge enroll URLs. |
| C | **Settings → Local demo integrations** | CRM/OSS/ATS/banking/civic endpoints; recorded actions table. |
| D | **Workflow → Template catalog** | Install complex variant; show auto-wired template variables. |
| E | **Workflow editor** — teal **Catalog guide** card | **Wire local calendar / payments / integrations** creates HTTP tools + sets URLs. |
| F | **Web test** | Voice call invokes wired tools; no buyer API keys. |
| G | **Analytics → Calls** | Filter by `catalog_slug`, `catalog_variant_id`, `tool_name`; **`mapped_data`** on detail. |

## Variant quick picks

See [prebuild-vertical-demo-matrix.md](prebuild-vertical-demo-matrix.md) for slug × variant × tool × local endpoint.

| Buyer story | Slug | Variant | Wire button |
|-------------|------|---------|-------------|
| Book visit | `healthcare-clinic-screening` | `booking_complex` | Wire local calendar |
| EHR + SMS + review | `healthcare-clinic-screening` | `ehr_sync_complex` | Wire local EHR + messaging (+ calendar) |
| Reschedule / no-show | `healthcare-clinic-screening` | `confirm_remind` | Wire local calendar |
| Collections | `retail-wismo-faq` | `collections_complex` | Wire local payments |
| Outage status | `telecom-utilities-outage-faq` | `outage_status_complex` | Wire local integrations |
| CRM conversion | `b2b-saas-trial-nurture` | `conversion_complex` | Wire local integrations |
| Banking balance | `financial-services-banking-faq` | `balance_lookup_complex` | Wire local integrations |
| Guest waiver | `hospitality-travel-concierge` | `waiver_complex` | Wire local integrations |

## Related recipes

- [local-scheduling-all-in-one.md](local-scheduling-all-in-one.md)
- [local-payments-all-in-one.md](local-payments-all-in-one.md)
- [local-integrations-all-in-one.md](local-integrations-all-in-one.md)
- [booking-http-analytics-smoke.md](booking-http-analytics-smoke.md)

## Screenshot (deck)

Capture deck PNGs with `./scripts/gtm_capture_deck.sh` (`E2E_GTM_DECK_SCREENSHOTS=1`):

| File | What to show |
|------|----------------|
| `gtm-mk01-settings-local-all-in-one.png` | **Settings** — local demo calendar + payments + integrations cards |
| `gtm-mk01-workflow-catalog-guide-wire-local.png` | Workflow editor — catalog guide **Wire local** buttons (needs seeded catalog workflow) |
| `gtm-mk01-workflow-wire-ehr-messaging.png` | Workflow editor — **Wire local EHR** + **Wire local messaging** (`ehr_sync_complex`) |
| `gtm-mk01-workflow-wire-retail-payments.png` | Workflow editor — **Wire local payments** (`collections_complex`) |
| `gtm-mk01-workflow-wire-telecom-integrations.png` | Workflow editor — **Wire local integrations** (`outage_status_complex`) |
| `gtm-mk01-workflow-wire-b2b-integrations.png` | Workflow editor — **Wire local integrations** (`conversion_complex`) |
| `gtm-mk01-workflow-wire-insurance-integrations.png` | Workflow editor — **Wire local integrations** (`claims_lookup_complex`) |
| `gtm-we01-voice-profiles-natural-delivery.png` | **Voice profiles** — **Natural delivery** editor on **Authentic — natural** |

If API/UI are not up, [gen_gtm_deck_placeholder_pngs.py](../../scripts/gen_gtm_deck_placeholder_pngs.py) writes **1280×720 placeholders** for missing filenames (same names — swap for real captures before buyer GTM). Preflight: `./scripts/check_gtm_capture_prereqs.sh`.

After install, **Preview analytics** on the catalog guide card deep-links to **Calls** with `catalog_slug`, `catalog_variant_id`, and the primary HTTP tool filter pre-filled.
