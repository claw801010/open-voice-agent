# Catalog buyer demo (MK-01)

**Goal:** one command for sales / SE to install a **complex** catalog variant and land on the **workflow editor + analytics proof** URLs buyers care about.

## Prerequisites

- API running (`ENABLE_LOCAL_SCHEDULING`, `ENABLE_LOCAL_PAYMENTS`, `ENABLE_LOCAL_INTEGRATIONS` on for wire-local demos)
- UI running
- Demo org credentials (`E2E_EMAIL` / `E2E_PASSWORD`)

## Install + print URLs

```bash
export E2E_EMAIL='demo@example.com'
export E2E_PASSWORD='…'
./scripts/catalog-buyer-demo.sh healthcare-clinic-screening
# or one-liner shortcuts (default variant from buyer-demo-defaults.json):
./scripts/buyer-demo-healthcare-ehr.sh
./scripts/buyer-demo-retail-collections.sh
BUYER_DEMO_SEED_CALL=1 ./scripts/buyer-demo-telecom-outage.sh
```

Regenerate shortcuts after editing [buyer-demo-defaults.json](../buyer-demo-defaults.json):

```bash
python3 scripts/gen_buyer_demo_shortcuts.py
```

| Shortcut script | Slug | Default variant |
|-----------------|------|-----------------|
| `buyer-demo-healthcare-ehr.sh` | `healthcare-clinic-screening` | `ehr_sync_complex` |
| `buyer-demo-retail-collections.sh` | `retail-wismo-faq` | `collections_complex` |
| `buyer-demo-telecom-outage.sh` | `telecom-utilities-outage-faq` | `outage_status_complex` |
| `buyer-demo-b2b-conversion.sh` | `b2b-saas-trial-nurture` | `conversion_complex` |
| `buyer-demo-insurance-claims.sh` | `insurance-fnol-faq` | `claims_lookup_complex` |
| `buyer-demo-hospitality-waiver.sh` | `hospitality-travel-concierge` | `waiver_complex` |
| `buyer-demo-banking-balance.sh` | `financial-services-banking-faq` | `balance_lookup_complex` |
| `buyer-demo-franchise-leads.sh` | `smb-franchise-location-faq` | `lead_capture_complex` |
| `buyer-demo-civic-permits.sh` | `public-sector-civic-services-faq` | `permit_status_complex` |
| `buyer-demo-hr-recruiting.sh` | `hr-staffing-recruiting-faq` | `application_status_complex` |

```bash
# explicit variant:
./scripts/catalog-buyer-demo.sh healthcare-clinic-screening ehr_sync_complex
# seed demo call + review inbox item (needs Postgres):
BUYER_DEMO_SEED_CALL=1 ./scripts/catalog-buyer-demo.sh healthcare-clinic-screening
```

High-value verticals — defaults from [buyer-demo-defaults.json](../buyer-demo-defaults.json):

| Vertical | Slug | Default variant | Primary HTTP proof |
|----------|------|-----------------|-------------------|
| Healthcare EHR + HITL | `healthcare-clinic-screening` | `ehr_sync_complex` | `sync_chart_to_ehr` + live workflow |
| Retail collections | `retail-wismo-faq` | `collections_complex` | `capture_payment_promise` |
| B2B conversion | `b2b-saas-trial-nurture` | `conversion_complex` | `update_crm_deal_stage` |
| Insurance claims | `insurance-fnol-faq` | `claims_lookup_complex` | `lookup_claim_status` |
| Hospitality waiver | `hospitality-travel-concierge` | `waiver_complex` | `apply_cancellation_waiver` |
| Banking balance | `financial-services-banking-faq` | `balance_lookup_complex` | `lookup_account_balance` |
| Franchise leads | `smb-franchise-location-faq` | `lead_capture_complex` | `capture_lead_intent` |
| Telecom outage | `telecom-utilities-outage-faq` | `outage_status_complex` | `lookup_outage_status` |
| Civic permits | `public-sector-civic-services-faq` | `permit_status_complex` | `lookup_permit_status` |
| HR recruiting | `hr-staffing-recruiting-faq` | `application_status_complex` | `lookup_application_status` |

```bash
BUYER_DEMO_SEED_CALL=1 ./scripts/catalog-buyer-demo.sh telecom-utilities-outage-faq
```

JSON output includes:

- `workflow_editor_url` — catalog guide card with **Wire local** buttons
- `analytics_overview_url` — vertical widget preset + revenue motions
- `analytics_calls_proof_url` — call list filtered by `catalog_slug`, `catalog_variant_id`, primary `tool_name`
- `review_inbox_url` — when variant is `ehr_sync_complex`
- `settings_local_module_url` — Settings hash for the vertical's local all-in-one module (e.g. `#local-payments`)
- `demo_call_id` / `analytics_call_detail_url` — when `BUYER_DEMO_SEED_CALL=1` (healthcare uses EHR seed; other verticals use [seed_gtm_catalog_demo_call.py](../../scripts/seed_gtm_catalog_demo_call.py))

## Voice previews (ElevenLabs batch)

Regenerate hosted WAV samples for marketplace **Preview voice script**:

```bash
./scripts/regen_catalog_voice_previews.sh
ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… ./scripts/regen_catalog_voice_previews.sh
python3 scripts/generate_catalog_voice_preview_audio.py --check
```

## Marketplace UI (no script)

On **Template catalog**, each pack card links:

- **Analytics proof (HTTP tools)** → filtered call list
- **Overview for this vertical** → Analytics Overview with slug + variant
- **Review inbox (HITL)** → healthcare packs with `ehr_sync_complex`
- **Local demo payments / EHR / integrations** → Settings deep link per vertical ([buyer-demo-defaults.json](../buyer-demo-defaults.json) `settings_sections`)

## Related

- [local-all-in-one-gtm-demo.md](local-all-in-one-gtm-demo.md)
- [prebuild-vertical-demo-matrix.md](prebuild-vertical-demo-matrix.md)
- [http-api-analytics-redaction-gtm-demo.md](http-api-analytics-redaction-gtm-demo.md)
