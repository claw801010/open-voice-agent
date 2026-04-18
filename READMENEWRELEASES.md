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

### Marketplace / catalog

- **MK-01-CATALOG** — Canonical **vertical pack** metadata in [catalog/vertical-packs.json](catalog/vertical-packs.json) (healthcare screening, retail WISMO, B2B SaaS trial nurture) with linked **runbooks** under [runbooks/](runbooks/).

### Workflow editor

- **WE-01-SHELL** — Three-column resizable shell: left palette, center React Flow, right inspector rail; layout widths persist in `localStorage` per workflow; historical versions stay full-width read-only.
- **WE-01-PALETTE** — Palette uses **Nodes | Components** tabs (conversation path vs global/integrations); same click-to-add-at-center behavior; keyboard/Escape documented in [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) under the package.

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
| 2026-04-21 | Unreleased: **DX-01-ADK** entry. |
| 2026-04-20 | Unreleased: **DX-01-BUILDER** entry. |
| 2026-04-19 | Unreleased: **MK-01-CATALOG** entry. |
| 2026-04-18 | Unreleased: **WE-01-SHELL**, **WE-01-PALETTE** entries. |
| 2026-04-17 | Initial file; template with “For businesses” / MK-01 guidance for marketplace releases. |
