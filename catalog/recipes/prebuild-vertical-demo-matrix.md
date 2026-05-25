# PREBUILD vertical demo matrix (MK-01)

**Goal:** one-page GTM / QA reference for all **shipped** complex variants across the three curated verticals. Every pack has **`roadmap_motions: []`** — revenue motions are in packaged JSON, not roadmap-only copy.

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

**Partner gate:** review [PARTNER_REVIEW.md](../PARTNER_REVIEW.md) before buyer-facing GTM for collections and concierge motions.
