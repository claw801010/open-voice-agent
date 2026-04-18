# READMEADK — Agentic developer kit (API, MCP, IDE)

This file is the **Tier 3** on-ramp for engineers and **coding agents** (Cursor, Copilot, Claude Code): full API access, **MCP**, and repo context—without replacing [READMELEARNME.md](READMELEARNME.md) (architecture) or [READMEBUILDME.md](READMEBUILDME.md) (ops and upstream merges).

**Not your tier?** Start at [READMEEXPERIENCE.md](READMEEXPERIENCE.md) to pick **no-code**, **minimal-code**, or **full ADK**. **All docs:** [DOCS.md](DOCS.md).

**Strategy context:** [READMEPLANNING.md](READMEPLANNING.md) §8 (three tiers). **Execution packages:** [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) epic **DX-01** (`DX-01-ADK`).

---

## What you get

| Surface | URL / path | Notes |
|---------|------------|--------|
| **OpenAPI (machine contract)** | `{BACKEND}/api/v1/openapi.json` | Generate clients; see [api/app.py](api/app.py) `openapi_url`. |
| **REST API** | Prefix `/api/v1` | [READMELEARNME.md](READMELEARNME.md) §3, router index in [READMEBUILDME.md](READMEBUILDME.md). |
| **MCP (Streamable HTTP)** | `{BACKEND}/api/v1/mcp` | Same **X-API-Key** as REST where applicable; [READMELEARNME.md](READMELEARNME.md) §10, [api/mcp/](api/mcp/). |
| **WebRTC signaling** | WebSocket under `/api/v1/ws` | [READMELEARNME.md](READMELEARNME.md) §4. |
| **Telephony media** | WebSocket `/api/v1/telephony/ws/...` | [READMELEARNME.md](READMELEARNME.md) §4. |

Replace `{BACKEND}` with your deployment (e.g. `http://localhost:8000`).

---

## Auth

- **Dashboard / user JWT:** OSS flow in [api/routes/auth.py](api/routes/auth.py); header `Authorization: Bearer …` for user-scoped routes.
- **Org API keys:** programmatic access patterns in [READMEBUILDME.md](READMEBUILDME.md) and [api/routes/service_keys.py](api/routes/service_keys.py) (see `X-API-Key` where used by MCP comment in [api/app.py](api/app.py)).

Never commit keys; use `.env` and secret stores in CI.

---

## Generated TypeScript client (UI repo)

From [ui/](ui/):

```bash
npm run generate-client
```

OpenAPI source: running backend’s `/api/v1/openapi.json` (see [ui/package.json](ui/package.json) `openapi-ts` config). **Do not** hand-edit [ui/src/client/](ui/src/client/).

After changing backend routes, regenerate the client before merging UI that calls new endpoints.

---

## REST example — list workflows (JWT)

Requires a user token from `/api/v1/auth/login` (see [api/routes/auth.py](api/routes/auth.py)).

```bash
export BACKEND="${BACKEND:-http://localhost:8000}"
export TOKEN="your_jwt_here"

curl -s "${BACKEND}/api/v1/workflow/fetch" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" | jq .
```

Full detail for one workflow: `GET /api/v1/workflow/fetch/{workflow_id}` (see [api/routes/workflow.py](api/routes/workflow.py)).

### Python (httpx) sketch

```python
import httpx

BASE = "http://localhost:8000/api/v1"
TOKEN = "your_jwt"

with httpx.Client(base_url=BASE, headers={"Authorization": f"Bearer {TOKEN}"}) as client:
    r = client.get("/workflow/fetch")
    r.raise_for_status()
    print(r.json())
```

Use the same base URL and headers for `POST`/`PATCH` workflow routes; prefer **generated** clients for production ([openapi-generator](https://openapi-generator.tech/) against `/api/v1/openapi.json`) if you do not use the TypeScript UI client.

---

## IDE and coding agents

Point your agent at:

1. This repository (or your fork).
2. `{BACKEND}/api/v1/openapi.json` (fetch into context or use MCP to pull paths).
3. [AGENTS.md](AGENTS.md), [api/AGENTS.md](api/AGENTS.md), [ui/AGENTS.md](ui/AGENTS.md) for file locations.
4. **MCP** at `/api/v1/mcp` for tool-style operations alongside REST.

**Prompt seed (adapt):** “Use the OpenAPI spec at `{BACKEND}/api/v1/openapi.json`. Respect Bearer auth for user routes and org API key rules in READMEBUILDME. Prefer existing patterns in `api/services/workflow/` and Pipecat entrypoints in `api/services/pipecat/run_pipeline.py`.”

---

## Minimal sanity checks

```bash
export BACKEND="${BACKEND:-http://localhost:8000}"

curl -s "${BACKEND}/api/v1/health" | jq .

curl -s "${BACKEND}/api/v1/openapi.json" | head -c 300
echo ""
```

---

## Further reading

- [READMEEXPERIENCE.md](READMEEXPERIENCE.md) — choose no-code vs builder vs ADK.
- [READMELEARNME.md](READMELEARNME.md) — request paths, Pipecat, domain model.
- [READMEBUILDME.md](READMEBUILDME.md) — env vars, local dev, fork sync.
- [AGENTS.md](AGENTS.md), [api/AGENTS.md](api/AGENTS.md), [ui/AGENTS.md](ui/AGENTS.md) — where code lives.
- [READMEPLANNING.md](READMEPLANNING.md) §8 — no-code vs builder vs ADK positioning.
