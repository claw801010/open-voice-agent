# READMEBUILDME — Operate, extend, and stay merge-friendly

This document is for teams who fork this voice AI platform (upstream: **Dograh** in this tree) and want to **run it with minimal configuration**, **extend the agent and UI safely**, **import upstream updates** with less pain, and plan **FulliO** branding, **compliance-grade multi-tenancy**, **rich call reporting**, and a **template marketplace**.

**Why teams pick a fork like FulliO as the Go-To:** buyers want **ready-to-bake** outcomes—industry playbooks, cloneable workflows, Web and PSTN in one stack, and **transparent** extension points—not a black box. This repo is a strong base for that story because it is **open**, **Docker-first**, and documented end-to-end in [READMELEARNME.md](READMELEARNME.md). Turn strategy into shipped vertical packs via [READMEPLANNING.md](READMEPLANNING.md) (§6 marketplace catalog) and [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) (epic **MK-01**); log releases in [READMENEWRELEASES.md](READMENEWRELEASES.md).

Official product docs: [https://docs.dograh.com](https://docs.dograh.com).

Strategy, execution tracking, and release notes: [READMEPLANNING.md](READMEPLANNING.md), [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md), [READMENEWRELEASES.md](READMENEWRELEASES.md). **Documentation map:** [DOCS.md](DOCS.md). **Pick your tier (no-code / builder / ADK):** [READMEEXPERIENCE.md](READMEEXPERIENCE.md). **Agentic dev kit (OpenAPI, MCP, IDE):** [READMEADK.md](READMEADK.md).

Sections labeled **Current codebase** describe what exists in this repository. Sections labeled **Roadmap** are design guidance, not implemented features.

---

## Table of contents

0. [Ready-to-bake verticals (roadmap)](#0-ready-to-bake-verticals-roadmap--quick-map)
1. [What you are running](#1-what-you-are-running-current-codebase)
2. [Fastest path: Docker and API keys](#2-fastest-path-docker-and-api-keys-current-codebase)
3. [Environment and secrets checklist](#3-environment-and-secrets-checklist-current-codebase)
4. [Local development (split stack)](#4-local-development-split-stack-current-codebase)
5. [Safe customization boundaries](#5-safe-customization-boundaries-current-codebase)
6. [Fork and upstream sync playbook](#6-fork-and-upstream-sync-playbook)
7. [Extension map: agent, UI, call reporting](#7-extension-map-agent-ui-call-reporting)
8. [FulliO quick re-brand checklist](#8-fullio-quick-re-brand-checklist-roadmap)
9. [Compliance-grade multi-tenancy](#9-compliance-grade-multi-tenancy-current-vs-roadmap)
10. [Template marketplace](#10-template-marketplace-roadmap)

---

## 0. Ready-to-bake verticals (roadmap) — quick map

**Goal:** help GTM and engineering align on **which businesses** you win first. Full vertical × use-case catalog and differentiation narrative live in [READMEPLANNING.md](READMEPLANNING.md) §6. Execution packages (template QA, marketplace UI, partner onboarding) live under epic **MK-01** in [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md).

| Vertical | Example voice wins | Your first “bake” deliverable |
|----------|---------------------|------------------------------|
| Healthcare / clinics | Intake, reminders, screening | Template + runbook + HIPAA-oriented defaults (roadmap pack) |
| Insurance | FNOL, quote qual, policy FAQ | Template + CRM tool stubs |
| Retail / e-commerce | WISMO, returns, hours | Template + KB wiring pattern |
| B2B SaaS | PQL qual, trial check-in | Template + HTTP tool patterns |
| SMB / franchises | Multi-site router, lead callback | Template + `template_context_variables` |

**Current codebase:** workflows and definitions are versioned ([api/db/models.py](api/db/models.py)); embed and WebRTC paths exist ([READMELEARNME.md](READMELEARNME.md)). **Gap:** curated marketplace UX, payments, and certified partner packs—treat as product build on top of this OSS core.

---

## 1. What you are running (current codebase)

Monorepo layout (see also [AGENTS.md](AGENTS.md)):

| Path | Role |
|------|------|
| [api/](api/) | FastAPI backend, `/api/v1` REST + WebSockets + mounted MCP |
| [ui/](ui/) | Next.js 15 app (dashboard, workflow builder, WebRTC client) |
| [pipecat/](pipecat/) | **Git submodule** — Pipecat fork used for real-time voice pipelines |
| [scripts/](scripts/) | Dev infra, migrations, Pipecat setup, lint |
| [docs/](docs/) | Mintlify documentation (published separately) |
| [docker-compose.yaml](docker-compose.yaml) | Full stack (API, UI, Postgres, Redis, MinIO, optional tunnel/TURN) |
| [docker-compose-local.yaml](docker-compose-local.yaml) | Infra only for local API/UI processes |

Runtime stack: **PostgreSQL** (pgvector), **Redis** (ARQ jobs + pub/sub), **MinIO or S3** (recordings/audio), **Pipecat** inside the API process for STT/LLM/TTS and tool calls.

---

## 2. Fastest path: Docker and API keys (current codebase)

Upstream quick start (pulls published images):

```bash
curl -o docker-compose.yaml https://raw.githubusercontent.com/dograh-hq/dograh/main/docker-compose.yaml && REGISTRY=ghcr.io/dograh-hq ENABLE_TELEMETRY=true docker compose up --pull always
```

From a **git clone** of this repo, use the compose file in the root and set `REGISTRY` if you use GHCR images (see [docker-compose.yaml](docker-compose.yaml): default image prefix `dograhai/dograh-api` and `dograhai/dograh-ui`).

- **UI**: typically [http://localhost:3010](http://localhost:3010)
- **API health**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

**Dograh-managed keys vs BYOK (product behavior):** the upstream README describes auto-generated keys so you can try the product immediately; you can later attach your own LLM, STT, TTS, and telephony credentials in the dashboard. Self-hosted deployments still need **infrastructure** secrets (database, Redis, JWT) as below.

---

## 3. Environment and secrets checklist (current codebase)

Canonical Python-side variables are read in [api/constants.py](api/constants.py). Docker injects a subset in [docker-compose.yaml](docker-compose.yaml).

### Required for API boot

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Async SQLAlchemy URL (e.g. `postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis including password if used |

### URLs and deployment

| Variable | Default / notes |
|----------|-----------------|
| `BACKEND_API_ENDPOINT` | Public HTTP(S) base URL of the API (webhooks, provider callbacks) |
| `UI_APP_URL` | Dashboard URL (emails, links) |
| `ENVIRONMENT` | Logical environment name |
| `DEPLOYMENT_MODE` | Default `oss` — affects service-key resolution ([api/routes/service_keys.py](api/routes/service_keys.py)) |
| `AUTH_PROVIDER` | Default `local` — OSS email/password vs other providers |

### Storage

| Variable | Notes |
|----------|--------|
| `ENABLE_AWS_S3` | `true` for S3; `false` uses MinIO settings |
| `MINIO_*` | Endpoint, public URL, keys, bucket, TLS flag |
| `S3_BUCKET`, `S3_REGION` | When using AWS |

### Auth (OSS)

| Variable | Notes |
|----------|--------|
| `OSS_JWT_SECRET` | **Must be changed in production** |
| `OSS_JWT_EXPIRY_HOURS` | JWT lifetime |

### Optional observability

| Variable | Notes |
|----------|--------|
| `ENABLE_TRACING`, `LANGFUSE_*` | LLM trace export ([api/services/pipecat/tracing_config.py](api/services/pipecat/tracing_config.py)) |
| `SENTRY_DSN` | Backend Sentry ([api/app.py](api/app.py)) |
| `ENABLE_TELEMETRY` | Gates some telemetry behavior |
| `POSTHOG_API_KEY`, `POSTHOG_HOST` | Product analytics (API/constants; UI may use PostHog separately) |

### Telephony / WebRTC

| Variable | Notes |
|----------|--------|
| `TURN_SECRET`, `TURN_HOST`, `TURN_PORT`, `TURN_TLS_PORT`, `TURN_CREDENTIAL_TTL` | Time-limited TURN credentials ([api/routes/turn_credentials.py](api/routes/turn_credentials.py)) |
| `TURN_USERNAME`, `TURN_PASSWORD` | Optional static ICE fallback in WebRTC signaling ([api/routes/webrtc_signaling.py](api/routes/webrtc_signaling.py)) |
| `ENABLE_ARI_STASIS` | Asterisk ARI integration |

### Dograh managed platform services (optional)

| Variable | Notes |
|----------|--------|
| `DOGRAH_MPS_SECRET_KEY`, `MPS_API_URL` | Managed keys / platform API |

### Other services (used only if those features are enabled)

| Variable | Where |
|----------|--------|
| `NANGO_API_KEY` | [api/services/integrations/nango.py](api/services/integrations/nango.py) |
| `GENDERAPI_API_KEY` / `GENDER_API_KEY` | Gender detection service |
| `SMART_TURN_HTTP_SERVICE_KEY`, `LOCAL_SMART_TURN_MODEL_PATH`, `SMART_TURN_MAX_PAYLOAD` | Smart turn service |
| `ENABLE_TURN_LOGGING` | [api/services/pipecat/pipeline_builder.py](api/services/pipecat/pipeline_builder.py) |
| `ASGI_WORKER_ID` | [api/utils/worker.py](api/utils/worker.py) |

### UI (Next.js)

Common variables (grep `process.env` under [ui/](ui/)):

- `BACKEND_URL` — server-side API base (Docker: `http://api:8000`)
- `NEXT_PUBLIC_BACKEND_URL` — browser-side API base when not same-origin
- `ENABLE_TELEMETRY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_UI_HOST`
- `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_NODE_ENV`
- `NEXT_PUBLIC_STACK_PROJECT_ID` and related Stack Auth settings when not in pure OSS JWT mode
- Optional: `NEXT_PUBLIC_CHATWOOT_*`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_AXIOM_*`, `NEXT_PUBLIC_LANGFUSE_*`

Compose reference for UI: [docker-compose.yaml](docker-compose.yaml) (`BACKEND_URL`, `ENABLE_TELEMETRY`, PostHog).

### Docker compose-only

- `REGISTRY` — image repository prefix for `api` and `ui` services
- `FASTAPI_WORKERS` — worker count (affects need for [WorkerSyncManager](#5-safe-customization-boundaries-current-codebase))

---

## 4. Local development (split stack) (current codebase)

1. **Infra**: [docker-compose-local.yaml](docker-compose-local.yaml) via [scripts/start_services_dev.sh](scripts/start_services_dev.sh) (or `.ps1` on Windows). See [AGENTS.md](AGENTS.md).
2. **Migrations**: [scripts/migrate.sh](scripts/migrate.sh); new revisions: [scripts/makemigrate.sh](scripts/makemigrate.sh).
3. **Pipecat submodule**: [scripts/setup_pipecat.sh](scripts/setup_pipecat.sh) — `git submodule update --init` and `pip install -e ./pipecat[...]` plus `api/requirements.txt`.
4. **API**: from repo root, `uvicorn api.app:app --reload --port 8000` (see [api/AGENTS.md](api/AGENTS.md)).
5. **UI**: `cd ui && npm install && npm run dev` — default dev server port per [ui/AGENTS.md](ui/AGENTS.md).
6. **OpenAPI client**: after adding backend routes, run `npm run generate-client` in [ui/](ui/) ([ui/package.json](ui/package.json)).

---

## 5. Safe customization boundaries (current codebase)

### Prefer extending here

- **New REST modules**: `api/routes/<feature>.py`, register in [api/routes/main.py](api/routes/main.py).
- **Business logic**: `api/services/<domain>/` (telephony, workflow, campaign, pipecat, …).
- **Schemas**: `api/schemas/`.
- **Persistence**: `api/db/models.py` + Alembic under `api/alembic/` + dedicated `*_client.py` repositories where the codebase already uses them.
- **UI**: `ui/src/app/`, `ui/src/components/` (feature folders + [ui/src/components/ui/](ui/src/components/ui/) for shadcn primitives).
- **Workflow builder**: [ui/src/components/flow/](ui/src/components/flow/).

### Treat as high-churn or generated

- **[pipecat/](pipecat/)** submodule — upstream Dograh may bump commits frequently; test voice pipelines after every update.
- **`ui/src/client/`** — regenerated OpenAPI client; **never hand-edit**; run `npm run generate-client`.
- **Upstream Alembic migrations** — merge carefully; keep your own migrations timestamped and minimal.

### Multi-worker rule (critical)

From [api/AGENTS.md](api/AGENTS.md): with `FASTAPI_WORKERS` > 1, **do not** rely on updating in-memory state from a single request handler for global config. Use **[api/services/worker_sync/](api/services/worker_sync/)** (`WorkerSyncManager`) and Redis pub/sub so all workers refresh (same pattern as Langfuse credential sync in [api/app.py](api/app.py)).

---

## 6. Fork and upstream sync playbook

### Branch strategy

- Keep a long-lived branch (e.g. `fullio/main`) that tracks your product, and merge or rebase `upstream/main` on a schedule.
- **Prefer `git merge upstream/main`** for long-lived forks: fewer forced conflict resolutions than rebase across many local commits.
- Tag releases after successful QA (voice WebRTC + one PSTN provider + migrations).

### Submodule discipline

- [.gitmodules](.gitmodules) points `pipecat` to `https://github.com/dograh-hq/pipecat.git`.
- Pin the submodule to a **known-good commit** in your fork; record it in release notes.
- Upgrade path: `cd pipecat && git fetch && git checkout <commit> && cd .. && git add pipecat` — then run voice regression tests.

### Reduce merge conflicts

- Isolate fork-specific branding, compliance wrappers, and marketplace code under a **single namespace** (e.g. `api/services/fullio_*`, `ui/src/components/fullio/`) so upstream changes to core Dograh files do not overlap your diffs as often.
- Avoid editing **upstream-only** concerns (default compose telemetry keys, public Dograh URLs) in the same commits as feature work; use `.env` / `.env.local` and deployment overlays.

### CI and images

- [.github/workflows/](.github/workflows/) builds and publishes images; forkers often change `REGISTRY`, secrets, or disable workflows they do not need.

### Feature work vs upstream merges

Feature IDs and status live in **[READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md)** (operating model: **source of truth**, WIP limits, mapping to Linear/Jira/GitHub). **Do not** land huge upstream merges in the same PR as large **MK-01** / **WE-01** changes unless necessary—merge **upstream** on its own branch first, then rebase or merge your feature branch.

---

## 7. Extension map: agent, UI, call reporting

### Agent and tools (current codebase)

- Graph execution and LLM function routing: [api/services/workflow/pipecat_engine.py](api/services/workflow/pipecat_engine.py).
- Custom HTTP tools and handlers: [api/services/workflow/pipecat_engine_custom_tools.py](api/services/workflow/pipecat_engine_custom_tools.py), [api/services/workflow/tools/custom_tool.py](api/services/workflow/tools/custom_tool.py).
- Pipeline assembly and transports (Twilio, WebRTC, Vonage, ARI, …): [api/services/pipecat/run_pipeline.py](api/services/pipecat/run_pipeline.py).

### Per-call data you can build on (current codebase)

`WorkflowRunModel` in [api/db/models.py](api/db/models.py) includes:

- `usage_info`, `cost_info` — metering and pricing-related aggregates
- `initial_context`, `gathered_context` — call inputs and extracted state
- `logs` — JSON logs bucket (structure evolves with features)
- `recording_url`, `transcript_url`, `storage_backend`
- `mode`, `call_type`, `state`, `is_completed`

**Roadmap — “single call report” UI:** today, detailed tool traces may appear in application logs and optionally **Langfuse** when `ENABLE_TRACING` is on. A first-class “show every HTTP tool request/response for this run” experience may require:

1. A **stable JSON schema** for tool events appended to `workflow_runs.logs` or a new table keyed by `workflow_run_id`.
2. **API** endpoints that return redacted payloads for the UI.
3. **UI** components in the run detail page.

Design redaction and retention **before** storing third-party API responses (PCI/GDPR).

---

## 8. FulliO quick re-brand checklist (roadmap)

Search-and-replace alone is insufficient; verify runtime behavior.

| Area | Examples in this repo |
|------|------------------------|
| Product strings | [README.md](README.md), [docs/](docs/), UI copy under [ui/src/](ui/src/) |
| API title / OpenAPI | [api/app.py](api/app.py) (`title`, `description`, `servers`) |
| Package metadata | [api/pyproject.toml](api/pyproject.toml), [ui/package.json](ui/package.json) |
| Docker images | `REGISTRY`, image names in [docker-compose.yaml](docker-compose.yaml) |
| Telemetry | PostHog keys in compose and `NEXT_PUBLIC_*` defaults — replace with your own or disable |
| Domains | `BACKEND_API_ENDPOINT`, `UI_APP_URL`, `MINIO_PUBLIC_ENDPOINT`, webhook URLs |

---

## 9. Compliance-grade multi-tenancy (current vs roadmap)

**Current codebase:** Organizations, org-scoped API keys, org configurations, and workflows carry `organization_id`. Users link to orgs via `organization_users`. This is **application-level multi-tenancy**, not automatic regulatory compliance.

**Roadmap (HIPAA / PCI / GDPR-style goals):** treat as a **gap analysis** and legal review, not this repo’s defaults.

- **Isolation:** row-level security or separate databases per tenant; hard guarantees on every query path.
- **Secrets:** per-tenant KMS, no shared keys across tenants in logs.
- **Tool egress:** allow-lists for HTTP tool URLs, PII scanning, signed egress proxies.
- **Logging and tracing:** no PHI in Langfuse/Sentry/PostHog; configurable redaction.
- **Retention and deletion:** documented erasure for recordings, transcripts, and `gathered_context`.
- **BAA / DPA:** only with your actual cloud vendors and processes.

---

## 10. Template marketplace (roadmap)

**Current codebase:** Workflows store graph and config in `WorkflowModel` and versioned `WorkflowDefinitionModel` (`workflow_json`, `workflow_configurations`, `template_context_variables`). There is a `WorkflowTemplates` table in [api/db/models.py](api/db/models.py) for template-like rows — product surfacing may evolve.

**Marketplace MVP (what “good” looks like for buyers):**

- **Discover:** browse by **industry**, **use case**, **language**, **channel** (WebRTC vs PSTN), and **compliance tag** (e.g. “PCI-safe patterns”).
- **Try:** one-click **Web call** or **simulated persona** from the template detail page (reuse LoopTalk direction — [api/routes/looptalk.py](api/routes/looptalk.py)).
- **Buy / install:** clone into org, inject org credentials only, leave graph read-only until customer explicitly forks.
- **Prove value:** show **expected cost band** and **sample latency** from sandbox runs (honest ranges—align with [READMEPLANNING.md](READMEPLANNING.md) Pillar 2).

**Roadmap (technical + GTM):**

- **Packaging format:** versioned bundle (workflow JSON + tool definitions + credential placeholders + KB references + **runbook.md**).
- **Import adapters:** map exports from other vendors (e.g. Claude projects, prompt packs) into your workflow JSON and tool schema.
- **Curated verticals:** use the **§6 catalog** in [READMEPLANNING.md](READMEPLANNING.md); ship **read-only** templates first, then partner-certified packs.
- **Partner economics:** revenue share, review pipeline, and “FulliO Certified” badging (policy in READMEPLANNING §6).
- **Distribution:** embed widget ([api/routes/workflow_embed.py](api/routes/workflow_embed.py)) + optional public directory (growth bet #1 in READMEPLANNING).

**Traceability:** track template and marketplace engineering under **MK-01** in [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md); ship lines in [READMENEWRELEASES.md](READMENEWRELEASES.md).

---

## API router index (current codebase)

All below are under **`/api/v1`** unless noted. Routers are wired in [api/routes/main.py](api/routes/main.py).

| Prefix / mount | Module |
|----------------|--------|
| `/health` | [api/routes/main.py](api/routes/main.py) |
| `/telephony` | [api/routes/telephony.py](api/routes/telephony.py) — includes WebSocket `ws/{workflow_id}/{user_id}/{workflow_run_id}` for streaming audio |
| `/superuser` | [api/routes/superuser.py](api/routes/superuser.py) |
| `/workflow` | [api/routes/workflow.py](api/routes/workflow.py) and [api/routes/workflow_embed.py](api/routes/workflow_embed.py) — same prefix; paths merged (embed routes such as `POST /workflow/{workflow_id}/embed-token`) |
| `/user` | [api/routes/user.py](api/routes/user.py) |
| `/campaign` | [api/routes/campaign.py](api/routes/campaign.py) |
| `/credentials` | [api/routes/credentials.py](api/routes/credentials.py) |
| `/tools` | [api/routes/tool.py](api/routes/tool.py) |
| `/integration` | [api/routes/integration.py](api/routes/integration.py) |
| `/organizations` | [api/routes/organization.py](api/routes/organization.py) and [api/routes/organization_usage.py](api/routes/organization_usage.py) — **both** use prefix `/organizations`; FastAPI merges their paths (order: organization router first, then usage router in [api/routes/main.py](api/routes/main.py)) |
| `/organizations/reports` | [api/routes/reports.py](api/routes/reports.py) |
| `/s3` | [api/routes/s3_signed_url.py](api/routes/s3_signed_url.py) |
| `/user/service-keys` (no extra prefix) | [api/routes/service_keys.py](api/routes/service_keys.py) |
| `/looptalk` | [api/routes/looptalk.py](api/routes/looptalk.py) |
| `/ws` | [api/routes/webrtc_signaling.py](api/routes/webrtc_signaling.py) — WebRTC signaling |
| `/turn` | [api/routes/turn_credentials.py](api/routes/turn_credentials.py) |
| `/public/embed` | [api/routes/public_embed.py](api/routes/public_embed.py) |
| `/public/agent` | [api/routes/public_agent.py](api/routes/public_agent.py) |
| `/public/download` | [api/routes/public_download.py](api/routes/public_download.py) |
| `/knowledge-base` | [api/routes/knowledge_base.py](api/routes/knowledge_base.py) |
| `/workflow-recordings` | [api/routes/workflow_recording.py](api/routes/workflow_recording.py) |
| `/auth` | [api/routes/auth.py](api/routes/auth.py) |
| `/api/v1/mcp` | Streamable HTTP MCP mount ([api/app.py](api/app.py)) |

For deep architecture and “rebuild from scratch” mental model, see [READMELEARNME.md](READMELEARNME.md).
