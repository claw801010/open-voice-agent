# Recipe — Outbound campaign (batch calls)

**Tier:** Builder (minimal code) for **setup**; heavy usage may need **ADK** or ops automation.

## Outcome

Upload or connect a list of numbers; the platform schedules **outbound** runs tied to a workflow ([READMELEARNME.md](../READMELEARNME.md) §4 campaign path).

## Prerequisites

- Campaign feature enabled for your org; workflow and telephony **from** numbers configured.
- Understand **rate limits** and compliance (TCPA / consent) for your region — **legal review** is on you.

## API entry points

- Campaign routes: `/api/v1/campaign/...` — see [api/routes/campaign.py](../api/routes/campaign.py) and `{BACKEND}/api/v1/openapi.json`.

## Steps (high level)

1. **Create campaign** in UI or via API with `workflow_id`, audience, schedule.
2. Attach **telephony provider** and caller IDs per [READMEBUILDME.md](../READMEBUILDME.md).
3. **Dry run** with a single number before full send.
4. Monitor **workflow runs** and costs (`usage_info` / `cost_info` in [READMELEARNME.md](../READMELEARNME.md) §6).

## Escalate to ADK

Bulk automation, retries, and custom CRM joins: script against OpenAPI + org API keys per [READMEADK.md](../READMEADK.md).
