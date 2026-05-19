# Analytics — redaction & governance matrix (MK-01 reviewer doc)

**Execution:** **MK-01-ANALYTICS-VERTICAL** · companion to [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md), [PARTNER_REVIEW.md](PARTNER_REVIEW.md), [VERTICAL_ANALYTICS_HTTP_MATRIX.md](VERTICAL_ANALYTICS_HTTP_MATRIX.md).  
**Implementation:** [analytics_redact.py](../api/services/analytics/analytics_redact.py), [redaction_policy_rbac.py](../api/services/analytics/redaction_policy_rbac.py), [analytics.py](../api/routes/analytics.py).

This document is a **reviewer matrix** for what **v1** does today. It is **not** legal advice and does not replace your DPIA / HIPAA / SOC process.

## Org policy & RBAC

| Control | API / UI | Behavior |
|---------|-----------|----------|
| Detail + server CSV redaction on/off | `GET`/`PUT /api/v1/analytics/redaction-policy`, Overview toggle ([AnalyticsDashboardClient.tsx](../ui/src/app/analytics/AnalyticsDashboardClient.tsx)) | Default **`detail_redaction_enabled`: true** — redaction applied to call detail JSON and server CSV cells when enabled. |
| Who may turn redaction **off** | Same policy responses include `may_disable_detail_redaction` | **API keys** cannot disable. OSS/local: optional superuser-only or Stack permission via env ([redaction_policy_rbac.py](../api/services/analytics/redaction_policy_rbac.py)). |

## Surfaces × v1 redaction (when policy ON)

| Surface | Route / artifact | What v1 redacts | Not covered in v1 |
|---------|------------------|-----------------|-------------------|
| Call detail | `GET /api/v1/analytics/calls/{call_id}` | **`tool_spans[].http.mapped_data`** via key fragments + string masks; **`http.error_message`**; **`outcomes`** tree; **`ai_summary`**; **`qa.reviewer_notes`** | Raw transcript/audio payloads if exposed elsewhere; **metrics** scalars (counts); **tool_name** strings inside spans (function names). |
| Server CSV export | `GET /api/v1/analytics/calls/export` | Each cell passed through **`redact_csv_cell`** (email/phone-style masks on strings) | Same as detail for column semantics — **`tool_names`** column may contain names authors chose for tools (not key-based tree redaction). |
| Call list (REST + UI) | `GET /api/v1/analytics/calls` | **No** row-level redaction — list is for filtering/navigation; sensitive carry **should not** be stored in disposition/outcome keys. | If your workflow writes PII into **`outcome_key`** or **`tool_names`**, assume list + **client CSV** may expose it until flows are fixed. |
| Client CSV | [exportAnalyticsCallsCsv.ts](../ui/src/lib/exportAnalyticsCallsCsv.ts) | **None** — mirrors whatever the **call list** returned for loaded rows. | Use **server CSV** when governance requires consistent cell redaction. |
| Insights roll-up | `GET /api/v1/analytics/insights` | Aggregates only (**counts**, outcome/tool **names** from logs) — no per-call `mapped_data`. | If tool **function_name** itself is sensitive, treat naming conventions as a workflow concern. |

## Implementation pointers (maintainers)

- **Sensitive keys:** `_SENSITIVE_KEY_FRAGMENTS` in [analytics_redact.py](../api/services/analytics/analytics_redact.py) — extend deliberately; over-broad fragments can hide legitimate operational fields.
- **Plain strings:** Email and NANP-style phone patterns masked via **`redact_plain_string`**.
- **Tests:** [test_analytics_redact_unit.py](../api/tests/test_analytics_redact_unit.py), [test_analytics_redaction_policy_routes.py](../api/tests/test_analytics_redaction_policy_routes.py), [test_redaction_policy_rbac_unit.py](../api/tests/test_redaction_policy_rbac_unit.py).

## Deferred (README Phase D)

| Topic | Notes |
|-------|--------|
| Dedicated **`tool_spans` table** | Would normalize persistence and retention policies per column; today spans are derived from **`workflow_runs.logs`**. |
| **Row-level security** (RLS) | Enterprise DB replicas — product API remains default integration path ([ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md)). |
| **Scheduled QM exports** | Async jobs / sampling — not shipped; use server CSV + filters today. |

**Maintainers:** bump this matrix when adding new analytics export routes or new detail fields with possible PII.
