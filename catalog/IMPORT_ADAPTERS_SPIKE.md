# Import adapters spike (MK-01-IMPORT-OPTIONS)

**Status:** living worksheet — update when an owner picks a first target and ships a spike or code.

## Purpose

Evaluate **Make**, **n8n**, **Zapier**, and **agent skills** (Claude, Cursor, Codex) as accelerators for bringing flows into the curated marketplace — **without** blocking native JSON + catalog quality ([READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md)).

## Spike owner

| Field | Value |
|-------|--------|
| Owner | **Open-source / fork maintainers** (assign a named owner per PR or sprint) |
| First target (pick **one** to start) | **Suggested default:** native packaged JSON + graph validation hardening (extends [test_vertical_packs_catalog.py](../api/tests/test_vertical_packs_catalog.py) / rubric). · **External spike doc:** [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md) (manual n8n → packaged JSON). · ☐ n8n importer code · ☐ Skill bundle → draft prompts |
| Target completion | _date_ |

## First target — scope notes

When you choose one line above, fill in:

- **Supported nodes / fields** (what maps 1:1 into our graph model; what is manual).
- **Failure modes** (auth expiry, partial runs, idempotency, rate limits).
- **Security** (credentials never logged; PII in payloads; least-privilege tokens).

## If code ships

- [ ] Tests for the chosen adapter surface (happy path + one failure).
- [ ] Update [READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md) §5 “Shipped experiments” with ID **MK-01-IMPORT-OPTIONS**.

## References

- Execution package: [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md) → **MK-01-IMPORT-OPTIONS**
- Native JSON import playbook: [import-packaged-workflow-json.md](import-packaged-workflow-json.md)
- n8n manual mapping spike: [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md); structural check: `node catalog/scripts/validate-n8n-workflow-export.mjs <export.json>`
- Catalog quality gate: [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md), [test_vertical_packs_catalog.py](../api/tests/test_vertical_packs_catalog.py)
