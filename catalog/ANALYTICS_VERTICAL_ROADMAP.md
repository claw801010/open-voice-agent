# Analytics & call intelligence — vertical prebuild companion (MK-01)

**Execution ID:** **MK-01-ANALYTICS-VERTICAL** — see package in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md) (search **MK-01-ANALYTICS-VERTICAL**).  
**Pairs with:** [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md) (booking + revenue motions), [vertical-packs.json](vertical-packs.json), [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md)  
**HTTP authoring (tool calls / responses):** [docs/voice-agent/tools/http-api.mdx](../docs/voice-agent/tools/http-api.mdx) — response mapping, test payload, per-tool samples (**WE-01-DUALMODE**)

Prebuilt **vertical** workflows (healthcare, retail, B2B SaaS) need a **credible analytics story** for buyers: not only *what the agent said*, but **outcomes**, **tool/API evidence**, and **QM**-ready review. This document scopes that product surface **before** implementation tickets split across backend, UI, and data.

## Goals (buyer-facing)

1. **Calls list** — filterable grid (time, workflow, vertical, disposition, tags, tool-used, outcome).  
2. **Call detail** — transcript + audio; **customer-defined outcomes** (e.g. booked, escalated, no-show risk); **key metrics** (duration, latency bands, LLM/tool counts); **HTTP tool trace** (request/response summaries, mapped fields — align with `response_mapping` / `mapped_data` semantics in product).  
3. **AI-assisted review** — optional summaries, risk flags, topic adherence (policy-gated; compliance tags from packs).  
4. **QA / QM** — scorecards, calibration exports, sampling by filter.  
5. **Dashboards** — **default** per org/workflow (KPIs for the vertical’s revenue motions) + **custom** layouts built from **widget cards** (reusable functions: funnel, tool success rate, booking conversion, etc.).  
6. **API & data access** — documented **REST** (or GraphQL later) for aggregates and call detail; **database** access only where enterprise contracts require it (read replicas, row-level security), not as the default integration path.

### End-to-end surface (what ships today)

| Layer | What buyers get | Primary repo paths |
|-------|-----------------|---------------------|
| **Calls list** | Paginated, filterable (`workflow_id`, MK-01 **`catalog_slug`**, **`catalog_variant_id`**, time range, disposition, **`outcome_key`**, **`tool_name`**) | UI [`/analytics/calls`](../ui/src/app/analytics/calls/page.tsx); API `GET /api/v1/analytics/calls` ([analytics.py](../api/routes/analytics.py)) |
| **Call detail** | Customer-defined **outcomes** (from `gathered_context`), **metrics** (LLM/tool counts), **tool spans** with HTTP **`mapped_data`** (from `response_mapping`), QA hints | UI `/analytics/calls/[callId]`; API `GET /api/v1/analytics/calls/{call_id}`; builder [call_intel.py](../api/services/analytics/call_intel.py); **PII** [analytics_redact.py](../api/services/analytics/analytics_redact.py) |
| **AI / QM** | Optional **`ai_summary`** (reserved); **`qa`** from annotations when present | Same detail payload |
| **Default + custom dashboards** | Overview **insights** (`total_calls`, outcome mix, **`calls_with_tool_evidence`** / **`calls_with_logged_tools`**, **`tool_name_mix`**) + **widget cards** (KPI row, outcomes, shortcuts, revenue-motion copy); layout **saved per org** | UI [`/analytics`](../ui/src/app/analytics/page.tsx); `GET`/`PUT /api/v1/analytics/dashboard-layout`; client [AnalyticsDashboardClient.tsx](../ui/src/app/analytics/AnalyticsDashboardClient.tsx); roll-up query [analytics_calls_client.py](../api/db/analytics_calls_client.py) `get_analytics_insights` |
| **Exports** | **Client CSV** (loaded rows) + **server CSV** same filters; optional **scheduled** CSV to object storage ([analytics_qm_export_tasks.py](../api/tasks/analytics_qm_export_tasks.py)) | `GET /api/v1/analytics/calls/export` ([analytics_calls_csv.py](../api/services/analytics/analytics_calls_csv.py)); org schedule `GET`/`PUT /analytics/qm-export-schedule |
| **REST contract** | Versioned draft OpenAPI | [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml) |
| **Database** | **Not** the default integration path | Enterprise-only (replicas, RLS); product API is sufficient for standard integrations |

**Vertical template alignment:** booking + high-revenue motions per **`catalog_slug`**, expected HTTP tool names, **`response_mapping`** → analytics proof — see **[VERTICAL_ANALYTICS_HTTP_MATRIX.md](VERTICAL_ANALYTICS_HTTP_MATRIX.md)** and [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md).

**HTTP tool variables:** system, conversation/initial context, workflow **template variables**, and **custom** paths — surfaced in the HTTP tool editor pickers (**WE-01-DUALMODE**); see [http-api.mdx](../docs/voice-agent/tools/http-api.mdx).

## Data we must capture (minimum viable observability)

| Domain | Examples | Notes |
|--------|-----------|--------|
| **Conversation** | transcript segments, timestamps, node ids | Existing run pipeline; extend with stable `call_id` / `workflow_run_id` joins |
| **Tools** | HTTP method, URL template (resolved host redacted?), status, latency, **mapped** keys from tool output | Tie to [HTTP API tool doc](../docs/voice-agent/tools/http-api.mdx) config version at run time |
| **Outcomes** | user-defined enums + freeform labels | Configurable per workflow; seed defaults in vertical packs when we ship booking spine |
| **Costs** | STT/TTS/LLM estimates where available | Reuse patterns from `/usage` rollups where possible |

## Vertical hooks (examples)

| Vertical | Dashboard widgets “out of the gate” | Call list filters that matter |
|----------|-------------------------------------|--------------------------------|
| Healthcare | Triage → booked handoff rate, after-hours volume, average handle time | intent, disposition, PHI-minimization tag |
| Retail | WISMO resolution %, return-policy deflection, **pickup booking** conversion | order_id present, tool: OMS |
| B2B SaaS | PQL → meeting booked, trial stage drop-off | CRM stage variable, demo booked flag |

## Phasing (suggested)

| Phase | Deliverable |
|-------|-------------|
| **A — Spec** | **Draft OpenAPI:** [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml) (`GET /api/v1/analytics/calls`, `GET /api/v1/analytics/calls/{call_id}`, list/detail schemas, **HttpToolSpanSummary**, **DashboardWidgetDef**). Privacy matrix with [PARTNER_REVIEW.md](PARTNER_REVIEW.md) (separate PR/table). |
| **B — Ingest** | **Shipped (MVP):** `GET /api/v1/analytics/calls` + `GET …/calls/{call_id}` ([api/routes/analytics.py](../api/routes/analytics.py)) — org-scoped list/detail from `workflow_runs`; **tool_spans** derived from persisted `logs.realtime_feedback_events` (HTTP summaries from tool result JSON). **Phase D (partial):** table **`analytics_http_tool_spans`** populated when Pipecat runs finish ([event_handlers.py](../api/services/pipecat/event_handlers.py)); call **detail** prefers stored rows when present; **list** `tool_names`, **`tool_name`** query filter, and **`insights`** `calls_with_tool_evidence` / `calls_with_logged_tools` / `tool_name_mix` **union** logs + span table ([analytics_calls_client.py](../api/db/analytics_calls_client.py), [analytics_http_tool_span_client.py](../api/db/analytics_http_tool_span_client.py)). **PII:** [analytics_redact.py](../api/services/analytics/analytics_redact.py) on call detail + CSV cells; org **`GET`/`PUT /api/v1/analytics/redaction-policy`** (`detail_redaction_enabled`, default true). **RBAC (v1):** [redaction_policy_rbac.py](../api/services/analytics/redaction_policy_rbac.py) — who may **disable** redaction (`may_disable_detail_redaction`; API keys blocked; optional Stack permission / superuser-only via env). **Reviewer matrix (v1):** [ANALYTICS_REDACTION_MATRIX.md](ANALYTICS_REDACTION_MATRIX.md). **Postgres RLS** on span table — Alembic `b7c3e9d12f01` + per-transaction `app.current_organization_id` ([analytics_http_tool_span_rls.py](../api/db/analytics_http_tool_span_rls.py)); superuser/BYPASSRLS still bypass (typical local dev). Partner narrative: [PARTNER_REVIEW.md](PARTNER_REVIEW.md). |
| **C — UI** | **Shipped (MVP):** authenticated **Analytics** — [`/analytics`](../ui/src/app/analytics/page.tsx) **Overview** (insights API + customizable widget board, **org-persisted** layout via `GET`/`PUT /api/v1/analytics/dashboard-layout` + local cache + shareable query params incl. **`catalog_slug`** / **`catalog_variant_id`**) + org **PII redaction** toggle for call detail + server CSV (`GET`/`PUT /api/v1/analytics/redaction-policy` from [AnalyticsDashboardClient.tsx](../ui/src/app/analytics/AnalyticsDashboardClient.tsx); respects `may_disable_detail_redaction`) + **vertical widget preset** via **Apply vertical preset** or **auto** when `?catalog_slug=` matches a shipped pack and the board is still the **generic default** order ([analyticsDashboardLayout.ts](../ui/src/lib/analyticsDashboardLayout.ts) `widgetPresetForCatalogSlug`, `isGenericDefaultWidgetLayout`) + **drill-down:** **Top outcomes** / **Top tools** widgets link to [`/analytics/calls`](../ui/src/app/analytics/calls/page.tsx) with `outcome_key` / `tool_name` + matching catalog + insights date window ([analyticsOverviewDeepLinks.ts](../ui/src/lib/analyticsOverviewDeepLinks.ts)) + [`/analytics/calls`](../ui/src/app/analytics/calls/page.tsx) + detail: filterable list + variant column, outcomes, metrics, tool spans (HTTP `mapped_data`), QA hints. **Client CSV (page)** + **server CSV** (same filters, up to 5k rows) on call list. **Next:** more widget functions. |
| **D — Custom** | **Shipped:** widget add/remove/reset; **org-persisted** layout (`dashboard-layout`); client + server CSV; **Revenue & booking** widget shows **vertical HTTP proof hints** when Overview **Vertical slug** matches a pack ([analyticsVerticalHttpHints.ts](../ui/src/lib/analyticsVerticalHttpHints.ts)); **scheduled QM CSV** to object storage via org schedule + ARQ (`ENABLE_ANALYTICS_QM_EXPORT_CRON`, [analytics_qm_export_tasks.py](../api/tasks/analytics_qm_export_tasks.py)). **Next:** sampling jobs / notifications; richer per-`catalog_slug` widget content (aggregates from `mapped_data`). |

## Checklist (template + analytics together)

- [x] Each vertical **runbook** links to the **metrics** that prove the pack’s primary use case (see [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md)) — **Proof in Analytics (MK-01)** sections in [runbooks/](../runbooks/) (healthcare, retail, B2B SaaS).  
- [x] HTTP-heavy demos document **which** `response_mapping` keys pair with **which** analytics surfaces — see **Overview widgets ↔ data sources ↔ HTTP `response_mapping`** in [VERTICAL_ANALYTICS_HTTP_MATRIX.md](VERTICAL_ANALYTICS_HTTP_MATRIX.md); Overview **Revenue & booking** widget shows per-slug hints from [analyticsVerticalHttpHints.ts](../ui/src/lib/analyticsVerticalHttpHints.ts).  
- [ ] No analytics copy promises **AI grading** until models and retention policy are named in PR.

**Maintainers:** keep [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml) aligned with live routes; document any response-only fields in the YAML description blocks.
