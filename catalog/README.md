# Catalog — vertical packs (MK-01)

**Purpose:** machine-readable **vertical pack** metadata aligned with [READMEPLANNING.md](../READMEPLANNING.md) §6 and epic **MK-01-CATALOG** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md). **Marketplace + import strategy:** [READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md).

| File | Role |
|------|------|
| [vertical-packs.json](vertical-packs.json) | Canonical JSON for **≥3** verticals (healthcare, retail, B2B SaaS); each entry references a **runbook** under [runbooks/](../runbooks/). |
| [packaged-workflows/looptalk-simulated-caller.json](packaged-workflows/looptalk-simulated-caller.json) | **System** adversary graph for LoopTalk quick-persona tests (not a marketplace vertical); installed per org as `[System] LoopTalk simulated caller` via `POST /api/v1/looptalk/test-sessions/quick-persona`. |
| [PARTNER_REVIEW.md](PARTNER_REVIEW.md) | Partner / community **review checklist** (safety, PII, telephony compliance) before a pack is **published** — **MK-01-PARTNER**. |

**Relationship to the API:** production templates may live in `workflow_templates` ([api/db/models.py](../api/db/models.py) `WorkflowTemplates`). This repo catalog is the **source of truth for marketing and packaging** until each pack is bound to a `template_id` (see `workflow_template` on each pack).

**Execution ID:** **MK-01-CATALOG**.

**Template quality rubric:** see **MK-01-RUBRIC** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md). **Reviewer worksheet:** [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) (copy into PRs); complements [PARTNER_REVIEW.md](PARTNER_REVIEW.md). **CI:** [test_vertical_packs_catalog.py](../api/tests/test_vertical_packs_catalog.py) guards `vertical-packs.json` shape, on-disk refs, and **parses every** `catalog/packaged-workflows/*.json` as a minimal **nodes/edges** graph. PRs touching the catalog: see [.github/pull_request_template.md](../.github/pull_request_template.md).

**Import adapters spike (MK-01-IMPORT-OPTIONS):** worksheet [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md) — owner, first target, security notes before importer code lands. **Native JSON playbook:** [import-packaged-workflow-json.md](import-packaged-workflow-json.md) (`POST /api/v1/workflow/create/definition` + validation). **n8n (manual) spike:** [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md). **n8n export check:** `node catalog/scripts/validate-n8n-workflow-export.mjs <file.json>`; add **`--http-hints`** for HTTP node JSON hints.

## Pack versioning (semver)

Each pack in `vertical-packs.json` includes **`pack_semver`** (`major.minor.patch`):

- **Major** — Breaking change to variable names, graph entry/exit contract, or required tools.
- **Minor** — Additive nodes, new optional variables, or expanded use cases without breaking existing installs.
- **Patch** — Copy, runbook, or metadata-only updates.

The top-level **`catalog_version`** integer bumps when the **schema or file shape** of the catalog changes (e.g. new required fields across all packs).

**Partner submissions:** bump `pack_semver` on every published update to that pack; document changes in the PR description.
