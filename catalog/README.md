# Catalog — vertical packs (MK-01)

**Purpose:** machine-readable **vertical pack** metadata aligned with [READMEPLANNING.md](../READMEPLANNING.md) §6 and epic **MK-01-CATALOG** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md). **Marketplace + import strategy:** [READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md).

| File | Role |
|------|------|
| [vertical-packs.json](vertical-packs.json) | Canonical JSON for **≥5** verticals (healthcare, retail, B2B SaaS, insurance, hospitality); each entry references a **runbook** under [runbooks/](../runbooks/). |
| [catalog-variant-http-tools.json](catalog-variant-http-tools.json) | **Variant → HTTP tool names** for complex packaged graphs; consumed by workflow catalog guide + [analyticsVerticalHttpHints.ts](../ui/src/lib/analyticsVerticalHttpHints.ts). |
| [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md) | **Booking + revenue motions** gap analysis vs shipped graphs; next slices for prebuilt marketplace demos (**MK-01-RUBRIC**). |
| [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md) | **Calls, dashboards, APIs, DB** — analytics companion for vertical prebuilds (**MK-01-ANALYTICS-VERTICAL**). |
| [ANALYTICS_REDACTION_MATRIX.md](ANALYTICS_REDACTION_MATRIX.md) | **QM / privacy reviewers** — surfaces × v1 redaction × RBAC; deferred RLS / span table called out. |
| [VERTICAL_ANALYTICS_HTTP_MATRIX.md](VERTICAL_ANALYTICS_HTTP_MATRIX.md) | **Reviewer matrix:** each **`catalog_slug`** ↔ booking story ↔ HTTP tools ↔ **`response_mapping`** ↔ analytics filters. |
| [recipes/booking-http-analytics-smoke.md](recipes/booking-http-analytics-smoke.md) | **MK-01 smoke:** `response_mapping` → **`mapped_data`** → analytics tool span (pytest + sample JSON). |
| [recipes/http-api-analytics-redaction-gtm-demo.md](recipes/http-api-analytics-redaction-gtm-demo.md) | **GTM runbook:** HTTP tool → Analytics → org **PII redaction** / RBAC; companion script [gtm-http-api-analytics-redaction-demo.sh](../scripts/gtm-http-api-analytics-redaction-demo.sh). |
| [recipes/local-scheduling-all-in-one.md](recipes/local-scheduling-all-in-one.md) | **All-in-one local calendar** — book, reschedule, `.ics` invites; no external scheduler. |
| [recipes/local-payments-all-in-one.md](recipes/local-payments-all-in-one.md) | **All-in-one local payments** — collections, payment redirect, concierge enroll. |
| [recipes/local-integrations-all-in-one.md](recipes/local-integrations-all-in-one.md) | **All-in-one local integrations** — CRM, OSS, ATS, banking, civic, hospitality HTTP tools. |
| [recipes/healthcare-ehr-all-in-one.md](recipes/healthcare-ehr-all-in-one.md) | **Healthcare EHR + messaging** — patient context, prior auth, chart sync, SMS/email, review inbox. |
| [recipes/local-all-in-one-gtm-demo.md](recipes/local-all-in-one-gtm-demo.md) | **GTM walkthrough** — zero-`:8765` demo script + UI checklist for local stack. |
| [recipes/prebuild-vertical-demo-matrix.md](recipes/prebuild-vertical-demo-matrix.md) | **PREBUILD complete:** slug × variant × HTTP tool × local endpoint matrix for GTM / QA (all 10 verticals). |
| [buyer-demo-defaults.json](buyer-demo-defaults.json) | Default **`catalog_variant_id`** + settings hash per slug for marketplace proof links and `./scripts/buyer-demo-*.sh`. |
| [buyer-demo-hints.json](buyer-demo-hints.json) | **In-product tips** — buyer story, wire-local hover copy, compliance notes (marketplace + workflow guide). |
| [recipes/catalog-buyer-demo.md](recipes/catalog-buyer-demo.md) | One-command buyer install + shortcut scripts. |
| [analytics-calls-api-draft.yaml](analytics-calls-api-draft.yaml) | **OpenAPI draft** — contract for `GET /api/v1/analytics/insights`, `GET /api/v1/analytics/calls` + detail ([api/routes/analytics.py](../api/routes/analytics.py)); **HttpToolSpanSummary**; insights + `catalog_slug` filters. |
| [packaged-workflows/looptalk-simulated-caller.json](packaged-workflows/looptalk-simulated-caller.json) | **System** adversary graph for LoopTalk quick-persona tests (not a marketplace vertical); installed per org as `[System] LoopTalk simulated caller` via `POST /api/v1/looptalk/test-sessions/quick-persona`. |
| [PARTNER_REVIEW.md](PARTNER_REVIEW.md) | Partner / community **review checklist** (safety, PII, telephony compliance) before a pack is **published** — **MK-01-PARTNER**. |

**Relationship to the API:** production templates may live in `workflow_templates` ([api/db/models.py](../api/db/models.py) `WorkflowTemplates`). This repo catalog is the **source of truth for marketing and packaging** until each pack is bound to a `template_id` (see `workflow_template` on each pack).

**Execution ID:** **MK-01-CATALOG**.

**Template quality rubric:** see **MK-01-RUBRIC** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md). **Reviewer worksheet:** [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) (copy into PRs); complements [PARTNER_REVIEW.md](PARTNER_REVIEW.md). **CI:** [test_vertical_packs_catalog.py](../api/tests/test_vertical_packs_catalog.py) guards `vertical-packs.json` shape, on-disk refs, and **parses every** `catalog/packaged-workflows/*.json` as a minimal **nodes/edges** graph. PRs touching the catalog: see [.github/pull_request_template.md](../.github/pull_request_template.md).

**Import adapters spike (MK-01-IMPORT-OPTIONS):** worksheet [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md) — owner, first target, security notes. **Native JSON playbook:** [import-packaged-workflow-json.md](import-packaged-workflow-json.md). **n8n (shipped):** [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md) + `POST /api/v1/workflow/import/n8n-packaged-draft`. **Make / Zapier / skills (shipped):** `POST /api/v1/workflow/import/{make|zapier|skill}-packaged-draft` — [import-packaged-workflow-json.md](import-packaged-workflow-json.md). **n8n:** [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md). **n8n export check:** `node catalog/scripts/validate-n8n-workflow-export.mjs <file.json>`; **`--http-hints`** / **`--transform-hints`** for JSON summaries. **CI fixture:** [fixtures/n8n-minimal-http-request.json](fixtures/n8n-minimal-http-request.json) ([catalog-n8n-validate.yml](../.github/workflows/catalog-n8n-validate.yml)); **UI Vitest** also runs the validator via [n8nFixtureValidate.test.ts](../ui/src/lib/n8nFixtureValidate.test.ts) when `catalog/` or the script changes ([ui-vitest.yml](../.github/workflows/ui-vitest.yml)).

## Pack versioning (semver)

Each pack in `vertical-packs.json` includes **`pack_semver`** (`major.minor.patch`):

- **Major** — Breaking change to variable names, graph entry/exit contract, or required tools.
- **Minor** — Additive nodes, new optional variables, or expanded use cases without breaking existing installs.
- **Patch** — Copy, runbook, or metadata-only updates.

The top-level **`catalog_version`** integer bumps when the **schema or file shape** of the catalog changes (e.g. new required fields across all packs). **`catalog_version` 4** adds optional **`workflow_variants`** (simple vs complex packaged graphs per vertical). Optional per-pack fields such as **`analytics_hooks`** and **`roadmap_motions`** (high-revenue motions explicitly labeled **roadmap** — see [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md)) do not require adopters to change installs.

**Partner submissions:** bump `pack_semver` on every published update to that pack; document changes in the PR description.
