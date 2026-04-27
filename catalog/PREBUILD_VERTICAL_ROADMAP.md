# Prebuild vertical roadmap — booking, revenue motions, and HTTP-ready packs (MK-01)

**Execution ID:** [MK-01-RUBRIC](../READMEPLANTOEXECUTE.md#mk-01-rubric--template-quality-rubric-stub) (curated templates before marketplace scale)  
**Canonical catalog:** [vertical-packs.json](vertical-packs.json) · **Rubric:** [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) · **Partner gate:** [PARTNER_REVIEW.md](PARTNER_REVIEW.md)

This document answers: *Are our shipped vertical packs ready to clone into **prebuilt** buyer demos where **booking / scheduling** and other **high-revenue** motions are obvious?* It complements strategy in [READMEPLANNING.md](../READMEPLANNING.md) §6.

## Current packs (what ships today)

| Slug | Industry | Pack focus today | HTTP / tools posture |
|------|----------|------------------|----------------------|
| [healthcare-clinic-screening](packaged-workflows/healthcare-clinic-screening.json) | Healthcare / clinics | Screening, triage, after-hours guardrails; confirm/remind adjacent | Extend with **EHR or scheduling API** tools when buyer has creds; use system/conversation variables per [HTTP API tool docs](../docs/voice-agent/tools/http-api.mdx) |
| [retail-wismo-faq](packaged-workflows/retail-wismo-faq.json) | Retail / e-commerce | WISMO, returns, hours | Natural extension: **OMS + appointment / pickup slot** HTTP tools |
| [b2b-saas-trial-nurture](packaged-workflows/b2b-saas-trial-nurture.json) | B2B SaaS | Trial nurture, PQL voice, onboarding check-in | Extend with **CRM + calendar booking** (demo, QBR, onboarding call) |

Each row must keep **happy-path QA** in its [runbook](../runbooks/README.md) and pass [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) before we market it as “revenue-ready.”

## Gap: “Book an appointment” as a **primary** story per vertical

Buyers often evaluate voice AI on **scheduling** first. Today’s graphs lead with **triage / FAQ / nurture**; booking is **secondary or roadmap** in copy, not yet a dedicated packaged graph per vertical.

| Vertical | Booking story buyers expect | Status |
|----------|------------------------------|--------|
| Healthcare | Book **provider / visit type / location**; confirm slot; reschedule | **Roadmap** — extend graph + variables (`clinic_booking_api_url`, slot prefs) + HTTP tool to scheduling connector |
| Retail | Book **in-store service, styling, or pickup window** | **Roadmap** — add nodes + optional HTTP to calendar/retail API |
| B2B SaaS | Book **demo, onboarding, or CS escalation** | **Roadmap** — CRM + calendar HTTP tools; align `default_template_variables` with CRM owner + booking link |

**Next engineering slice (suggested order):** (1) add **documented happy path** “book in under N turns” to each runbook even if stubbed; (2) ship **one** vertical with a minimal **HTTP Book** tool + sample `call_context` / template variables; (3) replicate pattern to the other two.

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

Buyer demos need **observability**: filterable **calls**, **call detail** (outcomes, metrics, tool/API traces, QA/QM), **default + custom dashboards** (widget cards), and eventually **APIs / DB** access for enterprise.

Scope, phasing, and vertical-specific widget ideas: **[ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md)**. When packs add HTTP tools, align **response_mapping** keys with the metrics and widgets you plan to show.

## Checklist before marketing “prebuild for {vertical}”

- [ ] Runbook happy path matches the graph (rubric row 3).  
- [ ] `use_cases` and `summary` match what the graph does (rubric row 8).  
- [ ] Revenue or booking claims are **either** implemented in JSON **or** explicitly labeled roadmap in this file + runbook.  
- [ ] PARTNER_REVIEW + compliance tags reviewed for new tools or PII.  
- [ ] `pack_semver` bumped per [catalog/README.md](README.md).
- [ ] Runbook or pack PR links **metrics / analytics** expectations to [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md) when claiming buyer-visible insights.

**Maintainers:** when a new packaged graph ships, add a row to the first table and shrink the booking gap column to **Shipped**.
