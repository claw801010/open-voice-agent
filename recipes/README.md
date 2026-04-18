# Recipes — minimal-code integrations (builder tier)

**Purpose:** short, copy-paste-friendly **recipes** for [READMEEXPERIENCE.md](../READMEEXPERIENCE.md) Tier 2—technical founders and agencies who want **minimal code**, not Pipecat internals.

**Contract:** `{BACKEND}` = your public API base (e.g. `https://api.example.com`). Always confirm paths in **`{BACKEND}/api/v1/openapi.json`**.

| Recipe | File | What it covers |
|--------|------|----------------|
| Voice widget on your site | [embed-widget.md](embed-widget.md) | Env vars (`BACKEND_API_ENDPOINT`, `NEXT_PUBLIC_BACKEND_URL`); `POST /api/v1/workflow/{id}/embed-token`; WebSocket `/api/v1/ws/...`; OpenAPI import |
| Inbound phone → workflow | [inbound-pstn.md](inbound-pstn.md) | Env + provider creds; `POST /api/v1/telephony/inbound/{workflow_id}`; telephony WebSocket path |
| Outbound batch / campaigns | [outbound-campaign.md](outbound-campaign.md) | Env; `POST /api/v1/campaign/create`, `/campaign/{id}/start`, etc.; compliance note for CSV/consent |

**Execution tracking:** epic **DX-01-BUILDER** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md).

**Tier 3:** [READMEADK.md](../READMEADK.md) for full REST, WebSockets, and MCP.
