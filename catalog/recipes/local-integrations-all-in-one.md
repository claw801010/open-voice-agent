# All-in-one local integrations (MK-01)

**Goal:** Run **CRM, OSS, ATS, banking, hospitality, and civic** complex variants without buyer API keys. Dograh stores lookup and action records locally with booking-compatible JSON for analytics `mapped_data`.

External systems are optional upgrades.

## Enable (default in local dev)

In `api/.env`:

```bash
ENVIRONMENT=local
ENABLE_LOCAL_INTEGRATIONS=true   # defaults true when ENVIRONMENT=local
BACKEND_API_ENDPOINT=http://127.0.0.1:8000
```

Records persist under **`run/local_integrations/org_{id}.json`**.

## Install from catalog (auto-wired)

When `ENABLE_LOCAL_INTEGRATIONS` is on, **`install-from-catalog`** rewrites these template vars to `{BACKEND}/api/v1/local-integrations`:

| Template variable | Example tools |
|-------------------|---------------|
| `oss_api_base_url` | `lookup_outage_status` |
| `crm_api_base_url` | `update_crm_deal_stage`, `capture_lead_intent`, `sync_crm_health` |
| `ats_api_base_url` | `lookup_application_status` |
| `product_api_base_url` | `offer_warranty_addon` |
| `quoting_api_base_url` | `capture_quote_intent` |
| `claims_api_base_url` | `lookup_claim_status` |
| `pms_api_base_url` | `modify_reservation` |
| `policy_api_base_url` | `apply_cancellation_waiver` |
| `crs_api_base_url` | `offer_room_upgrade` |
| `banking_api_base_url` | `lookup_account_balance` |
| `cards_api_base_url` | `report_card_lost_stolen` |
| `locations_api_base_url` | `route_call_to_location` |
| `records_api_base_url` | `lookup_permit_status` |
| `routing_api_base_url` | `route_by_language` |

Or use **Wire local integrations** on the workflow editor catalog guide card (creates tools + sets URLs).

## Reschedule (local scheduling)

**Confirm / remind** and **interview confirm** variants use **`scheduling_api_base_url`** + `POST …/api/v1/appointments/reschedule` — see [local-scheduling-all-in-one.md](local-scheduling-all-in-one.md). **Wire local calendar** creates `reschedule_appointment` / `confirm_or_reschedule_interview` tools when needed.

## UI smoke test

**Settings → Local demo integrations** — view recorded actions after a voice HTTP tool call.

**Related:** [local-scheduling-all-in-one.md](local-scheduling-all-in-one.md), [local-payments-all-in-one.md](local-payments-all-in-one.md), [prebuild-vertical-demo-matrix.md](prebuild-vertical-demo-matrix.md).
