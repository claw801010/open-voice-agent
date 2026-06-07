# Documentation map (fork / FulliO)

Use this page to **navigate** the repo-authored docs. Upstream product docs (deployment, features) remain at [https://docs.dograh.com](https://docs.dograh.com).

## Start here (by role)

| I am… | Read first | Then |
|--------|------------|------|
| **New to the platform** | [README.md](README.md) → [READMEEXPERIENCE.md](READMEEXPERIENCE.md) | [READMEBUILDME.md](READMEBUILDME.md) to run it |
| **Choosing no-code vs builder vs dev** | [READMEEXPERIENCE.md](READMEEXPERIENCE.md) | [READMEPLANNING.md](READMEPLANNING.md) §8 |
| **Operating / self-hosting** | [READMEBUILDME.md](READMEBUILDME.md) | [READMELEARNME.md](READMELEARNME.md) |
| **API, MCP, IDE, agents** | [READMEADK.md](READMEADK.md) | [READMELEARNME.md](READMELEARNME.md) §3–10 |
| **Minimal-code integrations** | [recipes/README.md](recipes/README.md) | Per-recipe files in [recipes/](recipes/) |
| **Marketplace vertical packs (catalog + runbooks)** | [catalog/README.md](catalog/README.md) | [READMEMARKETPLACEPLANNING.md](READMEMARKETPLACEPLANNING.md), [runbooks/README.md](runbooks/README.md), [catalog/PREBUILD_VERTICAL_ROADMAP.md](catalog/PREBUILD_VERTICAL_ROADMAP.md), [catalog/ANALYTICS_VERTICAL_ROADMAP.md](catalog/ANALYTICS_VERTICAL_ROADMAP.md) |
| **Buyer demo + GTM deck (10 verticals, local all-in-one)** | [catalog/recipes/catalog-buyer-demo.md](catalog/recipes/catalog-buyer-demo.md) | `./scripts/verify_mk01_buyer_shipped.sh`, [buyer-demo-gtm-day.md](catalog/recipes/buyer-demo-gtm-day.md), `./scripts/prepare_mk01_pr.sh` (`--split-hints`, `--stage N`), [prebuild-vertical-demo-matrix.md](catalog/recipes/prebuild-vertical-demo-matrix.md), [docs/images/](docs/images/) (`gtm-mk01-*`, 41 frames) |
| **Strategy & roadmap** | [READMEPLANNING.md](READMEPLANNING.md) | [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) |
| **Shipping & changelog** | [READMENEWRELEASES.md](READMENEWRELEASES.md) | Execution IDs in READMEPLANTOEXECUTE |

## All root guides (one line each)

| File | Purpose |
|------|---------|
| [README.md](README.md) | Project pitch, quick start, links |
| [DOCS.md](DOCS.md) | This map |
| [READMEEXPERIENCE.md](READMEEXPERIENCE.md) | Three tiers: no-code, builder, ADK journeys |
| [READMEADK.md](READMEADK.md) | OpenAPI, MCP, auth, IDE agents |
| [READMELEARNME.md](READMELEARNME.md) | Architecture, lifecycles, domain model |
| [READMEBUILDME.md](READMEBUILDME.md) | Env, Docker, fork sync, extension boundaries |
| [READMEPLANNING.md](READMEPLANNING.md) | Strategy, pillars, marketplace §6, experience §8 |
| [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) | Epics MK-01, WE-01, DX-01 — actionable backlog |
| [READMEMARKETPLACEPLANNING.md](READMEMARKETPLACEPLANNING.md) | Marketplace: curated packs + import/skills research |
| [READMENEWRELEASES.md](READMENEWRELEASES.md) | What shipped (tie to execution IDs) |
| [catalog/README.md](catalog/README.md) | Vertical pack JSON (`MK-01-CATALOG`) |
| [catalog/ANALYTICS_VERTICAL_ROADMAP.md](catalog/ANALYTICS_VERTICAL_ROADMAP.md) | Calls, dashboards, tool/API observability for vertical GTM (`MK-01-ANALYTICS-VERTICAL`) |
| [catalog/ANALYTICS_REDACTION_MATRIX.md](catalog/ANALYTICS_REDACTION_MATRIX.md) | Analytics redaction surfaces × v1 behavior × RBAC — reviewer doc (`MK-01-ANALYTICS-VERTICAL`) |
| [catalog/analytics-calls-api-draft.yaml](catalog/analytics-calls-api-draft.yaml) | **Draft** OpenAPI for analytics calls list/detail + HTTP tool span summaries (`MK-01-ANALYTICS-VERTICAL`); live API: [api/routes/analytics.py](api/routes/analytics.py); UI: [`/analytics/calls`](ui/src/app/analytics/calls/page.tsx) |
| [docs/voice-agent/tools/http-api.mdx](docs/voice-agent/tools/http-api.mdx) | HTTP tool user doc (templated URL, headers, **Template resolution order**, **Storage model**, **Screenshots** / **WE-01-DATASTORE-INTEG**) — publish at [docs.dograh.com](https://docs.dograh.com) with site sync |
| [docs/images/](docs/images/) | **http-api-*.png** doc figures (1280×720 placeholders via [scripts/gen_http_api_doc_pngs.py](scripts/gen_http_api_doc_pngs.py); replace with product shots for GTM); [docs/images/README.md](docs/images/README.md) |
| [docs/integrations/http-tool-data-policy.mdx](docs/integrations/http-tool-data-policy.mdx) | HTTP tools — org data, browser-only test samples, roadmap cache (**WE-01-DATASTORE-INTEG**); linked from [integrations/overview.mdx](docs/integrations/overview.mdx) |
| [docs/integrations/http-tool-org-datastore-design.mdx](docs/integrations/http-tool-org-datastore-design.mdx) | **Design** — org policy fields, persistence boundaries, rollout gates for optional HTTP integration cache |
| [runbooks/README.md](runbooks/README.md) | Per-vertical operational runbooks |

## Epics (execution IDs)

| ID | Theme |
|----|--------|
| **MK-01** | Marketplace / vertical packs |
| **WE-01** | Workflow editor UX parity |
| **DX-01** | Beautified three-tier experience |

Details: [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md).
