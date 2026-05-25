# PREBUILD vertical demo matrix (MK-01)

**Goal:** one-page GTM / QA reference for **shipped** complex variants. All **seven** vertical packs have **`roadmap_motions: []`** when PREBUILD motions are complete.

**Prerequisites:** [booking-scheduling-stub-local.md](booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` for local HTTP tool QA.

## Install variants

Use **Template catalog** → **Install into my org** → pick **Graph variant**, or API:

```bash
curl -sS -X POST "$API/api/v1/workflow/install-from-catalog" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"slug":"retail-wismo-faq","variant_id":"collections_complex","workflow_name":"Retail collections demo"}'
```

## Matrix (slug × variant × HTTP tool)

| `catalog_slug` | `catalog_variant_id` | Primary HTTP tool | Stub path | Runbook happy-path section |
|----------------|----------------------|-------------------|-----------|----------------------------|
| `healthcare-clinic-screening` | `booking_complex` | `book_slot` | `/api/v1/appointments` | Booking-complex happy-path test |
| `healthcare-clinic-screening` | `confirm_remind` | `reschedule_appointment` | `/api/v1/appointments/reschedule` | No-show reduction happy-path test |
| `healthcare-clinic-screening` | `concierge_complex` | `enroll_concierge_visit` | `/api/v1/visits/enroll` | Concierge / paid visit happy-path test |
| `retail-wismo-faq` | `booking_complex` | `reserve_pickup_slot` | `/api/v1/appointments` | Booking-complex happy-path test |
| `retail-wismo-faq` | `upsell_complex` | `offer_warranty_addon` | `/api/v1/offers/attach` | Paid upsell happy-path test |
| `retail-wismo-faq` | `collections_complex` | `capture_payment_promise` | `/api/v1/payment-promises` | Collections / payment promise happy-path test |
| `b2b-saas-trial-nurture` | `booking_complex` | `book_demo` | `/book_demo` or `/api/v1/appointments` | Booking-complex happy-path test |
| `b2b-saas-trial-nurture` | `renewal_complex` | `book_qbr` | `/api/v1/appointments` | Renewal / QBR happy-path test |
| `b2b-saas-trial-nurture` | `conversion_complex` | `update_crm_deal_stage` | `/api/v1/deals/stage` | Trial-to-paid happy-path test |
| `insurance-fnol-faq` | `booking_complex` | `schedule_adjuster_callback` | `/api/v1/appointments` | Booking-complex happy-path test |
| `insurance-fnol-faq` | `quote_complex` | `capture_quote_intent` | `/api/v1/quotes/intent` | Quote intent happy-path test |
| `insurance-fnol-faq` | `claims_lookup_complex` | `lookup_claim_status` | `/api/v1/claims/status` | Claims status lookup happy-path test |
| `hospitality-travel-concierge` | `booking_complex` | `modify_reservation` | `/api/v1/reservations/modify` | Booking-complex happy-path test |
| `hospitality-travel-concierge` | `waiver_complex` | `apply_cancellation_waiver` | `/api/v1/cancellations/waiver` | Cancellation fee waiver happy-path test |
| `hospitality-travel-concierge` | `upsell_complex` | `offer_room_upgrade` | `/api/v1/offers/attach` | Loyalty room upgrade happy-path test |
| `financial-services-banking-faq` | `booking_complex` | `schedule_branch_appointment` | `/api/v1/appointments` | Booking-complex happy-path test |
| `financial-services-banking-faq` | `balance_lookup_complex` | `lookup_account_balance` | `/api/v1/accounts/balance` | Tokenized balance lookup happy-path test |
| `financial-services-banking-faq` | `card_block_complex` | `report_card_lost_stolen` | `/api/v1/cards/block` | Card block / fraud report happy-path test |
| `smb-franchise-location-faq` | `booking_complex` | `schedule_lead_callback` | `/api/v1/appointments` | Booking-complex happy-path test |
| `smb-franchise-location-faq` | `location_router_complex` | `route_call_to_location` | `/api/v1/locations/route` | Talk-to-location router happy-path test |
| `smb-franchise-location-faq` | `lead_capture_complex` | `capture_lead_intent` | `/api/v1/leads/intent` | CRM lead capture happy-path test |

Runbooks: [runbooks/](../runbooks/). Field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## Analytics proof (after a Web test with tool wired)

Filter calls list:

```
/analytics/calls?catalog_slug={slug}&catalog_variant_id={variant_id}&tool_name={tool}
```

Overview preset: `/analytics?catalog_slug={slug}` → **Apply vertical preset** when the board is still generic.

Automated mapping chain (no network): [booking-http-analytics-smoke.md](booking-http-analytics-smoke.md).

## CI / regression

- Catalog shape + runbook sections: [test_vertical_packs_catalog.py](../../api/tests/test_vertical_packs_catalog.py)
- Install API per variant: [test_install_from_catalog_routes.py](../../api/tests/test_install_from_catalog_routes.py)
- UI variant install: [catalog-marketplace.spec.ts](../../ui/e2e/catalog-marketplace.spec.ts)

**Partner gate:** review [PARTNER_REVIEW.md](../PARTNER_REVIEW.md) before buyer-facing GTM for insurance, collections, and concierge motions.
