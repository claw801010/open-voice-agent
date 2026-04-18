# Recipe — Website voice widget (embed)

**Tier:** Builder (minimal code). **API:** authenticated REST; script tag returned by the API.

## Outcome

Visitors click your **embedded widget** and talk to a published workflow over **WebRTC** (browser), without building your own frontend.

## Prerequisites

- Workflow **published** in the dashboard.
- You can call the API with a **user JWT** ([READMEADK.md](../READMEADK.md) — auth).
- **CORS / domains:** set `allowed_domains` on the embed token to match your site origin(s).

## Steps

1. **Create or refresh an embed token**  
   `POST /api/v1/workflow/{workflow_id}/embed-token`  
   Implementation: [api/routes/workflow_embed.py](../api/routes/workflow_embed.py).  
   Request body options include `allowed_domains`, `usage_limit`, `expires_in_days` — see OpenAPI: `{BACKEND}/api/v1/openapi.json`.

2. **Use the returned `embed_script`**  
   The handler builds a `<script>` tag that loads the widget with `token`, `environment`, and `apiEndpoint` (see `generate_embed_script` in [api/routes/workflow_embed.py](../api/routes/workflow_embed.py)).

3. **Set `BACKEND_API_ENDPOINT` / public API URL**  
   Browsers must reach your API and WebSocket endpoints; for remote HTTPS see [READMEBUILDME.md](../READMEBUILDME.md) and compose notes on `MINIO_PUBLIC_ENDPOINT` / reverse proxy.

4. **Test** on a staging domain listed in `allowed_domains` before production.

5. **Escalate to ADK** if you need to automate token rotation or multi-tenant embeds — use [READMEADK.md](../READMEADK.md) + generated client.

## See also

- [READMEEXPERIENCE.md](../READMEEXPERIENCE.md) — builder journey  
- [READMELEARNME.md](../READMELEARNME.md) §4 — WebRTC signaling  
