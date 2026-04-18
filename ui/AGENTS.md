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
```
