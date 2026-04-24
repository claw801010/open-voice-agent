# READMENEWRELEASES — what shipped (FulliO / fork)

Human-readable **release log** tied to **[READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md)** work item IDs. Append **newest first** under Unreleased or under a dated version heading.

Use this file to **prove momentum** to customers and partners: marketplace features (**MK-01**\*), workflow editor upgrades (**WE-01**\*), **experience tiers** (**DX-01**\* — no-code, builder, ADK), vertical packs, and infra changes should all appear here with **plain-language outcomes** (what businesses can do now that they could not before).

## How to use with READMEPLANTOEXECUTE

1. When a work package moves to **`Done`**, add an entry here (same PR or immediately after merge).
2. In **READMEPLANTOEXECUTE**, set the item status to `Done` and add a link to the PR or commit SHA.
3. Optionally bump **version** in [api/pyproject.toml](api/pyproject.toml) / [ui/package.json](ui/package.json) per your release process.
4. For **marketplace-impacting** releases, add a **“For businesses”** bullet (which vertical or use case improved) so GTM can lift copy into your public site.

---

## Unreleased

### Developer experience (ADK tier)

- **DX-01-ADK** — [READMEADK.md](READMEADK.md) adds **copy-paste MCP (Python + `fastmcp`)** and **REST publish** (`curl` + httpx) with `X-API-Key`; [ui/AGENTS.md](ui/AGENTS.md) documents **generated client** regeneration and optional CI drift check; [READMEEXPERIENCE.md](READMEEXPERIENCE.md) ADK journey links tightened.

### Developer experience (builder tier)

- **DX-01-BUILDER** — All three [recipes/](recipes/) now include **environment variables** and **exact `/api/v1/...` paths** aligned with [READMELEARNME.md](READMELEARNME.md) §3; OpenAPI import called out.

### Operator experience (no-code tier)

- **DX-01-NOCODE** — Human-readable **validation** in the header popover ([friendlyValidation.ts](ui/src/lib/workflow/friendlyValidation.ts)); **Simulation → Start Web test** mirrors **Call → Web Call** (browser mic, no PSTN) with disabled + tooltip when save/validation block ([WorkflowEditorRightRail.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorRightRail.tsx)); **empty canvas** links to the **template catalog** ([RenderWorkflow.tsx](ui/src/app/workflow/[workflowId]/RenderWorkflow.tsx)); GTM **Loom-style script**: [gtm/no-code-happy-path.md](gtm/no-code-happy-path.md); [READMEEXPERIENCE.md](READMEEXPERIENCE.md) no-code journey updated.

### Marketplace / catalog

- **MK-01-TRY** — **Try (Web only)** and **Try (LoopTalk persona)** on the template catalog: Web path uses **`smallwebrtc`**; LoopTalk path calls **`POST /api/v1/looptalk/test-sessions/quick-persona`** (actor = installed pack, adversary = system **`[System] LoopTalk simulated caller`** graph) then opens **`/looptalk/{sessionId}`**. Cost copy in dialogs (no PSTN on these flows; LoopTalk uses LLM on both sides); dialogs state **no outbound dials** on Web try and **no external phone numbers** on LoopTalk, with a pointer to **Web only** for single-agent mic tests ([MarketplaceCatalog.tsx](ui/src/components/catalog/MarketplaceCatalog.tsx)).
- **MK-01-PARTNER** — Partner **review checklist** ([catalog/PARTNER_REVIEW.md](catalog/PARTNER_REVIEW.md)); **`pack_semver`** on each vertical pack and **`catalog_version`** bump in [catalog/vertical-packs.json](catalog/vertical-packs.json); versioning policy in [catalog/README.md](catalog/README.md).
- **MK-01-BROWSE** — **Discover UI**: filters on industry, use case (text), language, and compliance tags; shared [MarketplaceCatalog](ui/src/components/catalog/MarketplaceCatalog.tsx). Public SEO route **`/templates`** ([ui/src/app/templates/](ui/src/app/templates/)) with server-fetched catalog; authenticated install remains at **`/workflow/catalog`**.
- **MK-01** (catalog polish) — **Empty / no-filter-match** messaging and **`role="status"`** when the catalog is empty ([MarketplaceCatalog.tsx](ui/src/components/catalog/MarketplaceCatalog.tsx)); authenticated catalog + public **`/templates`** subtitles aligned with install + Web test vs PSTN ([workflow/catalog/page.tsx](ui/src/app/workflow/catalog/page.tsx), [templates/page.tsx](ui/src/app/templates/page.tsx)).
- **MK-01-INSTALL** — **Install into org** from the template catalog: `POST /api/v1/workflow/install-from-catalog` plus packaged graphs under [catalog/packaged-workflows/](catalog/packaged-workflows/); dashboard lists **template variable** keys; editor opens **read-only** after install until **Customize** clears the lock (`workflow_configurations.mk01`). UI: **Create Agent → Template catalog** ([ui/src/app/workflow/catalog/page.tsx](ui/src/app/workflow/catalog/page.tsx)).
- **MK-01-CATALOG** — Canonical **vertical pack** metadata in [catalog/vertical-packs.json](catalog/vertical-packs.json) (healthcare screening, retail WISMO, B2B SaaS trial nurture) with linked **runbooks** under [runbooks/](runbooks/).

### Workflow editor

- **WE-01-VISUAL-DEPTH** (pilot) — **Organization usage** (`/usage`): bento-style **billing period** tiles, **glass** hero + **Activity** / **MPS** cards, ambient glow layers; shared **`ovo-*`** utilities in [globals.css](ui/src/app/globals.css) with **`prefers-reduced-motion`** fallbacks ([usage/page.tsx](ui/src/app/usage/page.tsx)); design pillar and rollout checklist in [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) (**WE-01**).
- **WE-01-ORG-USAGE** — **pytest** [test_usage_daily_rollup_routes.py](api/tests/test_usage_daily_rollup_routes.py): **`GET .../usage/daily-rollup`** and **`GET .../usage/weekly-rollup`** for **org** and **workflow** (**400** / **404** / **422**, bucket counts for fixed UTC ranges); rollup handlers re-raise **`HTTPException`** from [parse_utc_inclusive_date_range](api/utils/usage_rollup_range.py) instead of masking as **500** ([organization_usage.py](api/routes/organization_usage.py), [workflow.py](api/routes/workflow.py)). **Local / restricted DB roles:** optional **`PYTEST_DATABASE_URL`** skips **`CREATE DATABASE`** ([conftest.py](api/conftest.py)); sample vars in **[api/.env.test.example](api/.env.test.example)**. **CI:** [api-pytest-usage-rollup.yml](.github/workflows/api-pytest-usage-rollup.yml) runs the same file against **Postgres 16** + **Redis** services.
- **WE-01-ORG-USAGE** — **Simulation** rail **Week \| Day** usage chart: per-workflow **`GET /api/v1/workflow/{workflow_id}/usage/daily-rollup`** + same URL params and **`usageTrendLookbackDays:{workflowId}`** sessionStorage as **`/usage`**; [RenderWorkflow.tsx](ui/src/app/workflow/[workflowId]/RenderWorkflow.tsx), [WorkflowEditorRightRail.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorRightRail.tsx); [aggregateRunsByDay](ui/src/lib/workflow/workflowRunTrends.ts) fallback; export stem **`workflow-{id}-usage-daily-trend`**. Backend: shared [trim_rollup_bucket_window](api/utils/usage_rollup_range.py) for rolling weekly/daily bucket lists ([organization_usage_client.py](api/db/organization_usage_client.py)).
- **WE-01-ORG-USAGE** — **`/usage` Activity chart:** **Week \| Day** toggle; org **`GET /api/v1/organizations/usage/daily-rollup`** (rolling **`days`** or fixed **`since`/`until`**, same UTC inclusive rules as weekly); shareable **`?trendGranularity=day`** + **`?trendDays=`**; **day** bar click filters **Usage History** by **one UTC calendar day**; [dailyRollupApiToUsageTrendBuckets](ui/src/lib/workflow/workflowRunTrends.ts), [usageOrgDeepLink.ts](ui/src/lib/usageOrgDeepLink.ts) `utcDayRangeFromYmd`, [usage/page.tsx](ui/src/app/usage/page.tsx).
- **WE-01-HEADER** — **Edit \| Simulation** rail tabs: per-tab **`aria-label`** for assistive tech ([WorkflowEditorHeader.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorHeader.tsx)).
- **WE-01-ORG-USAGE** — **Organization usage** (`/usage`): **Current billing period** from `GET /api/v1/organizations/usage/current-period`; **Weekly activity** uses **`GET /api/v1/organizations/usage/weekly-rollup`** with selectable lookback (**4–52** weeks) **or** a fixed **UTC calendar range** via **`?since=`** / **`?until=`** (YYYY-MM-DD, inclusive) matching **`?trendSince=`** / **`?trendUntil=`** in the UI URL; shareable **`?trendWeeks=`** when not using a custom range (default **8** omitted), optional **CSV** export (including **inbound** / **outbound** run counts per week), **PNG** snapshot of the weekly chart, and a **Recharts** chart with **stacked** inbound vs outbound **run** bars plus **tokens** line; **`?week=YYYY-MM-DD`** (UTC Monday) pre-fills the date filter; **clickable bars** apply that week to **Usage History** and scroll; workflow editor **Trend** hint links to **`/usage?week=`** (current UTC week); ⋮ **Org usage · this UTC week**; **Organization usage** opens `/usage`. **Simulation** rail on **`/workflow/[id]`** mirrors the same **`trendSince`** / **`trendUntil`** / **`trendWeeks`** query pattern for the per-workflow chart, including **CSV** and **PNG** export on that chart ([RenderWorkflow.tsx](ui/src/app/workflow/[workflowId]/RenderWorkflow.tsx), [WorkflowEditorRightRail.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorRightRail.tsx), [usageOrgDeepLink.ts](ui/src/lib/usageOrgDeepLink.ts), [usage/page.tsx](ui/src/app/usage/page.tsx), [organization_usage.py](api/routes/organization_usage.py), [usage_rollup_range.py](api/utils/usage_rollup_range.py), [WorkflowEditorHeader.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorHeader.tsx), [WorkflowUsageTrendPanel.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowUsageTrendPanel.tsx)).
- **WE-01-FEEDBACK** — In-app **Send feedback** dialog on the workflow editor (header ⋮) posts to **`POST /api/v1/feedback`**; rows stored in **`product_feedback`** with user, org, optional workflow id, and user-agent; optional **`NEXT_PUBLIC_FEEDBACK_URL`** adds an **Open external form** link in the dialog ([feedback.py](api/routes/feedback.py), [WorkflowFeedbackDialog.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowFeedbackDialog.tsx), [test_product_feedback.py](api/tests/test_product_feedback.py)).
- **WE-01-SUBFLOWS (nested)** — Component-tab edges can set **Run subgraph first** to a **sibling** named subgraph (same root `subflows` keys); backend validates sibling keys per nested graph; voice runtime uses a **stacked resume** when entering subgraphs from inside a component ([workflow.py](api/services/workflow/workflow.py), [pipecat_engine.py](api/services/workflow/pipecat_engine.py), [CustomEdge.tsx](ui/src/components/flow/edges/CustomEdge.tsx)); tests in [test_workflow_subflows.py](api/tests/test_workflow_subflows.py).
- **WE-01-HEADER** — **Usage trend:** primary **`GET /api/v1/workflow/{workflow_id}/usage/weekly-rollup`** (UTC-week run counts + token sums) with **Range** lookback **4–52** weeks; **Recharts** dual-axis chart on the **Simulation** rail; fallback aggregates up to **100 recent runs** from `GET /api/v1/workflow/{workflow_id}/runs` client-side ([workflowRunTrends.ts](ui/src/lib/workflow/workflowRunTrends.ts)); header **Trend (N wks): runs · tokens** ([WorkflowUsageTrendPanel.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowUsageTrendPanel.tsx), [workflow.py](api/routes/workflow.py)).
- **WE-01-HEADER** — **Dry-run cost line:** `GET /api/v1/workflow/{workflow_id}/estimate-cost` ([cost_estimate_dry_run.py](api/services/workflow/cost_estimate_dry_run.py)) returns heuristic **Dograh tokens** and USD from the **saved draft** (or released) graph + model settings; editor header shows **Est. dry-run: ~N Dograh tokens** with a tooltip (models + assumptions) ([workflowCostDryRun.ts](ui/src/lib/workflow/workflowCostDryRun.ts), [RenderWorkflow.tsx](ui/src/app/workflow/[workflowId]/RenderWorkflow.tsx)). Not a substitute for completed-run `cost_info`.
- **WE-01-DUALMODE** — Node editor **Form \| Raw JSON** ([NodeEditDialog.tsx](ui/src/components/flow/nodes/common/NodeEditDialog.tsx)) + **tool detail** **`/tools/[toolUuid]`** ([useToolFormRawTabs.tsx](ui/src/app/tools/[toolUuid]/hooks/useToolFormRawTabs.tsx)). **Unsaved changes:** [UnsavedChangesContext](ui/src/context/UnsavedChangesContext.tsx) — **`beforeunload`**, in-app link / back intercept; **tool** route ([layout](ui/src/app/tools/[toolUuid]/layout.tsx), `tool-detail`); **workflow canvas** on **`/workflow/[id]`** ([page.tsx](ui/src/app/workflow/[workflowId]/page.tsx) provider + [RenderWorkflow.tsx](ui/src/app/workflow/[workflowId]/RenderWorkflow.tsx) `workflow-canvas` when the graph is dirty and editable).
- **WE-01-A11Y-QA** — **Usage trend Week \| Day:** Radix **`Tabs`** with **`aria-labelledby`** on **Simulation** and **`/usage`** ([UsageTrendGranularityTabs.tsx](ui/src/components/usage/UsageTrendGranularityTabs.tsx), [WorkflowEditorRightRail.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorRightRail.tsx), [usage/page.tsx](ui/src/app/usage/page.tsx)).
- **WE-01-A11Y-QA** — **UTC custom range** grouped with **`fieldset`/`legend`** on **Simulation** and **`/usage`** Activity; **usage trend chart** **`role="img"`** with week/day-aware **`aria-label`** plus **`aria-describedby`** long description; **`role="status"`** on empty/error ([WorkflowEditorRightRail.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorRightRail.tsx), [usage/page.tsx](ui/src/app/usage/page.tsx), [WorkflowUsageTrendPanel.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowUsageTrendPanel.tsx)).
- **WE-01-A11Y-QA** — **Keyboard-only smoke (manual QA, repeat each release):** (1) **Tab** from URL bar into the workflow header — **Back**, **Edit \| Simulation**, **Save** when dirty, **Call** menu, **Publish** when eligible. (2) With viewport **≤1023px** width, focus the **floating palette** and **inspector** icon buttons ([WorkflowEditorShell.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorShell.tsx) — `WORKFLOW_EDITOR_NARROW_MAX_PX`); **Activate** opens a **Sheet**; **Escape** closes the sheet (Radix dialog). (3) In the palette **Nodes \| Components** tabs, **Arrow keys** move between tab triggers (Radix Tabs). (4) On the canvas, **Tab** reaches zoom/settings controls when visible. (5) **Simulation** rail: **Tab** to **Usage trend** **Week \| Day** tabs — **Left/Right** switch granularity — then **Tab** through **since/until** (or weeks) → **Apply** → chart **Range** / export controls. Full contrast audit vs dark reference UI remains optional follow-up.
- **WE-01-RIGHT-INSPECTOR** (partial) — Edit mode **right rail** tabs **Inspector \| Global**: **Inspector** = read-only summary of the single selected node; **Global** = **template variables** with the same save path as the full settings page ([TemplateVariablesRailPanel](ui/src/app/workflow/[workflowId]/components/TemplateVariablesRailPanel.tsx)). **`/workflow/:id/settings?section=`** (e.g. `variables`, `models`, `general`) scrolls to that section. Full forms (General, Model overrides, …) remain on the settings route.
- **WE-01-TEST** — **Simulation** rail: **Start Web test** (same **`smallwebrtc`** run as header Web Call); **Manual chat (text)** via **`POST /api/v1/workflow/{workflow_id}/simulation/text-turn`** ([simulation_text_turn.py](api/services/workflow/simulation_text_turn.py), [SimulationManualChatPanel.tsx](ui/src/app/workflow/[workflowId]/components/SimulationManualChatPanel.tsx)) including optional **`user_persona`** (simulated caller hint, session-persisted in the browser per workflow; [simulation_user_persona.py](api/services/workflow/simulation_user_persona.py)); **LoopTalk quick persona** to **`/looptalk/test-sessions/quick-persona`**; **Raw debug (redacted)** via **[redactForDebugJson](ui/src/lib/workflow/redactForDebugJson.ts)**. Rich shared adversary packs beyond this hint field remain roadmap.
- **WE-01-HEADER** — Header shows **template source** (`mk01` catalog slug / template id), **workflow ID**, optional **catalog cost/latency** band; **Edit \| Simulation** toggles right rail (simulation = cost labels + WE-01-TEST placeholder); **No unsaved changes** when the graph is clean. **Main graph:** structural line **Main graph: N nodes · E edges · A agents** for the primary flow from in-memory graph ([draftGraphStats.ts](ui/src/lib/workflow/draftGraphStats.ts)); on a component tab, counts reflect **mainSnapshot** (not component canvas). **Last run:** when workflow runs exist with `cost_info`, the header shows **Last run: N tokens · duration** from `GET /api/v1/workflow/{workflow_id}/runs` ([recentRunUsage.ts](ui/src/lib/workflow/recentRunUsage.ts), [RenderWorkflow.tsx](ui/src/app/workflow/[workflowId]/RenderWorkflow.tsx)); refetches when the tab regains focus. **Avg last N runs:** when at least two runs include `dograh_token_usage`, shows **Avg last N runs: X tokens** (N ≤ 10, same fetch; [computeRunUsageHints](ui/src/lib/workflow/recentRunUsage.ts)). **Feedback:** optional **`NEXT_PUBLIC_FEEDBACK_URL`** (`http` / `https` / `mailto`) adds **Send feedback** in the ⋮ menu ([feedbackUrl.ts](ui/src/lib/feedbackUrl.ts), [WorkflowEditorHeader.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorHeader.tsx)); see [ui/.env.example](ui/.env.example).
- **WE-01-SHELL** — Three-column resizable shell: left palette, center React Flow, right inspector rail; layout widths persist in `localStorage` per workflow; historical versions stay full-width read-only. **Narrow (`max-width: 1023px`):** canvas is full width; **palette** and **inspector/simulation** open from **icon buttons** in **Sheet** drawers ([WorkflowEditorShell.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowEditorShell.tsx), [useMediaQuery](ui/src/hooks/useMediaQuery.ts)).
- **WE-01-PALETTE** — Palette uses **Nodes | Components** tabs (conversation path vs global/integrations); same click-to-add-at-center behavior; keyboard/Escape documented in [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) under the package.
- **WE-01-SUBFLOWS** — Sub-header **Main flow** \| **Component 1** \| **Component 2** \| **Component 3** ([WorkflowFlowScopeBar.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowFlowScopeBar.tsx), [COMPONENT_SCOPE_ENTRIES](ui/src/app/workflow/[workflowId]/workflowScope.ts)): switches canvas scope per `component_1` / `component_2` / `component_3` subgraph keys, merges **main** + **subflows** on save ([useWorkflowState.ts](ui/src/app/workflow/[workflowId]/hooks/useWorkflowState.ts)), hydrates from API / version history ([workflowStore.ts](ui/src/app/workflow/[workflowId]/stores/workflowStore.ts)). **Header:** **Subgraphs saved: N (key, …)** lists non-empty `subflows` in the store ([formatSubflowInventory](ui/src/lib/workflow/draftGraphStats.ts)). **API:** [ReactFlowDTO](api/services/workflow/dto.py) optional **`subflows`** and **`viewport`**; main-graph edges may set **`enter_subflow`** ([EdgeDataDTO](api/services/workflow/dto.py)) to run that subgraph before the edge target. **Voice:** [PipecatEngine](api/services/workflow/pipecat_engine.py) enters the named subgraph from its start, then resumes the main graph at the target node after the subgraph’s end node. **Editor:** edge dialog **Run subgraph first** on the main canvas ([CustomEdge.tsx](ui/src/components/flow/edges/CustomEdge.tsx)). **Types:** [WorkflowDefinition](ui/src/components/flow/types.ts) / `FlowEdgeData.enter_subflow`.

---

## Template for a version block

```markdown
## YYYY-MM-DD — vX.Y.Z (codename optional)

### Highlights
- …

### For businesses (marketplace / verticals)
- … (e.g. “Retail WISMO template: install + Web try in under 5 minutes”)

### READMEPLANTOEXECUTE IDs closed
- **MK-01-…** / **WE-01-…** — one-line summary each

### Migration / ops
- …

### Contributors
- …
```

---

## Changelog of this file

| Date | Change |
|------|--------|
| 2026-04-18 | Unreleased: **WE-01-VISUAL-DEPTH** — **`/usage`** glass + bento pilot ([globals.css](ui/src/app/globals.css), [usage/page.tsx](ui/src/app/usage/page.tsx)). |
| 2026-04-18 | Unreleased: **WE-01-ORG-USAGE** — **`PYTEST_DATABASE_URL`** + **`.env.test.example`**; GitHub Actions **api-pytest-usage-rollup** workflow. |
| 2026-04-18 | Unreleased: **WE-01-A11Y-QA** — **`fieldset`/`legend`** for UTC range; chart **`aria-describedby`**; **MK-01-TRY** dialog copy (dials / external numbers). |
| 2026-04-18 | Unreleased: **WE-01-A11Y-QA** — **Week \| Day** Radix tabs + keyboard smoke step (5); **WE-01-ORG-USAGE** — weekly rollup cases in **pytest**; **MK-01** catalog copy + `/templates` subtitle. |
| 2026-04-21 | Unreleased: **WE-01-ORG-USAGE** — **`?trendWeeks=`** + **CSV** + rail **sessionStorage** + chart skeleton ([usageOrgDeepLink.ts](ui/src/lib/usageOrgDeepLink.ts)). |
| 2026-04-21 | Unreleased: **WE-01-ORG-USAGE** — **Recharts** chart + **lookback** 4–52 wk ([WorkflowUsageTrendPanel.tsx](ui/src/app/workflow/[workflowId]/components/WorkflowUsageTrendPanel.tsx)). |
| 2026-04-21 | Unreleased: **WE-01-ORG-USAGE** — server **`/organizations/usage/weekly-rollup`** + **`/workflow/{id}/usage/weekly-rollup`**; UI [weeklyRollupApiToUsageTrendBuckets](ui/src/lib/workflow/workflowRunTrends.ts). |
| 2026-04-21 | Unreleased: **WE-01-ORG-USAGE** — editor Trend link + ⋮ this UTC week. |
| 2026-04-21 | Unreleased: **WE-01-ORG-USAGE** — `/usage?week=` + clickable week bars ([usageOrgDeepLink.ts](ui/src/lib/usageOrgDeepLink.ts)). |
| 2026-04-18 | Unreleased: **WE-01-ORG-USAGE** — `/usage` billing period + org weekly trend; editor link. |
| 2026-04-18 | Unreleased: **WE-01-FEEDBACK** — `POST /api/v1/feedback` + `product_feedback` migration. |
| 2026-04-18 | Unreleased: **WE-01-SUBFLOWS (nested)** — sibling subgraph entry + tests (`test_workflow_subflows`). |
| 2026-04-18 | Unreleased: **WE-01-SUBFLOWS** — `component_3` / Component 3 tab. |
| 2026-04-18 | Unreleased: **WE-01-SUBFLOWS** — Subgraphs saved header line (`formatSubflowInventory`). |
| 2026-04-18 | Unreleased: **WE-01-HEADER** — **Main graph** node/edge/agent summary (`draftGraphStats`). |
| 2026-04-18 | Unreleased: **WE-01-SUBFLOWS** — **Component 1 \| Component 2** tabs (`COMPONENT_SCOPE_ENTRIES`). |
| 2026-04-18 | Unreleased: **WE-01-HEADER** — avg tokens over last N runs with usage (`computeRunUsageHints`). |
| 2026-04-18 | Unreleased: **WE-01-HEADER** — `NEXT_PUBLIC_FEEDBACK_URL` + Send feedback menu item. |
| 2026-04-18 | Unreleased: **WE-01-HEADER** — Last run tokens/duration in editor header (`recentRunUsage`). |
| 2026-04-18 | Unreleased: **WE-01-TEST** — `user_persona` on simulation text-turn + Manual chat UI. |
| 2026-04-18 | Unreleased: **WE-01-SUBFLOWS** — ReactFlowDTO `subflows` + editor scope/save/load (`workflowStore`, `useWorkflowState`); WorkflowDefinition types. |
| 2026-04-18 | Unreleased: **WE-01-DUALMODE** — `workflow-canvas` unsaved guard on workflow editor route. |
| 2026-04-18 | Unreleased: **WE-01-SHELL** (narrow sheets) + **WE-01-A11Y-QA** (keyboard smoke). |
| 2026-04-18 | Unreleased: **DX-01-NOCODE** — Simulation Web test, empty-canvas catalog CTA, GTM script; validation copy. |
| 2026-04-18 | Unreleased: **WE-01-TEST** — `simulation/text-turn` + Manual chat (text) panel; Simulation Web test + Raw debug. |
| 2026-04-18 | Unreleased: **MK-01-TRY** (Web + LoopTalk quick-persona), **WE-01-TEST** (partial), **MK-01-PARTNER** entries. |
| 2026-04-21 | Unreleased: **DX-01-ADK** entry. |
| 2026-04-20 | Unreleased: **DX-01-BUILDER** entry. |
| 2026-04-19 | Unreleased: **MK-01-CATALOG** entry. |
| 2026-04-18 | Unreleased: **WE-01-SHELL**, **WE-01-PALETTE** entries. |
| 2026-04-17 | Initial file; template with “For businesses” / MK-01 guidance for marketplace releases. |
