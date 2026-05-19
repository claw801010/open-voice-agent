# Make & Zapier → packaged workflow import spike (MK-01-IMPORT-OPTIONS)

**Status:** **Make importer shipped**; **Zapier** remains manual mapping in this doc. Complements [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md), [import-packaged-workflow-json.md](import-packaged-workflow-json.md), [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md), and [import-adapter-skills-spike.md](import-adapter-skills-spike.md).

## Why evaluate Make / Zapier

| Platform | Typical export | Overlap with Dograh |
|----------|----------------|---------------------|
| **Make** (Integromat) | Scenario **blueprint** JSON (modules, routes, filters) | HTTP modules, routers, and data stores resemble **HTTP tools** + **agent branching** |
| **Zapier** | Zap export / Platform UI copy; limited public JSON for full zaps | **Webhooks** + **Code by Zapier** + app actions map to **HTTP tools** and template variables |

Both are common among GTM buyers who already automate CRM, scheduling, and notifications — useful as **accelerators** for curated vertical packs, not as runtime dependencies.

## What does **not** map 1:1

| Source | Dograh |
|--------|--------|
| Make **Router** / **Filter** / **Iterator** | Voice graph: **agent** decisions + optional **`subflows`** / `enter_subflow` (see n8n IF/Switch import) |
| Zapier **Paths** / **Looping** | Same — refactor into agent prompts and HTTP tool `response_mapping` |
| Built-in app modules (Salesforce, Slack, …) | **HTTP API tool** with org credentials, or manual stub + runbook |
| Scenario/Zap **triggers** (schedule, webhook) | **Start / Trigger** + telephony or Web embed — entry contract differs |
| OAuth bundles in vendor UI | Our **credential UUID** per tool + org encryption |

## Suggested first target (when coding)

**Make blueprint JSON** before Zapier: exports are a single JSON document with explicit `flow` / module list in many templates; easier to golden-test than Zapier’s mixed export surfaces.

**Supported subset (proposed v0):**

- Modules whose `module` URL or type is **HTTP** (Make “HTTP — Make a request”).
- One **Router** → emit **prompt-only** branch summary (mirror n8n v1.3).
- **Set variable** / **Tools > Set multiple variables** → template-variable hints (mirror n8n Set v1.4).
- Reject or warn on everything else with a typed report.

**Zapier v0 (later):**

- Zaps that are **Webhook → Code → Webhooks POST** only.
- Parse trigger + action steps from export when JSON is available; otherwise stay **manual** per this doc.

## Practical spike (half day, no code)

1. Export one **small** Make scenario: Router → two HTTP modules (or HTTP + Set + HTTP).
2. Export one **small** Zapier Zap with the same shape (if JSON export is available in your plan; otherwise screenshot + module list in PR).
3. Open [catalog/packaged-workflows/](packaged-workflows/) and [import-packaged-workflow-json.md](import-packaged-workflow-json.md).
4. **Manually** build **startCall → agentNode → endCall**; list HTTP methods/URLs in the agent prompt; map Set fields to `{{template}}` keys per [http-api.mdx](../docs/voice-agent/tools/http-api.mdx).
5. Validate with `POST /api/v1/workflow/create/definition` or `POST /api/v1/workflow/import/n8n-packaged-draft` as a **reference** for hint style (n8n is not Make/Zapier, but the **prompt + warnings** pattern is the same).
6. Record findings below in [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md) (failure modes, security).

## Failure modes (worksheet)

| Risk | Make | Zapier |
|------|------|--------|
| Auth / connection expiry | Connections per scenario; blueprint may reference connection IDs without secrets | Zap-level OAuth; exports rarely include tokens |
| Partial runs / incomplete data | Scenario stores; resume not 1:1 with voice call state | Task history in Zapier; not visible in export |
| Rate limits / pagination | Iterator modules; HTTP paging in formulas | Polling triggers differ from voice **push** model |
| PII in module payloads | Filter formulas may embed emails/phones | Formatter steps may log PII — **redact** in runbooks |

## Security (do not skip)

- Treat blueprint/Zap JSON as **sensitive** if it contains URLs with tokens, sample payloads, or customer fields.
- Never commit live **API keys**; use [catalog/fixtures/](fixtures/) with fake hosts only.
- Importers must **not** log full export bodies in production; return **warnings** + summarized hints only (same posture as [n8n_workflow_adapter.py](../api/utils/n8n_workflow_adapter.py)).

## Relationship to shipped n8n importer

| Capability | n8n (shipped) | Make (shipped) | Zapier (this spike) |
|------------|---------------|----------------|---------------------|
| HTTP hints | Yes | Yes | Manual |
| Set / transform hints | Yes (Set/Code/Merge) | Yes (Set variables) | Manual |
| Branch → subflows | IF/Switch | Router routes | Manual |
| REST import API | `/import/n8n-packaged-draft` | `/import/make-packaged-draft` | Not yet |

## Make — shipped

- [make_scenario_adapter.py](../api/utils/make_scenario_adapter.py) — `draft_packaged_workflow_from_make`, Router→subflows, Set hints.
- **`POST /api/v1/workflow/import/make-packaged-draft`** and **`/import/make-and-create`** ([workflow.py](../api/routes/workflow.py)).
- Fixtures: [make-router-two-http.json](fixtures/make-router-two-http.json), [make-set-http.json](fixtures/make-set-http.json).
- CLI: `node catalog/scripts/validate-make-blueprint.mjs [--http-hints] [--set-hints] <file.json>`.

## Zapier — shipped (import subset)

- [zapier_zap_adapter.py](../api/utils/zapier_zap_adapter.py) — documented `steps[]` JSON (not all native Zapier exports).
- **`POST /api/v1/workflow/import/zapier-packaged-draft`** and **`/import/zapier-and-create`**.
- Fixtures: [zapier-webhook-code-http.json](fixtures/zapier-webhook-code-http.json), [zapier-paths-two-http.json](fixtures/zapier-paths-two-http.json).
- CLI: `node catalog/scripts/validate-zapier-export.mjs [--http-hints] <file.json>`.

## References

- [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md) — owner table
- [import-adapter-n8n-spike.md](import-adapter-n8n-spike.md) — shipped n8n reference implementation
- [READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md) §5 — marketplace import posture
