# Import a packaged workflow JSON (developer playbook)

**Work package:** **MK-01-IMPORT-OPTIONS** (native JSON path — not Make/n8n/Zapier).

Use this when you have a graph under [`packaged-workflows/`](packaged-workflows/) (or another validated `nodes` / `edges` JSON) and want it in a **dev org** without publishing a full catalog pack yet.

## 1. Validate shape locally

The repo CI gate parses every packaged file:

```bash
cd api && pytest tests/test_vertical_packs_catalog.py -q
```

Fix any parse or minimal graph errors before importing.

## 2. Create a workflow from raw JSON (API)

Authenticated **`POST /api/v1/workflow/create/definition`** creates a workflow in the caller’s organization from a definition object (same shape as the editor save).

**n8n (subset):** call **`POST /api/v1/workflow/import/n8n-packaged-draft`** with `{ "n8n_export": <n8n JSON> }` — returns `{ "workflow_definition", "warnings" }`. Or one step: **`POST /api/v1/workflow/import/n8n-and-create`** with `{ "name": "…", "n8n_export": … }` — creates the workflow row and returns the same fields as create + **`warnings`**. **Default:** non-HTTP nodes are **skipped** with warnings (IF/Switch are kept for branch mapping); set **`"strict_http_only": true`** to allow only HTTP + IF/Switch. **`emit_branch_subflows`** (default **true**) maps each IF/Switch output to a **subflow** and adds **`enter_subflow`** transitions on the main agent. Same logic as [n8n_workflow_adapter.py](../api/utils/n8n_workflow_adapter.py) (HTTP hints, **Set/Code/Merge** transform hints, IF/Switch subflows); fixtures [n8n-if-two-branches-http.json](fixtures/n8n-if-two-branches-http.json), [n8n-set-code-http.json](fixtures/n8n-set-code-http.json); see [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md). **Make (subset):** **`POST /api/v1/workflow/import/make-packaged-draft`** — [make_scenario_adapter.py](../api/utils/make_scenario_adapter.py); fixture [make-router-two-http.json](fixtures/make-router-two-http.json). **Zapier (subset):** **`POST /api/v1/workflow/import/zapier-packaged-draft`** — `{ "zapier_export": { "steps": [...] } }` per [zapier_zap_adapter.py](../api/utils/zapier_zap_adapter.py); fixtures [zapier-webhook-code-http.json](fixtures/zapier-webhook-code-http.json). **Skills:** **`POST /api/v1/workflow/import/skill-packaged-draft`** — `{ "skill_markdown": "…" }` → `workflow_definition`, `suggested_template_variables`, `agent_prompt_draft` ([skill_packaged_adapter.py](../api/utils/skill_packaged_adapter.py)). Each vendor also has **`/import/{vendor}-and-create`**. For draft-only import, pass `workflow_definition` into **`POST /api/v1/workflow/create/definition`**, then add HTTP tools in the UI.

Example (replace `YOUR_TOKEN` and inline a real `workflow_definition` from a packaged file):

```bash
curl -sS -X POST "http://127.0.0.1:8000/api/v1/workflow/create/definition" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dev import — my pack",
    "workflow_definition": { "nodes": [], "edges": [] }
  }'
```

Use your OpenAPI client (`npm run generate-client` in `ui/`) in app code for production flows.

## 3. Prefer the catalog path when shipping to buyers

If the graph should appear in the **template catalog**, add or extend an entry in [`vertical-packs.json`](vertical-packs.json) with `workflow_template.packaged_definition_ref`, then install with **`POST /api/v1/workflow/install-from-catalog`** (see **MK-01-INSTALL** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md)). When the pack defines **`workflow_variants`**, the request body may include **`variant_id`** (e.g. `simple` vs `booking_complex`) to install the matching `packaged_definition_ref`; the workflow stores **`catalog_variant_id`** under `workflow_configurations.mk01` for analytics and support.

## References

- **n8n exports (hints only):** Python [n8n_workflow_adapter.py](../api/utils/n8n_workflow_adapter.py) + `node catalog/scripts/validate-n8n-workflow-export.mjs`; playbook [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md).
- Spike worksheet: [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md)
- Rubric: [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md)
