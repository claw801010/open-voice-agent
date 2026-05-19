# Agent skills → voice workflow draft (MK-01-IMPORT-OPTIONS)

**Status:** **importer shipped** — **`POST /api/v1/workflow/import/skill-packaged-draft`**. This doc remains the manual mapping reference. Complements [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md).

## Purpose

Evaluate **Claude skills**, **Cursor rules/skills**, and **Codex**-style instruction bundles as accelerators for drafting **agent prompts**, **template variables**, and **HTTP tool descriptions** — not as executable runtime graphs.

## What skills are (in practice)

| Source | Typical artifact | Useful extract |
|--------|------------------|----------------|
| **Cursor** | `.cursor/skills/*/SKILL.md`, rules | Step lists, constraints, domain vocabulary |
| **Claude** | `SKILL.md` + optional scripts | Procedures, checklists, example utterances |
| **Codex / custom** | `AGENTS.md`, recipe markdown | API paths, env vars, test plans |

None of these execute on our **Pipecat** voice runtime. Treat them as **authoring input** for marketplace packs and builder onboarding.

## Proposed mapping (v0 — manual)

1. **Read** the skill markdown (and linked files referenced in the skill).
2. Extract **role**, **constraints**, **tools/API mentions**, and **sample phrases**.
3. Paste distilled content into:
   - **Agent node** `prompt` on a packaged graph ([import-packaged-workflow-json.md](import-packaged-workflow-json.md)), or
   - **Template variables** + runbook steps under [runbooks/](../runbooks/).
4. For each external HTTP API named in the skill, add an **HTTP API tool** in the UI and reference `{{variables}}` per [http-api.mdx](../docs/voice-agent/tools/http-api.mdx).
5. Validate with catalog rubric [TEMPLATE_QUALITY_RUBRIC.md](TEMPLATE_QUALITY_RUBRIC.md) and `POST /api/v1/workflow/create/definition`.

## What does **not** map 1:1

| Skill artifact | Dograh |
|----------------|--------|
| Shell/Python scripts in skill folders | Not run during calls unless wrapped as **HTTP tools** or ADK automation |
| IDE-only file paths | Use repo-relative **runbook** links instead |
| Multi-agent orchestration in skill text | Single **agentNode** per call leg unless you design **subflows** ([WE-01-SUBFLOWS](../READMEPLANTOEXECUTE.md)) |

## Failure modes

| Risk | Mitigation |
|------|------------|
| Skill assumes batch/offline processing | Rewrite for **turn-by-turn** voice; add barge-in / interrupt notes |
| Skill embeds secrets or live URLs with tokens | Strip before commit; use `{{credential}}` / org credential UUIDs |
| Skill contradicts rubric (PII, medical claims) | [PARTNER_REVIEW.md](PARTNER_REVIEW.md) + gate 9 in rubric |
| Over-long prompt from pasted skill | Summarize; link runbook for detail |

## Security

- Do not commit customer-specific skill exports with API keys or PHI.
- Future **skills importer** (if built) should return **summaries** only, same posture as [n8n_workflow_adapter.py](../api/utils/n8n_workflow_adapter.py).

## Shipped

- [skill_packaged_adapter.py](../api/utils/skill_packaged_adapter.py) — `draft_packaged_workflow_from_skill`, `{{var}}` extraction, prompt truncation.
- **`POST /api/v1/workflow/import/skill-packaged-draft`** and **`/import/skill-and-create`** ([workflow.py](../api/routes/workflow.py)).
- Fixture: [skill-booking-draft.sample.md](fixtures/skill-booking-draft.sample.md).

## References

- Shipped importers: [n8n_workflow_adapter.py](../api/utils/n8n_workflow_adapter.py), [make_scenario_adapter.py](../api/utils/make_scenario_adapter.py)
- [import-adapter-make-zapier-spike.md](import-adapter-make-zapier-spike.md) — Make / Zapier
- [READMEEXPERIENCE.md](../READMEEXPERIENCE.md) — no-code / builder / ADK tiers
