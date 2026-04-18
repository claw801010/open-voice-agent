# Recipe — Outbound campaign (batch calls)

**Tier:** Builder (minimal code) for **setup**; heavy usage may need **ADK** or ops automation.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `{BACKEND}` | Your deploy | API base for authenticated REST. |
| `BACKEND_API_ENDPOINT` | Public URL | Campaigns and telephony callbacks must reach your host ([READMEBUILDME.md](../READMEBUILDME.md)). |
| Provider / org settings | Dashboard | Outbound caller IDs and telephony credentials per org. |

CSV uploads and compliance (consent lists) are **your** process—the API stores campaign definitions and schedules.

## API paths ([READMELEARNME.md](../READMELEARNME.md) §3)

Router: [api/routes/campaign.py](../api/routes/campaign.py) — prefix **`/api/v1/campaign`**.

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/campaign/create` | Create campaign |
| `GET` | `/api/v1/campaign/` | List campaigns |
| `GET` | `/api/v1/campaign/{campaign_id}` | Campaign detail |
| `POST` | `/api/v1/campaign/{campaign_id}/start` | Start |
| `POST` | `/api/v1/campaign/{campaign_id}/pause` | Pause |
| `POST` | `/api/v1/campaign/{campaign_id}/resume` | Resume |
| `POST` | `/api/v1/campaign/{campaign_id}/redial` | Redial |
| `GET` | `/api/v1/campaign/{campaign_id}/runs` | Runs |
| `GET` | `/api/v1/campaign/{campaign_id}/progress` | Progress |
| `GET` | `/api/v1/campaign/{campaign_id}/report` | Report |
| `GET` | `/api/v1/openapi.json` | Authoritative list (may include more fields). |

Related: `POST /api/v1/telephony/initiate-call` for single outbound calls ([READMELEARNME.md](../READMELEARNME.md) §4.2).

## Outcome

Upload or connect a list of numbers; the platform schedules **outbound** runs tied to a workflow ([READMELEARNME.md](../READMELEARNME.md) §4 campaign path).

## Prerequisites

- Campaign feature enabled for your org; workflow and telephony **from** numbers configured.
- Understand **rate limits** and compliance (TCPA / consent) for your region — **legal review** is on you.

## Steps (high level)

1. **Create campaign** in UI or via API with `workflow_id`, audience, schedule.
2. Attach **telephony provider** and caller IDs per [READMEBUILDME.md](../READMEBUILDME.md).
3. **Dry run** with a single number before full send.
4. Monitor **workflow runs** and costs (`usage_info` / `cost_info` in [READMELEARNME.md](../READMELEARNME.md) §6).

## Escalate to ADK

Bulk automation, retries, and custom CRM joins: script against OpenAPI + org API keys per [READMEADK.md](../READMEADK.md).

**Optional:** Import `{BACKEND}/api/v1/openapi.json` into Postman or your HTTP client.
