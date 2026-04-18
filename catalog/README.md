# Catalog — vertical packs (MK-01)

**Purpose:** machine-readable **vertical pack** metadata aligned with [READMEPLANNING.md](../READMEPLANNING.md) §6 and epic **MK-01-CATALOG** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md).

| File | Role |
|------|------|
| [vertical-packs.json](vertical-packs.json) | Canonical JSON for **≥3** verticals (healthcare, retail, B2B SaaS); each entry references a **runbook** under [runbooks/](../runbooks/). |

**Relationship to the API:** production templates may live in `workflow_templates` ([api/db/models.py](../api/db/models.py) `WorkflowTemplates`). This repo catalog is the **source of truth for marketing and packaging** until each pack is bound to a `template_id` (see `workflow_template` on each pack).

**Execution ID:** **MK-01-CATALOG**.
