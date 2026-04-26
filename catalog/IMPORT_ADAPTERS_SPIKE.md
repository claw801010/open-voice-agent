# Import adapters spike (MK-01-IMPORT-OPTIONS)

**Status:** living worksheet — update when an owner picks a first target and ships a spike or code.

## Purpose

Evaluate **Make**, **n8n**, **Zapier**, and **agent skills** (Claude, Cursor, Codex) as accelerators for bringing flows into the curated marketplace — **without** blocking native JSON + catalog quality ([READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md)).

## Spike owner

| Field | Value |
|-------|--------|
| Owner | _TBD_ |
| First target (pick **one** to start) | ☐ Native packaged JSON hardening · ☐ n8n webhook-only subset · ☐ Skill bundle → draft prompts |
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
- Catalog quality gate: [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md), [test_vertical_packs_catalog.py](../api/tests/test_vertical_packs_catalog.py)
