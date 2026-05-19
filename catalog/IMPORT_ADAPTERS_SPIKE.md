# Import adapters spike (MK-01-IMPORT-OPTIONS)

**Status:** living worksheet — update when an owner picks a first target and ships a spike or code.

## Purpose

Evaluate **Make**, **n8n**, **Zapier**, and **agent skills** (Claude, Cursor, Codex) as accelerators for bringing flows into the curated marketplace — **without** blocking native JSON + catalog quality ([READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md)).

## Spike owner

| Field | Value |
|-------|--------|
| Owner | **Open-source / fork maintainers** (assign a named owner per PR or sprint) |
| First target (pick **one** to start) | **Native JSON** + rubric CI. · **n8n / Make / Zapier / skills (shipped):** see [import-packaged-workflow-json.md](import-packaged-workflow-json.md). · Follow-on: native Zapier platform export shapes beyond [catalog/fixtures](fixtures/) subset. |
| Target completion | _date_ |

## First target — scope notes

When you choose one line above, fill in:

- **Supported nodes / fields** (what maps 1:1 into our graph model; what is manual).
- **Failure modes** (auth expiry, partial runs, idempotency, rate limits).
- **Security** (credentials never logged; PII in payloads; least-privilege tokens).

## If code ships

- [x] Tests for **n8n v0** adapter surface — [test_n8n_workflow_adapter_unit.py](../api/tests/test_n8n_workflow_adapter_unit.py).
- [x] Update [READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md) §5 “Shipped experiments” (**MK-01-IMPORT-OPTIONS**).
- [x] Tests for **Make**, **Zapier**, **skills** — unit + route pytest in CI.

## References

- Execution package: [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md) → **MK-01-IMPORT-OPTIONS**
- Native JSON import playbook: [import-packaged-workflow-json.md](import-packaged-workflow-json.md)
- n8n manual mapping spike: [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md); structural check + optional hints: `node catalog/scripts/validate-n8n-workflow-export.mjs [--http-hints] [--transform-hints] <export.json>`
- Make importer: [make_scenario_adapter.py](../api/utils/make_scenario_adapter.py); `node catalog/scripts/validate-make-blueprint.mjs [--http-hints] [--set-hints] <blueprint.json>`
- Make / Zapier spike: [import-adapter-make-zapier-spike.md](import-adapter-make-zapier-spike.md)
- Agent skills spike: [import-adapter-skills-spike.md](import-adapter-skills-spike.md)
- Catalog quality gate: [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md), [test_vertical_packs_catalog.py](../api/tests/test_vertical_packs_catalog.py)
