# Recipes — minimal-code integrations (builder tier)

**Purpose:** short, copy-paste-friendly **recipes** for [READMEEXPERIENCE.md](../READMEEXPERIENCE.md) Tier 2—technical founders and agencies who want **minimal code**, not Pipecat internals.

**Contract:** `{BACKEND}` = your public API base (e.g. `https://api.example.com`). Always confirm paths in **`{BACKEND}/api/v1/openapi.json`**.

| Recipe | File | What it covers |
|--------|------|----------------|
| Voice widget on your site | [embed-widget.md](embed-widget.md) | `POST .../workflow/{id}/embed-token`, script tag |
| Inbound phone → workflow | [inbound-pstn.md](inbound-pstn.md) | `POST .../telephony/inbound/{workflow_id}`, webhooks |
| Outbound batch / campaigns | [outbound-campaign.md](outbound-campaign.md) | Campaign API + ops notes |

**Execution tracking:** epic **DX-01-BUILDER** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md).

**Tier 3:** [READMEADK.md](../READMEADK.md) for full REST, WebSockets, and MCP.
