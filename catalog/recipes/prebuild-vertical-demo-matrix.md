# PREBUILD vertical demo matrix (MK-01)

**Goal:** one-page map from **catalog slug** → **complex variant** → **HTTP tool** → **local endpoint** for GTM and QA.

**Prerequisites:** all-in-one local modules (no `:8765` stub required):

- [local-scheduling-all-in-one.md](local-scheduling-all-in-one.md) — booking + reschedule
- [local-payments-all-in-one.md](local-payments-all-in-one.md) — collections, payment redirect, concierge enroll
- [local-integrations-all-in-one.md](local-integrations-all-in-one.md) — CRM, OSS, ATS, banking, civic, hospitality actions

## Matrix

| `catalog_slug` | `catalog_variant_id` | HTTP tool | Local endpoint |
|----------------|----------------------|-----------|----------------|
| `healthcare-clinic-screening` | `booking_complex` | `book_slot` | `POST {scheduling}/api/v1/appointments` |
| `healthcare-clinic-screening` | `ehr_sync_complex` | `sync_chart_to_ehr` | `POST {ehr}/api/v1/chart/sync` |
| `healthcare-clinic-screening` | `confirm_remind` | `reschedule_appointment` | `POST {scheduling}/api/v1/appointments/reschedule` |
| `healthcare-clinic-screening` | `concierge_complex` | `enroll_concierge_visit` | `POST {payments}/api/v1/visits/enroll` |
| `retail-wismo-faq` | `collections_complex` | `capture_payment_promise` | `POST {payments}/api/v1/payment-promises` |
| `retail-wismo-faq` | `upsell_complex` | `offer_warranty_addon` | `POST {integrations}/api/v1/offers/attach` |
| `b2b-saas-trial-nurture` | `renewal_complex` | `book_qbr` | `POST {scheduling}/api/v1/appointments` |
| `b2b-saas-trial-nurture` | `conversion_complex` | `update_crm_deal_stage` | `POST {integrations}/api/v1/deals/stage` |
| `insurance-fnol-faq` | `quote_complex` | `capture_quote_intent` | `POST {integrations}/api/v1/quotes/intent` |
| `insurance-fnol-faq` | `claims_lookup_complex` | `lookup_claim_status` | `POST {integrations}/api/v1/claims/status` |
| `hospitality-travel-concierge` | `waiver_complex` | `apply_cancellation_waiver` | `POST {integrations}/api/v1/cancellations/waiver` |
| `hospitality-travel-concierge` | `upsell_complex` | `offer_room_upgrade` | `POST {integrations}/api/v1/offers/attach` |
| `financial-services-banking-faq` | `balance_lookup_complex` | `lookup_account_balance` | `POST {integrations}/api/v1/accounts/balance` |
| `financial-services-banking-faq` | `card_block_complex` | `report_card_lost_stolen` | `POST {integrations}/api/v1/cards/block` |
| `smb-franchise-location-faq` | `location_router_complex` | `route_call_to_location` | `POST {integrations}/api/v1/locations/route` |
| `smb-franchise-location-faq` | `lead_capture_complex` | `capture_lead_intent` | `POST {integrations}/api/v1/leads/intent` |
| `telecom-utilities-outage-faq` | `outage_status_complex` | `lookup_outage_status` | `POST {integrations}/api/v1/outages/status` |
| `telecom-utilities-outage-faq` | `payment_redirect_complex` | `confirm_payment_redirect` | `POST {payments}/api/v1/payments/redirect/confirm` |
| `hr-staffing-recruiting-faq` | `application_status_complex` | `lookup_application_status` | `POST {integrations}/api/v1/applications/status` |
| `hr-staffing-recruiting-faq` | `interview_confirm_complex` | `confirm_or_reschedule_interview` | `POST {scheduling}/api/v1/appointments/reschedule` |
| `public-sector-civic-services-faq` | `permit_status_complex` | `lookup_permit_status` | `POST {integrations}/api/v1/permits/status` |
| `public-sector-civic-services-faq` | `language_router_complex` | `route_by_language` | `POST {integrations}/api/v1/calls/route-by-language` |

`{scheduling}` = `{BACKEND}/api/v1/local-scheduling` · `{payments}` = `{BACKEND}/api/v1/local-payments` · `{integrations}` = `{BACKEND}/api/v1/local-integrations` · `{ehr}` = `{BACKEND}/api/v1/local-ehr` · `{messaging}` = `{BACKEND}/api/v1/local-messaging`

**Workflow editor:** use **Wire local calendar / payments / integrations** on the catalog guide card after install.

**GTM demo:** [local-all-in-one-gtm-demo.md](local-all-in-one-gtm-demo.md) + `./scripts/gtm-local-all-in-one-demo.sh`

**Buyer install + URLs:** [catalog-buyer-demo.md](catalog-buyer-demo.md) + `./scripts/catalog-buyer-demo.sh <slug>` (defaults in [buyer-demo-defaults.json](../buyer-demo-defaults.json))
