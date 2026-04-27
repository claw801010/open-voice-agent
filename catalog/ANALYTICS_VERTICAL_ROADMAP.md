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
| **B — Ingest** | **Shipped (MVP):** `GET /api/v1/analytics/calls` + `GET …/calls/{call_id}` ([api/routes/analytics.py](../api/routes/analytics.py)) — org-scoped list/detail from `workflow_runs`; **tool_spans** derived from persisted `logs.realtime_feedback_events` (HTTP summaries from tool result JSON). **Deferred:** dedicated span rows + PII redaction matrix ([PARTNER_REVIEW.md](PARTNER_REVIEW.md)). |
| **C — UI** | Calls list + detail MVP; one default dashboard template per vertical pack slug. |
| **D — Custom** | Widget card library + save custom layout; export CSV for QM. |

## Checklist (template + analytics together)

- [ ] Each vertical **runbook** links to the **metrics** that prove the pack’s primary use case (see [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md)).  
- [ ] HTTP-heavy demos document **which** `response_mapping` keys feed **which** dashboard widget.  
- [ ] No analytics copy promises **AI grading** until models and retention policy are named in PR.

**Maintainers:** keep [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml) aligned with live routes; document any response-only fields in the YAML description blocks.
