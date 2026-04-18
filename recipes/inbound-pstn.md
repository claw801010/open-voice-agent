# Recipe — Inbound phone calls (PSTN) to a workflow

**Tier:** Builder (minimal code). **Concept:** your carrier sends call events to this API; audio streams over **WebSocket** to the voice pipeline.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `{BACKEND}` | Your deploy | Public API base for webhooks (e.g. `https://api.example.com`). |
| `BACKEND_API_ENDPOINT` | API / provider consoles | Must match the URL carriers call for webhooks ([READMEBUILDME.md](../READMEBUILDME.md)). |
| Provider secrets | Dashboard or env | Twilio/Vonage/Telnyx credentials ([api/routes/credentials.py](../api/routes/credentials.py)); exact names depend on provider. |

## API paths ([READMELEARNME.md](../READMELEARNME.md) §3)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/telephony/inbound/{workflow_id}` | Inbound webhook entry ([api/routes/telephony.py](../api/routes/telephony.py)). |
| WebSocket | `/api/v1/telephony/ws/{workflow_id}/{user_id}/{workflow_run_id}` | PSTN media stream ([READMELEARNME.md](../READMELEARNME.md) §3). |
| `POST` | `/api/v1/telephony/initiate-call` | Outbound initiation (related; see §4.2). |
| `GET` | `/api/v1/openapi.json` | Full route list. |

## Outcome

A phone number rings your **workflow**: caller audio is processed by the same graph you built in the UI.

## Prerequisites

- **Telephony provider** configured (Twilio, Vonage, Telnyx, etc.) with credentials stored via dashboard / [api/routes/credentials.py](../api/routes/credentials.py).
- Workflow id and **published** definition.
- Public **`BACKEND_API_ENDPOINT`** so the provider can POST webhooks and open media streams to your host ([READMEBUILDME.md](../READMEBUILDME.md)).

## Core URL (conceptual)

Inbound webhook (common pattern in this codebase):

`POST {BACKEND}/api/v1/telephony/inbound/{workflow_id}`

See [api/routes/telephony.py](../api/routes/telephony.py) — `handle_inbound_telephony` and provider-specific TwiML/NCCO builders. Your provider’s console must use the **exact** URL your deployment exposes (often behind HTTPS + nginx).

**Media WebSocket** (for streaming audio) follows paths under `/api/v1/telephony/ws/...` — see [READMELEARNME.md](../READMELEARNME.md) §4 and [READMEBUILDME.md](../READMEBUILDME.md) API index.

## Steps

1. Configure **provider credentials** in the product UI (recommended) or match env vars in [api/constants.py](../api/constants.py) / provider docs under `api/services/telephony/`.
2. Set **inbound webhook** in the carrier to `.../api/v1/telephony/inbound/{workflow_id}` (verify against OpenAPI and your provider’s doc).
3. Place a **test call**; watch API logs and workflow run records.
4. Tune **VAD / STT** in workflow settings if calls feel laggy ([READMEPLANNING.md](../READMEPLANNING.md) Pillar 2).

## When to use Tier 3 (ADK)

Custom routing, failover, or CI-driven number provisioning — automate with REST + [READMEADK.md](../READMEADK.md); use **MCP** only if your agent stack fits that model.
