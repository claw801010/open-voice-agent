# GTM demo: HTTP tool evidence → Analytics → PII redaction (WE-01 + MK-01)

**Audience:** sales engineering, solutions, or a buyer technical deep-dive.  
**Time:** ~15 minutes live (or 5 minutes API-only with [gtm-http-api-analytics-redaction-demo.sh](../../scripts/gtm-http-api-analytics-redaction-demo.sh)).

## Story arc

1. **Author** — Show the HTTP tool with **`response_mapping`** so booking-style outcomes land in **`mapped_data`** (see [http-api.mdx](../../docs/voice-agent/tools/http-api.mdx)).
2. **Prove** — Run a call (Web or LoopTalk persona) so a workflow run exists with tool spans.
3. **Analytics** — Open **Analytics → Calls**, filter by **`catalog_slug`** / tool name if useful; open **call detail** and point at **HTTP tool span** rows (`mapped_data`, status).
4. **Governance** — Open **Analytics → Overview**, **PII redaction (organization)** toggle: explain **On** = masked detail + server CSV; **Off** only for trusted QM and **RBAC** (API keys cannot disable; Stack/local rules in [redaction_policy_rbac.py](../../api/services/analytics/redaction_policy_rbac.py)).

## Shareable Overview URL

Opening **`/analytics?catalog_slug=<known-vertical-slug>`** (e.g. `healthcare-clinic-screening` from [vertical-packs.json](../vertical-packs.json)) applies the **vertical widget preset** automatically **when the dashboard is still the generic default order** — customized org layouts are not overwritten. Same filters apply to insights and call-list links from the page.

## Prerequisites

- Running backend + UI (local or staging).
- Signed-in **operator** account (not an API key).
- At least one vertical pack installed **or** any workflow with an HTTP tool using **`response_mapping`** aligned with [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## UI checklist (screenshots optional)

| Step | Where | Talking point |
|------|--------|----------------|
| A | **Tools → HTTP API** ([HttpApiToolConfig.tsx](../../ui/src/app/tools/%5BtoolUuid%5D/components/HttpApiToolConfig.tsx)) | Simple vs Advanced; **Test API Call**; **Response mapping** / Auto-map; variable bullets (system / conversation / template / analytics). |
| B | **Workflow editor** | Tool wired into the graph; optional **Try** from catalog for a canned graph. |
| C | **Analytics → Calls** | Filters: dates, **`catalog_slug`**, **`catalog_variant_id`**, **`tool_name`** for HTTP proof. |
| D | **Call detail** | Tool spans; **`mapped_data`** vs raw upstream (when redaction allows fewer masks). |
| E | **Analytics → Overview** | Org **PII redaction** switch + confirm dialog when turning **Off**. With **Vertical slug** set to a shipped pack, **Revenue & booking** shows example **`tool_name`** values and suggested **`response_mapping`** keys ([analyticsVerticalHttpHints.ts](../../ui/src/lib/analyticsVerticalHttpHints.ts)). **Top outcomes** / **Top tools** rows link to **Calls** with the same filters + date window ([analyticsOverviewDeepLinks.ts](../../ui/src/lib/analyticsOverviewDeepLinks.ts)). |
| F | **Analytics → Calls** — **Scheduled QM export** ([AnalyticsCallsListContent.tsx](../../ui/src/app/analytics/calls/AnalyticsCallsListContent.tsx)) | Org schedule for server CSV → object storage (ARQ + `ENABLE_ANALYTICS_QM_EXPORT_CRON`); **`cron_enabled`** in API explains whether hourly uploads run in this environment. |
| G | **Settings → Platform** (optional **WE-01** tie-in) | **HTTP integration cache policy** draft: org default + **per-integration** rows ([HttpIntegrationCachePolicySection.tsx](../../ui/src/components/HttpIntegrationCachePolicySection.tsx)); runtime cache still **not_implemented** — set expectations for buyers (governance before speed). |

### Screenshot pack (deck / leave-behind)

Use **1280×720** (16:9) PNGs unless your template dictates otherwise — matches [docs/images/README.md](../../docs/images/README.md) and [gen_http_api_doc_pngs.py](../../scripts/gen_http_api_doc_pngs.py) placeholders for HTTP tool docs.

Suggested filenames under **`docs/images/`** (add files when ready; safe to commit empty placeholders only if your fork policy allows):

| File | Captures |
|------|-----------|
| `gtm-mk01-analytics-overview.png` | Step **E** — Overview with **Vertical slug**, KPI row, **PII redaction** switch visible. |
| `gtm-mk01-analytics-calls.png` | Step **C** — Call list filters + **Export CSV (server)**. |
| `gtm-mk01-analytics-call-detail.png` | Step **D** — Detail with ≥1 HTTP span / **`mapped_data`**. |
| `gtm-mk01-analytics-qm-schedule.png` | Step **F** — **Scheduled QM export** card (UTC hour + `cron_enabled` copy). |
| `gtm-mk01-analytics-scorecard-rubric.png` | Call list — **QM scorecard rubric** editor + **Copy for QA node**. |
| `gtm-mk01-analytics-quality-widget.png` | Overview — **CX & containment** quality rollup widget. |
| `gtm-mk01-analytics-call-review.png` | Call detail — **AI call review** panel (`E2E_GTM_SAMPLE_CALL_ID`). |
| `gtm-we01-settings-http-cache-policy.png` | Step **G** — Settings card + optional per-integration table (draft policy). |
| `gtm-we01-http-tool-happy-path.png` | Step **A** — HTTP tool editor with **Happy path** checklist visible (`E2E_GTM_HTTP_TOOL_UUID`). |
| `gtm-we01-workflow-get-started.png` | **Voice Agents** hub — **Get started** cards (catalog / builder / import / blank). |
| `gtm-mk01-workflow-import-dialog.png` | **Import external flow** dialog on `/workflow`. |
| `gtm-we01-workflow-editor-outcome-checklist.png` | Workflow editor right rail — **Outcome checklist** + catalog HTTP guide (`E2E_GTM_WORKFLOW_ID`). |

Wire these into slides or a Notion page; Mintlify can reference them later from `docs/` if you promote the story to the public docs site.

## API-only checks (curl)

Use a **Bearer** token from the same org as the browser session.

```bash
export BACKEND_API_ENDPOINT="${BACKEND_API_ENDPOINT:-http://localhost:8000}"
export GTM_DEMO_BEARER_TOKEN='paste-access-token'

curl -sS "${BACKEND_API_ENDPOINT}/api/v1/analytics/redaction-policy" \
  -H "Authorization: Bearer ${GTM_DEMO_BEARER_TOKEN}" | python3 -m json.tool

curl -sS "${BACKEND_API_ENDPOINT}/api/v1/analytics/insights?days=7" \
  -H "Authorization: Bearer ${GTM_DEMO_BEARER_TOKEN}" | python3 -m json.tool

curl -sS "${BACKEND_API_ENDPOINT}/api/v1/analytics/qm-export-schedule" \
  -H "Authorization: Bearer ${GTM_DEMO_BEARER_TOKEN}" | python3 -m json.tool

curl -sS "${BACKEND_API_ENDPOINT}/api/v1/organizations/http-integration-cache-policy" \
  -H "Authorization: Bearer ${GTM_DEMO_BEARER_TOKEN}" | python3 -m json.tool
```

Optional: prove **API keys cannot disable** redaction (expect **403** on PUT):

```bash
export GTM_DEMO_API_KEY='your-org-api-key'
curl -sS -o /dev/stderr -w "%{http_code}" -X PUT \
  "${BACKEND_API_ENDPOINT}/api/v1/analytics/redaction-policy" \
  -H "X-API-Key: ${GTM_DEMO_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"detail_redaction_enabled":false}'
echo
```

Repo helper (same flows + status hints):

```bash
chmod +x scripts/gtm-http-api-analytics-redaction-demo.sh
./scripts/gtm-http-api-analytics-redaction-demo.sh
# Or: ./scripts/gtm-http-api-analytics-redaction-demo.sh https://api.example.com "$GTM_DEMO_BEARER_TOKEN"
```

## Automated regression (CI / offline)

- Booking → analytics span chain (no network): [booking-http-analytics-smoke.md](booking-http-analytics-smoke.md).
- Redaction RBAC units: `pytest api/tests/test_redaction_policy_rbac_unit.py`.
- Vertical catalog ↔ Overview presets: `pytest api/tests/test_vertical_packs_catalog.py` (**analytics_hooks**); `npm test -- analyticsDashboardLayout.test.ts` (slug ↔ widget preset).
- Playwright (`ui/`): `npm run build && npm run test:e2e` (OSS redirect for **`/analytics`**, **`/analytics/calls`**, and **`/workflow/catalog`**); with **`E2E_EMAIL`** / **`E2E_PASSWORD`** + API up — Overview **`catalog_slug`** + redaction control + **Calls list** shell (**Scheduled QM export**, server export button) + **Template catalog** authenticated smoke + **catalog install → Customize → graph nudge + Save** ([catalog-marketplace.spec.ts](../../ui/e2e/catalog-marketplace.spec.ts); skipped when **`E2E_EXPECT_STACK_AUTH=1`**); with **`E2E_STRICT_REDACTION_RBAC=1`** and API **`MK01_ANALYTICS_LOCAL_E2E_STRICT_REDACTION_RBAC`**, **`MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER`** — locked **PII** switch for members; **`E2E_EXPECT_SUPERUSER_MAY_DISABLE=1`** after promoting user — interactive toggle ([analytics-overview.spec.ts](../../ui/e2e/analytics-overview.spec.ts)). CI: **[ci_promote_oss_user_superuser.py](../../scripts/ci_promote_oss_user_superuser.py)** between two runs ([ui-playwright.yml](../../.github/workflows/ui-playwright.yml)). **Stack:** **`E2E_EXPECT_STACK_AUTH=1`** — optional no-`/auth/login` smoke; authenticated runs use **`E2E_STACK_REFRESH_TOKEN`** (`/impersonate`) and/or **`E2E_PLAYWRIGHT_STORAGE_STATE`** (see [ui/AGENTS.md](../../ui/AGENTS.md)). **GTM deck PNGs (local only):** **`E2E_GTM_DECK_SCREENSHOTS=1`** runs [gtm-deck-screenshots.spec.ts](../../ui/e2e/gtm-deck-screenshots.spec.ts) and writes **`docs/images/gtm-*.png`** (optional **`E2E_GTM_SAMPLE_CALL_ID`**).

## Related

- [PARTNER_REVIEW.md](../PARTNER_REVIEW.md) — PII / governance wording for external-facing decks.
