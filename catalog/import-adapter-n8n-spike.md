# n8n → packaged workflow import spike (MK-01-IMPORT-OPTIONS)

**Status:** research / manual mapping — **no importer code** in this repo yet. Complements [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md) and the native playbook [import-packaged-workflow-json.md](import-packaged-workflow-json.md).

## Why n8n first (optional)

- Exports are **JSON** (workflow array + nodes with `type`, `parameters`, `connections`).
- A large share of automation users already run **HTTP Request** nodes — conceptually close to our **HTTP API tool** + agent graph.

## What does **not** map 1:1

| n8n | Our graph / tools |
|-----|-------------------|
| Arbitrary node types (IF, Set, Code) | Workflow nodes are a **fixed** voice/agent palette; logic must be refactored into agents + tools + subgraphs. |
| Credentials store | Our **credential UUID** per tool + org encryption. |
| Webhook trigger as entry | Our **Start / Trigger** + telephony or Web embed — entry contract differs. |

## Practical spike (half day)

0. Optional: **`node catalog/scripts/validate-n8n-workflow-export.mjs path/to/export.json`** — confirms `nodes[]` exists. Add **`--http-hints`** for JSON summaries of HTTP Request–style nodes (method/url preview; still manual map).
1. Export a **small** n8n workflow: one **Webhook** or **Manual** trigger + one **HTTP Request** node + optional **Set** node.
2. Open `catalog/packaged-workflows/*.json` and [import-packaged-workflow-json.md](import-packaged-workflow-json.md).
3. **Manually** create a minimal packaged graph: **Agent** + **HTTP tool** whose URL/method/body match the HTTP Request node; map **Set** fields to **template variables** or **call context** paths documented in [http-api.mdx](../docs/voice-agent/tools/http-api.mdx).
4. Validate with `POST /api/v1/workflow/create/definition` (or local graph validator used in CI).
5. Record **failure modes** in [IMPORT_ADAPTERS_SPIKE.md](IMPORT_ADAPTERS_SPIKE.md) (auth, binary bodies, pagination).

## If you later ship code

- Define a **supported subset**: e.g. only chains of **HTTP Request** + **Merge** into a single tool, reject unsupported nodes with a clear report.
- Tests: golden file `n8n-export.json` → expected **warnings** list + one happy-path packaged JSON.
- Update **READMEPLANTOEXECUTE** → **MK-01-IMPORT-OPTIONS** status and [READMENEWRELEASES.md](../READMENEWRELEASES.md).
