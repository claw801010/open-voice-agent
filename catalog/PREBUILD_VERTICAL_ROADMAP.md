# Prebuild vertical roadmap — booking, revenue motions, and HTTP-ready packs (MK-01)

**Execution ID:** [MK-01-RUBRIC](../READMEPLANTOEXECUTE.md#mk-01-rubric--template-quality-rubric-stub) (curated templates before marketplace scale)  
**Canonical catalog:** [vertical-packs.json](vertical-packs.json) · **Rubric:** [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) · **Partner gate:** [PARTNER_REVIEW.md](PARTNER_REVIEW.md)

This document answers: *Are our shipped vertical packs ready to clone into **prebuilt** buyer demos where **booking / scheduling** and other **high-revenue** motions are obvious?* It complements strategy in [READMEPLANNING.md](../READMEPLANNING.md) §6.

## Current packs (what ships today)

| Slug | Industry | Pack focus today | HTTP / tools posture |
|------|----------|------------------|----------------------|
| [healthcare-clinic-screening](vertical-packs.json) | Healthcare / clinics | **Simple** install + **complex** [healthcare-triage-booking-complex.json](packaged-workflows/healthcare-triage-booking-complex.json) | **Complex** prompts expect `scheduling_api_base_url` + HTTP **book_slot** when buyer connects scheduling |
| [retail-wismo-faq](vertical-packs.json) | Retail / e-commerce | **Simple** + **complex** [retail-wismo-booking-complex.json](packaged-workflows/retail-wismo-booking-complex.json) | **OMS** + **reserve_pickup_slot** / calendar HTTP tools |
| [b2b-saas-trial-nurture](vertical-packs.json) | B2B SaaS | **Simple** + **complex** [b2b-trial-booking-complex.json](packaged-workflows/b2b-trial-booking-complex.json) | **CRM + calendar** HTTP tools (`book_demo`, …) |

Each row must keep **happy-path QA** in its [runbook](../runbooks/README.md) and pass [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) before we market it as “revenue-ready.”

## Gap: “Book an appointment” as a **primary** story per vertical

Buyers often evaluate voice AI on **scheduling** first. Each catalog pack now ships **`workflow_variants`**: a **simple** graph (default **Install**) and a **complex** graph with **booking-ready prompts** (`*-booking-complex.json` under [packaged-workflows/](packaged-workflows/)). Authors still attach real **HTTP API** tools (`book_slot`, `reserve_pickup_slot`, `book_demo`, …) after install — graphs document safe URL placeholders via `default_template_variables` (`scheduling_api_base_url`, etc.).

| Vertical | Booking story buyers expect | Status |
|----------|------------------------------|--------|
| Healthcare | Book **provider / visit type / location**; confirm slot; reschedule | **Complex variant shipped** — prompts + template vars; wire HTTP tool to buyer scheduling backend |
| Retail | Book **in-store service, styling, or pickup window** | **Complex variant shipped** — prompts + vars; wire OMS / calendar HTTP tools |
| B2B SaaS | Book **demo, onboarding, or CS escalation** | **Complex variant shipped** — prompts + vars; wire CRM + calendar HTTP tools |

**Next engineering slice:** (1) runbook happy paths per variant (“book in under N turns” **after** HTTP tool is attached); (2) **Done:** install API + UI **variant** — `POST /api/v1/workflow/install-from-catalog` with `variant_id`, `mk01.catalog_variant_id` on the workflow; (3) **Done:** **Analytics** filter by `catalog_variant_id` + **CI chain test** for `response_mapping` → `mapped_data` → tool span ([booking-http-analytics-smoke.md](recipes/booking-http-analytics-smoke.md), [test_booking_http_mapping_analytics_span.py](../api/tests/test_booking_http_mapping_analytics_span.py)); (4) optional **live** HTTP stub (docker) for manual QA beyond mocks.

## Other high-revenue motions (prioritize after booking spine)

| Motion | Why it pays | Fit by vertical |
|--------|-------------|-----------------|
| **Paid conversion / upsell** | Direct ARR lift | B2B: upgrade path post-trial; Retail: attach warranty or subscription |
| **Collections / payment promise** | Reduces write-offs | Retail B2C voice; use strict compliance tags |
| **Renewal / expansion** | LTV | B2B: QBR scheduling + health score handoff |
| **No-show reduction** | Utilization | Healthcare: confirm/remind + reschedule link |

Catalog metadata: keep **`use_cases`** honest—list motions the **current JSON** supports; add roadmap lines only when runbook + rubric document the gap (see [vertical-packs.json](vertical-packs.json) updates in the same PR).

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

- [ ] Runbook happy path matches the graph (rubric row 3).  
- [ ] `use_cases` and `summary` match what the graph does (rubric row 8).  
- [ ] Revenue or booking claims are **either** implemented in JSON **or** explicitly labeled roadmap in this file + runbook.  
- [ ] PARTNER_REVIEW + compliance tags reviewed for new tools or PII.  
- [ ] `pack_semver` bumped per [catalog/README.md](README.md).
- [ ] Runbook or pack PR links **metrics / analytics** expectations to [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md) when claiming buyer-visible insights.

**Maintainers:** when a new packaged graph ships, add a row to the first table and shrink the booking gap column to **Shipped**.
