# Prebuild vertical roadmap — booking, revenue motions, and HTTP-ready packs (MK-01)

**Execution ID:** [MK-01-RUBRIC](../READMEPLANTOEXECUTE.md#mk-01-rubric--template-quality-rubric-stub) (curated templates before marketplace scale)  
**Canonical catalog:** [vertical-packs.json](vertical-packs.json) · **Rubric:** [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) · **Partner gate:** [PARTNER_REVIEW.md](PARTNER_REVIEW.md)

This document answers: *Are our shipped vertical packs ready to clone into **prebuilt** buyer demos where **booking / scheduling** and other **high-revenue** motions are obvious?* It complements strategy in [READMEPLANNING.md](../READMEPLANNING.md) §6.

## Current packs (what ships today)

| Slug | Industry | Pack focus today | HTTP / tools posture |
|------|----------|------------------|----------------------|
| [healthcare-clinic-screening](vertical-packs.json) | Healthcare / clinics | **Simple** install + **complex** [healthcare-triage-booking-complex.json](packaged-workflows/healthcare-triage-booking-complex.json) | **Complex** prompts expect `scheduling_api_base_url` + HTTP **book_slot** when buyer connects scheduling |
| [retail-wismo-faq](vertical-packs.json) | Retail / e-commerce | **Simple** + **complex** [retail-wismo-booking-complex.json](packaged-workflows/retail-wismo-booking-complex.json) | **OMS** + **reserve_pickup_slot** / calendar HTTP tools |
| [b2b-saas-trial-nurture](vertical-packs.json) | B2B SaaS | **Simple** + **complex** booking, renewal, conversion graphs | **CRM + calendar** HTTP tools (`book_demo`, `book_qbr`, `update_crm_deal_stage`, …) |
| [insurance-fnol-faq](vertical-packs.json) | Insurance | **Simple** + **complex** booking, quote, claims lookup graphs | **Adjuster callback**, **quote intent**, **claims status** HTTP tools |
| [hospitality-travel-concierge](vertical-packs.json) | Hospitality / travel | **Simple** + **complex** [hospitality-travel-booking-complex.json](packaged-workflows/hospitality-travel-booking-complex.json) | **PMS modify** HTTP tool (`modify_reservation`); waiver / upsell shipped |
| [financial-services-banking-faq](vertical-packs.json) | Financial services | **Simple** + **complex** booking, balance, card block graphs | **Branch appointment**, **tokenized balance**, **card block** HTTP tools |
| [smb-franchise-location-faq](vertical-packs.json) | SMB / franchises | **Simple** + **complex** booking, router, lead capture graphs | **Lead callback**, **talk-to-location**, **CRM lead capture** HTTP tools |

Each row must keep **happy-path QA** in its [runbook](../runbooks/README.md) and pass [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) before we market it as “revenue-ready.”

## Gap: “Book an appointment” as a **primary** story per vertical

Buyers often evaluate voice AI on **scheduling** first. Each catalog pack now ships **`workflow_variants`**: a **simple** graph (default **Install**) and a **complex** graph with **booking-ready prompts** (`*-booking-complex.json` under [packaged-workflows/](packaged-workflows/)). Authors still attach real **HTTP API** tools (`book_slot`, `reserve_pickup_slot`, `book_demo`, …) after install — graphs document safe URL placeholders via `default_template_variables` (`scheduling_api_base_url`, etc.).

| Vertical | Booking story buyers expect | Status |
|----------|------------------------------|--------|
| Healthcare | Book **provider / visit**; **confirm / reschedule**; **concierge enroll** | **Complex variants shipped** — **`booking_complex`**, **`confirm_remind`**, **`concierge_complex`**; wire scheduling + billing HTTP tools |
| Retail | Book **in-store service, styling, or pickup window**; **upsell**; **collections promise** | **Complex variants shipped** — **`booking_complex`**, **`upsell_complex`**, **`collections_complex`**; wire HTTP tools to buyer APIs |
| B2B SaaS | Book **demo**; **renewal / QBR**; **trial → paid** | **Complex variants shipped** — **`booking_complex`**, **`renewal_complex`**, **`conversion_complex`**; wire calendar + CRM HTTP tools |
| Insurance | **Adjuster callback**; **quote intent**; **claims status lookup** | **Complex variants shipped** — **`booking_complex`**, **`quote_complex`**, **`claims_lookup_complex`**; wire HTTP tools to buyer APIs |
| Hospitality / travel | **Modify reservation**; **cancellation waiver**; **loyalty upgrade** | **Complex variants shipped** — **`booking_complex`**, **`waiver_complex`**, **`upsell_complex`**; wire HTTP tools to buyer APIs |
| Financial services | **Branch appointment**; **tokenized balance**; **card block API** | **Complex variants shipped** — **`booking_complex`**, **`balance_lookup_complex`**, **`card_block_complex`**; wire HTTP tools to buyer APIs |
| SMB / franchises | **Lead callback**; **location router**; **CRM lead capture** | **Complex variants shipped** — **`booking_complex`**, **`location_router_complex`**, **`lead_capture_complex`**; wire HTTP tools to buyer APIs |

**Next engineering slice:** (1) **Done:** runbook **Booking-complex happy-path test** per variant (≤6 turns after HTTP tool wired) — [runbooks/](../runbooks/) + CI [test_runbooks_document_booking_complex_happy_path](../api/tests/test_vertical_packs_catalog.py); (2) **Done:** install API + UI **variant** — `POST /api/v1/workflow/install-from-catalog` with `variant_id`, `mk01.catalog_variant_id` on the workflow; (3) **Done:** **Analytics** filter by `catalog_variant_id` + **CI chain test** for `response_mapping` → `mapped_data` → tool span ([booking-http-analytics-smoke.md](recipes/booking-http-analytics-smoke.md), [test_booking_http_mapping_analytics_span.py](../api/tests/test_booking_http_mapping_analytics_span.py)); (4) **Done:** **live** HTTP stub — [booking-scheduling-stub-local.md](recipes/booking-scheduling-stub-local.md), [booking_scheduling_stub_server.py](../scripts/booking_scheduling_stub_server.py), Docker Compose profile **`booking-stub`** on **:8765**.

## Other high-revenue motions (prioritize after booking spine)

| Motion | Why it pays | Fit by vertical |
|--------|-------------|-----------------|
| **Paid conversion / upsell** | Direct ARR lift | B2B: upgrade path post-trial; Retail: attach warranty or subscription |
| **Collections / payment promise** | Reduces write-offs | Retail B2C voice; use strict compliance tags |
| **Renewal / expansion** | LTV | B2B: QBR scheduling + health score handoff |
| **No-show reduction** | Utilization | Healthcare: confirm/remind + reschedule link |

Catalog metadata: keep **`use_cases`** honest—list motions the **current JSON** supports; add **`roadmap_motions`** only when this file + the pack runbook document the gap (see [vertical-packs.json](vertical-packs.json)). **Shipped in repo:** each pack now lists **≥2** roadmap lines; runbooks include **High-revenue motions (roadmap)**; CI gates in [test_vertical_packs_catalog.py](../api/tests/test_vertical_packs_catalog.py).

### Per-vertical roadmap (not in packaged JSON yet)

| Slug | Roadmap motion | Buyer value | Prebuild gate |
|------|----------------|-------------|---------------|
| `healthcare-clinic-screening` | No-show reduction | Fewer empty slots | **Shipped** — **`confirm_remind`** variant + **`reschedule_appointment`** HTTP + runbook happy path |
| `healthcare-clinic-screening` | Optional concierge / paid visit type | Utilization + revenue | **Shipped** — **`concierge_complex`** + **`enroll_concierge_visit`** + runbook happy path |
| `retail-wismo-faq` | Paid upsell (warranty / subscription) | ARR attach after WISMO | **Shipped** — **`upsell_complex`** + **`offer_warranty_addon`** HTTP + runbook happy path |
| `retail-wismo-faq` | Collections / payment promise | Write-off reduction | **Shipped** — **`collections_complex`** + **`capture_payment_promise`** + runbook happy path |
| `b2b-saas-trial-nurture` | Trial → paid upgrade | Conversion lift | **Shipped** — **`conversion_complex`** + **`update_crm_deal_stage`** + runbook happy path |
| `b2b-saas-trial-nurture` | Renewal / QBR expansion | LTV | **Shipped** — **`renewal_complex`** + **`book_qbr`** (+ optional **sync_crm_health**) + runbook happy path |
| `insurance-fnol-faq` | Quote intent qualification | Hot-lead routing | **Shipped** — **`quote_complex`** + **`capture_quote_intent`** + runbook happy path |
| `insurance-fnol-faq` | Live claims status lookup | Tier-1 containment | **Shipped** — **`claims_lookup_complex`** + **`lookup_claim_status`** + runbook happy path |
| `hospitality-travel-concierge` | Cancellation fee waiver / credit | Guest recovery | **Shipped** — **`waiver_complex`** + **`apply_cancellation_waiver`** + runbook happy path |
| `hospitality-travel-concierge` | Loyalty room upgrade offer | Incremental revenue | **Shipped** — **`upsell_complex`** + **`offer_room_upgrade`** + runbook happy path |
| `financial-services-banking-faq` | Branch appointment scheduling | Self-serve branch visits | **Shipped** — **`booking_complex`** + **`schedule_branch_appointment`** + runbook happy path |
| `financial-services-banking-faq` | Tokenized balance lookup | Tier-1 containment | **Shipped** — **`balance_lookup_complex`** + **`lookup_account_balance`** + runbook happy path |
| `financial-services-banking-faq` | Card block / fraud report API | Faster card safety | **Shipped** — **`card_block_complex`** + **`report_card_lost_stolen`** + runbook happy path |
| `smb-franchise-location-faq` | Lead callback scheduling | Pipeline velocity per location | **Shipped** — **`booking_complex`** + **`schedule_lead_callback`** + runbook happy path |
| `smb-franchise-location-faq` | Talk-to-location router | Right-site deflection | **Shipped** — **`location_router_complex`** + **`route_call_to_location`** + runbook happy path |
| `smb-franchise-location-faq` | CRM lead capture | One template × many stores | **Shipped** — **`lead_capture_complex`** + **`capture_lead_intent`** + runbook happy path |

**Next engineering slice (when staffed):** **MK-01 depth** (preview audio / try-flow polish) or **eighth vertical row** ([READMEPLANNING.md](../READMEPLANNING.md) §6); use [prebuild-vertical-demo-matrix.md](recipes/prebuild-vertical-demo-matrix.md) for GTM demos.

## HTTP tools and context variables (WE-01-DUALMODE)

When packs add **HTTP API** steps, authors should rely on:

- Grouped pickers for **system**, **conversation**, **custom**, and **live** keys ([http-api.mdx](../docs/voice-agent/tools/http-api.mdx)).
- **Test payload** and **test call context** persisted per tool in the dashboard (browser) for repeatable **Test API Call** runs.

Prebuilt workflows should ship **safe placeholders** in `default_template_variables` for any URL, header, or body template—never production secrets (rubric row 4).

## Analytics & call intelligence (MK-01-ANALYTICS-VERTICAL)

Buyer demos need **observability**: filterable **calls**, **call detail** (outcomes, metrics, tool/API traces incl. **`mapped_data`**, QA/QM hints), **default + custom dashboards** (widget cards), **REST** plus **optional DB** access for enterprise.

**Shipped (UI + API):** [`/analytics`](../ui/src/app/analytics/page.tsx) — insights + **customizable** widget board; layout **org-persisted** (`GET`/`PUT /api/v1/analytics/dashboard-layout`) with local cache fallback; **shareable** `?days=&catalog_slug=&catalog_variant_id=` on the overview. [`/analytics/calls`](../ui/src/app/analytics/calls/page.tsx) — filters incl. MK-01 **`catalog_slug`**, **`catalog_variant_id`**, **`tool_name`**, outcomes — same semantics as `GET /api/v1/analytics/insights` and list/export APIs. **Client CSV** (loaded rows) + **server CSV** (`GET /api/v1/analytics/calls/export`); call detail responses **PII-redacted** ([analytics_redact.py](../api/services/analytics/analytics_redact.py)).

**Catalog metadata:** each pack in [vertical-packs.json](vertical-packs.json) includes **`analytics_hooks`** (strings) tying the slug to filters and proof — extend when adding motions.

**Vertical × booking × HTTP × analytics** reviewer matrix: **[VERTICAL_ANALYTICS_HTTP_MATRIX.md](VERTICAL_ANALYTICS_HTTP_MATRIX.md)**. Scope and phasing: **[ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md)**. HTTP tools: align **`response_mapping`** keys with analytics **`mapped_data`** and call-list **`tool_name`** filters. **REST:** [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml) ([api/routes/analytics.py](../api/routes/analytics.py)).

## Checklist before marketing “prebuild for {vertical}”

**Status (2026-05-23):** all three shipped packs pass this checklist for booking + high-revenue motions; **`roadmap_motions`** is empty on every pack.

- [x] Runbook happy path matches the graph (rubric row 3).  
- [x] `use_cases` and `summary` match what the graph does (rubric row 8).  
- [x] Revenue or booking claims are **either** implemented in JSON **or** explicitly labeled roadmap in this file + runbook.  
- [x] PARTNER_REVIEW + compliance tags reviewed for new tools or PII (collections + concierge: review before external GTM).  
- [x] `pack_semver` bumped per [catalog/README.md](README.md) (**1.4.0** on all three packs).
- [x] Runbook or pack PR links **metrics / analytics** expectations to [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md) when claiming buyer-visible insights.

**GTM demo index:** [recipes/prebuild-vertical-demo-matrix.md](recipes/prebuild-vertical-demo-matrix.md).

**Maintainers:** when a new packaged graph ships, add a row to the first table and shrink the booking gap column to **Shipped**.
