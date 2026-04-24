# GTM: No-code happy path (Web test)

Short **Loom-style script** for demos and onboarding video. Tied to **DX-01-NOCODE** in [READMEPLANTOEXECUTE.md](../READMEPLANTOEXECUTE.md).

## Setup (before record)

1. Use a **clean browser profile** or incognito; sign in with a demo org.
2. Pre-install **one catalog template** or use **Create Voice Agent** so the graph is valid without manual JSON.

## Script (~3–4 minutes)

1. **Hook (15s)** — “You don’t need to read workflow JSON to hear your agent. Here’s Web test in under a minute.”
2. **Templates (45s)** — Open **Template catalog** → pick an industry pack → **Install** → land in the editor (read-only until **Customize** if shown).
3. **Customize (30s)** — Click **Customize** if the graph is locked; adjust template variables from **Global** if needed; **Save**.
4. **Simulation rail (60s)** — Switch header to **Simulation**. Point out **Start Web test** — same as **Call → Web Call**, no PSTN. Start the run; allow mic; speak one prompt.
5. **Validation (30s)** — Toggle back to **Edit**; if something breaks publish, open the header validation popover — **plain-language titles**, not only API strings.
6. **Close (15s)** — “Publish when ready; embed and phone are next steps in settings and recipes.”

## B-roll / screenshots

- Header: **Edit | Simulation** tabs.
- Simulation rail: **Start Web test** + **LoopTalk** + **Raw debug (redacted)** collapsed.
- Empty canvas hint: **Browse template catalog** when the graph has no nodes.

## Out of scope for this clip

- PSTN **Phone Call** (mention as “production path”).
- **Text-only chat** in the editor rail (roadmap / WE-01-TEST).
