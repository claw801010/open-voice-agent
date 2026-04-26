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

If the graph should appear in the **template catalog**, add or extend an entry in [`vertical-packs.json`](vertical-packs.json) with `workflow_template.packaged_definition_ref`, then install with **`POST /api/v1/workflow/install-from-catalog`** (see **MK-01-INSTALL** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md)).

## References

- Spike worksheet: [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md)
- Rubric: [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md)
