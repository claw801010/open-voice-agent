# UI - Frontend Application

Next.js 15 frontend for the Dograh voice AI platform.

## Project Structure

```
ui/
├── src/
│   ├── app/          # Next.js App Router pages
│   ├── components/   # React components
│   ├── lib/          # Utilities and configurations
│   ├── client/       # Auto-generated API client
│   ├── context/      # React context providers
│   ├── hooks/        # Custom React hooks
│   ├── constants/    # Application constants
│   └── types/        # TypeScript type definitions
├── public/           # Static assets
└── package.json
```

## Where to Find Things

| Looking for...      | Go to...                                             |
| ------------------- | ---------------------------------------------------- |
| Pages/routes        | `src/app/` - Next.js App Router (file-based routing) |
| Reusable components | `src/components/` - organized by feature             |
| Base UI primitives  | `src/components/ui/` - shadcn/ui components          |
| Workflow builder    | `src/components/flow/` - React Flow based            |
| Product tiers (no-code / builder / ADK) | Repo root [READMEEXPERIENCE.md](../READMEEXPERIENCE.md), [READMEADK.md](../READMEADK.md) |
| API calls           | `src/client/` - auto-generated from OpenAPI spec     |
| Auth utilities      | `src/lib/auth/`                                      |
| Helper functions    | `src/lib/utils.ts`                                   |
| Global state        | `src/context/` - React context providers             |

## Tech Stack

- Next.js 15 with App Router, React 19, TypeScript
- Tailwind CSS with shadcn/ui components
- Zustand for state management
- @xyflow/react for workflow builder

## API Client (generated OpenAPI)

The `src/client/` directory is **auto-generated** from the backend OpenAPI spec. **Do not** hand-edit files under `src/client/`.

- Whenever you add a backend route and call it from the UI, run **`npm run generate-client`** after the API is running at `{BACKEND}/api/v1/openapi.json` (see [ui/package.json](package.json) `openapi-ts` config).
- **Before merging** UI that depends on new endpoints, regenerate the client so types and SDK calls match production OpenAPI—same rule as [READMEADK.md](../READMEADK.md) and repo root [AGENTS.md](../AGENTS.md).
- Optional: in CI, fail the job if `npm run generate-client` produces a git diff (catches forgotten regeneration).

```bash
npm run generate-client
```

## Conventions

### File Uploads

Always use a hidden `<input type="file">` with a visible `<Button>` that triggers it via `fileInputRef.current?.click()`. Never use a visible `<Input type="file">` — the native file input styling is inconsistent and confusing. Show the selected filename next to or below the button.

### Authenticated API Calls

Components that make API calls must wait for auth to be ready before fetching. Use `useAuth()` and guard the `useEffect` with `authLoading` and `user`:

```tsx
const { user, loading: authLoading } = useAuth();
const hasFetched = useRef(false);

useEffect(() => {
  if (authLoading || !user || hasFetched.current) return;
  hasFetched.current = true;
  fetchData();
}, [authLoading, user]);
```

The auth interceptor (which attaches the Bearer token) is only registered once auth is fully loaded. Fetching before that sends unauthenticated requests that silently fail.

## Development

```bash
npm install
npm run dev    # Runs on port 3000
npm test       # Vitest — unit tests (e.g. `src/**/*.test.ts`)
```

### E2E (Playwright)

MK-01 Analytics smoke lives under **`e2e/`** ([playwright.config.ts](playwright.config.ts)). CI runs **unauthenticated** OSS middleware checks (`/analytics` and **`/analytics/calls`** → `/auth/login`) plus a second job that migrates DB, starts API with **`MK01_ANALYTICS_LOCAL_E2E_STRICT_REDACTION_RBAC`** + **`MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER`**, seeds **`POST /auth/signup`**, runs Playwright with **`E2E_STRICT_REDACTION_RBAC=1`** (member: locked **PII** switch), then **[ci_promote_oss_user_superuser.py](../scripts/ci_promote_oss_user_superuser.py)** and a second Playwright run with **`E2E_EXPECT_SUPERUSER_MAY_DISABLE=1`** (interactive toggle). Authenticated coverage includes **`/analytics/calls`** (call list + scheduled QM export card) when **`E2E_EMAIL`** / **`E2E_PASSWORD`** are set.

**Authenticated** specs locally when **`E2E_EMAIL`** and **`E2E_PASSWORD`** are set (API up; optional **`E2E_BACKEND_URL`**). Add **`E2E_STRICT_REDACTION_RBAC=1`** to exercise the RBAC-locked switch against an API using the env vars above.

**Template catalog:** [e2e/catalog-marketplace.spec.ts](e2e/catalog-marketplace.spec.ts) — OSS **`/workflow/catalog` → /auth/login**; authenticated **Template catalog** heading + successful **`GET /catalog/vertical-packs`** (no load error). With **`E2E_EMAIL`** / **`E2E_PASSWORD`** and OSS (not Stack) CI: **Install into my org** on **Patient screening & triage** → **`/workflow/{id}`** + **Customize** → **Tidy up layout** → **Save** → **Publish** when validation passes (else validation-errors chip) (skipped when **`E2E_EXPECT_STACK_AUTH=1`**).

**GTM deck screenshots (optional):** set **`E2E_GTM_DECK_SCREENSHOTS=1`** with the same auth envs; run from **`ui/`** so paths resolve. Writes **`../docs/images/gtm-mk01-*.png`** and **`gtm-we01-*.png`** at **1280×720** (overview, calls, QM schedule, **scorecard rubric**, **quality widget**; with **`E2E_GTM_SAMPLE_CALL_ID`** also **call-detail** + **AI call review**). See [e2e/gtm-deck-screenshots.spec.ts](e2e/gtm-deck-screenshots.spec.ts).

**Stack auth (`E2E_EXPECT_STACK_AUTH=1`):** Middleware does not redirect to **`/auth/login`** — the **“OSS local middleware”** redirect test is skipped, and an optional **“no `/auth/login`”** smoke runs instead. For **authenticated** Overview specs, either:

- Set **`E2E_PLAYWRIGHT_STORAGE_STATE`** to a Playwright **`storageState`** JSON (path must exist; loaded in [playwright.config.ts](playwright.config.ts) when combined with **`E2E_EXPECT_STACK_AUTH=1`**), or  
- Set **`E2E_STACK_REFRESH_TOKEN`** so each run hits **`/impersonate`** ([stackSession.ts](e2e/stackSession.ts)) before tests (staging-only; token appears in the URL).

```bash
npx playwright install chromium   # once per machine
npm run build && npm run test:e2e # CI-style (starts next start)
# or: UI already running → PLAYWRIGHT_SKIP_WEBSERVER=1 E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e
# Stack smoke only: E2E_EXPECT_STACK_AUTH=1 npm run test:e2e
# Stack authenticated: E2E_EXPECT_STACK_AUTH=1 E2E_STACK_REFRESH_TOKEN=… npm run test:e2e
# GTM deck PNGs (1280×720, writes ../docs/images/gtm-*.png): E2E_GTM_DECK_SCREENSHOTS=1 E2E_EMAIL=… E2E_PASSWORD=… PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e -- gtm-deck
# Optional call-detail frame: E2E_GTM_SAMPLE_CALL_ID='wr-…' (same command)
```
