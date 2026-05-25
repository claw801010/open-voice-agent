# Vertical packs ↔ booking ↔ HTTP variables ↔ analytics (review matrix)

**Purpose:** single checklist for **MK-01** prebuild reviewers — align **catalog slugs**, **booking / high-revenue** stories, **HTTP tool** naming, **`response_mapping`** keys, and **analytics** filters (`catalog_slug`, `catalog_variant_id`, `tool_name`, outcomes).

**Canonical catalog:** [vertical-packs.json](vertical-packs.json) · **Prebuild gaps:** [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md) · **Analytics scope:** [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md) · **OpenAPI:** [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml)

## Vertical summary (expected wiring)

| `catalog_slug` | Primary booking / scheduling story | Expected HTTP tool names (after buyer wires APIs) | Template vars to expose (`default_template_variables`) | Analytics: prove with |
|----------------|-----------------------------------|-----------------------------------------------------|--------------------------------------------------------|-------------------------|
| `healthcare-clinic-screening` | Triage → **book**; **confirm / reschedule**; **concierge enroll** | `book_slot`, `reschedule_appointment`, `enroll_concierge_visit`, `lookup_availability` | `scheduling_api_base_url`, `billing_api_base_url`, `concierge_visit_type`, `clinic_location_id`, `preferred_visit_type` | `GET /analytics/calls?catalog_slug=…&catalog_variant_id=…&tool_name=…`; call detail `mapped_data` |
| `retail-wismo-faq` | WISMO + **pickup / service window**; **warranty upsell**; **payment promise** | `reserve_pickup_slot`, `offer_warranty_addon`, `capture_payment_promise`, OMS lookup tools | `scheduling_api_base_url`, `pickup_location_code`, `product_api_base_url`, `upsell_product_sku`, `collections_api_base_url`, `payment_plan_policy_id`, `store_name` | Same filters; **`catalog_variant_id`** = `booking_complex`, `upsell_complex`, or `collections_complex` |
| `b2b-saas-trial-nurture` | Trial → **demo**; **renewal / QBR**; **paid conversion** | `book_demo`, `book_qbr`, `update_crm_deal_stage`, `sync_crm_health` | `scheduling_api_base_url`, `crm_api_base_url`, `target_deal_stage`, `crm_owner_email`, `demo_duration_minutes`, `account_health_tier` | `tool_name` + **`catalog_variant_id`** + **`outcome_key`** |
| `insurance-fnol-faq` | FNOL guidance → **adjuster callback**; **quote intent**; **claims status** | `schedule_adjuster_callback`, `capture_quote_intent`, `lookup_claim_status` | `scheduling_api_base_url`, `quoting_api_base_url`, `claims_api_base_url`, `quote_product_code`, `carrier_name`, `line_of_business`, `claims_portal_url`, `preferred_callback_window_hours` | **`catalog_variant_id`** = `booking_complex`, `quote_complex`, or `claims_lookup_complex`; **`tool_name`** filter + call detail `mapped_data` |
| `hospitality-travel-concierge` | Concierge FAQ → **modify reservation**; **cancellation waiver** | `modify_reservation`, `apply_cancellation_waiver`, CRS upsell tools (roadmap) | `pms_api_base_url`, `policy_api_base_url`, `waiver_policy_code`, `property_name`, `confirmation_prefix`, `default_room_type`, `cancellation_policy_url`, `support_email` | **`catalog_variant_id`** = `booking_complex` or `waiver_complex`; **`tool_name`** filter + call detail `mapped_data` |

**Rule:** packaged **complex** graphs (`booking_complex` variant) add scheduling language; **HTTP tools** are attached post-install — rubric + runbooks must describe the happy path *after* tools exist.

## Variable sources (HTTP tool authoring — WE-01-DUALMODE)

Authors pick **`{{…}}` tokens** from grouped UI (Simple / Advanced / Raw):

| Source | Where it comes from | Typical tokens |
|--------|---------------------|----------------|
| **System** | Live session metadata | Caller/called numbers, `call_id`, `workflow_id`, `organization_id`, time, locale |
| **Conversation / initial context** | Workflow run `initial_context` | `customer_name`, `customer_id`, … |
| **Workflow template variables** | Workflow → Template variables (merged into resolution) | Pack defaults from `default_template_variables` at install |
| **Custom flow variables** | Paths you type + auto-discovered `{{…}}` from this tool | Vertical-specific keys you add |
| **Live** | Parameter names + response-mapping keys | For iteration within the tool |

**Docs:** [http-api.mdx](../docs/voice-agent/tools/http-api.mdx), [template-variables](https://docs.dograh.com/voice-agent/template-variables), [context & variables](https://docs.dograh.com/core-concepts/context-and-variables).

## Analytics surfaces (repo ground truth)

| Surface | Route / artifact | Notes |
|---------|------------------|--------|
| Overview | [Analytics Overview](../ui/src/app/analytics/page.tsx) (`/analytics`) | Insights API + widget board; layout **org-persisted** + `GET`/`PUT /api/v1/analytics/dashboard-layout` |
| Call list | [Analytics calls](../ui/src/app/analytics/calls/page.tsx) (`/analytics/calls`) | Filters: `workflow_id`, `catalog_slug`, `catalog_variant_id`, time, disposition, outcome, `tool_name` |
| Call detail | `/analytics/calls/[callId]` | Outcomes, metrics, HTTP spans + **`mapped_data`** (PII redacted server-side when org policy on — [analytics_redact.py](../api/services/analytics/analytics_redact.py); reviewer matrix [ANALYTICS_REDACTION_MATRIX.md](ANALYTICS_REDACTION_MATRIX.md)) |
| REST | [analytics.py](../api/routes/analytics.py), [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml) | `insights`, `calls`, `calls/export`, `calls/{call_id}`, `dashboard-layout` |
| DB | Not default integration | Enterprise read replicas / RLS — **not** required for standard integrations |

## Overview widgets ↔ data sources ↔ HTTP `response_mapping`

Overview cards are **not** fed directly by HTTP `mapped_data` today. Use this map when explaining buyers how **outcomes**, **insights**, and **tool evidence** fit together.

| Widget (`AnalyticsDashboardClient`) | Primary data | Role of HTTP tools |
|-------------------------------------|--------------|--------------------|
| **KPI row** (`kpi_row`) | `GET /analytics/insights` — `total_calls`, `calls_with_outcome`, outcome share | Filter insights with **`catalog_slug`** / variant to match a vertical. Proof of booking APIs is **not** here—use call list + detail. |
| **Top outcomes** (`outcome_top`) | Same insights payload — `outcome_mix` from `gathered_context` (`outcome_key` / `customer_outcome`) | Authors should write flows so post-tool success updates **`gathered_context`** if KPIs must reflect bookings; HTTP **`mapped_data`** remains per-call evidence. |
| **APIs & call list** (`dive_deeper`) | Links + copy | Points at REST + **`/analytics/calls`** where **`tool_name`** and exports matter for QM. |
| **Vertical shortcuts** (`vertical_shortcuts`) | Static MK-01 slugs | Deep-links Overview + call list with `catalog_slug`. |
| **Revenue & booking** (`revenue_motions`) | Static roadmap copy + optional **vertical HTTP hints** when slug is set | With **Vertical slug** filled (known pack), UI surfaces **example tool names** and **suggested `response_mapping` keys** — canonical constants in [analyticsVerticalHttpHints.ts](../ui/src/lib/analyticsVerticalHttpHints.ts). |

**Per-vertical conventions** (example tool names + suggested mapping keys → `mapped_data`): **`VERTICAL_HTTP_PROOF_HINTS`** in [analyticsVerticalHttpHints.ts](../ui/src/lib/analyticsVerticalHttpHints.ts); CI via `npm test -- analyticsVerticalHttpHints.test.ts` (every `vertical-packs.json` slug must have an entry).

**Booking-style JSON sample** for docs/tests: [fixtures/booking-scheduling-upstream-response.sample.json](fixtures/booking-scheduling-upstream-response.sample.json) — chain test [test_booking_http_mapping_analytics_span.py](../api/tests/test_booking_http_mapping_analytics_span.py).

## Automated verification (CI-friendly)

**Booking HTTP → `mapped_data` → analytics span shape:** no network — run:

```bash
cd api && python -m pytest tests/test_booking_http_mapping_analytics_span.py -q
```

Recipe walkthrough + sample JSON: **[recipes/booking-http-analytics-smoke.md](recipes/booking-http-analytics-smoke.md)** · fixture **[fixtures/booking-scheduling-upstream-response.sample.json](fixtures/booking-scheduling-upstream-response.sample.json)**.

## Reviewer actions before “prebuild-ready” GTM

- [ ] Runbook happy path matches **installed variant** (simple vs `booking_complex`).
- [ ] HTTP tool **Test API Call** works with **call context** JSON aligned to template variables.
- [ ] **`response_mapping`** keys are stable and documented — they appear as **`mapped_data`** in analytics call detail.
- [ ] **Analytics** smoke: filter call list by `catalog_slug`; open detail and confirm tool span for booking tool.
- [ ] **CSV** export sample for QM (`GET /api/v1/analytics/calls/export`) with same filters.

**Maintainers:** bump **`pack_semver`** when changing variables or graphs per [catalog/README.md](README.md).
