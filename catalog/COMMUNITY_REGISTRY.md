# Community Catalog Registry (MK-01-REGISTRY)

**Purpose:** single public index of everything shareable in the Dograh catalog — vertical packs, workflow variants, capability modules, HTTP tool stubs, native tool templates, prompt packs, recipes, best-practice docs, inference profiles, governance policies, and skill import adapters.

Designed for **community distribution today** and **monetization tomorrow** via `distribution.tier` and `price_usd_cents` stubs (Stripe/SKU entitlements plug in later without reshaping listings).

## Files

| File | Role |
|------|------|
| [community-registry.json](community-registry.json) | **Generated** unified index (~230 listings). Commit after catalog changes. |
| [community-registry-distribution.json](community-registry-distribution.json) | Tier defaults + per-listing price overrides (free → enterprise). |
| [../scripts/build_community_catalog.py](../scripts/build_community_catalog.py) | Aggregates existing catalog sources into `community-registry.json`. |

## API (no auth)

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/catalog/registry` | Browse with filters: `type`, `tier`, `tag`, `vertical_slug`, `q`, `limit`, `offset` |
| `GET /api/v1/catalog/registry/export` | Full JSON bundle for CDN / GitHub mirror |
| `GET /api/v1/catalog/registry/{listing_id}` | Detail, e.g. `vertical_pack:barber-beauty-salon-faq` |

## UI (MK-01 marketplace)

- **Template catalog** (`/workflow/catalog`, `/templates`) — tier badge on each pack card + **Distribution tier** filter
- **Community library** tab — browse recipes, tools, prompts, inference profiles, and governance assets with tier/price badges

Components: `CatalogDistributionBadge`, `CommunityRegistryPanel`; lib: `ui/src/lib/catalog/communityRegistry.ts`

## Listing types

`vertical_pack` · `workflow_variant` · `capability_module` · `tool_stub` · `native_tool_template` · `prompt_pack` · `recipe` · `best_practice` · `inference_profile` · `governance_policy` · `skill_import`

## Distribution tiers

| Tier | Default price (USD) | Typical content |
|------|---------------------|-----------------|
| `free` | $0 | Shipped vertical packs, inference profiles, tool stubs |
| `community` | $0 | Recipes, prompt packs, skill import docs |
| `starter` | $29 | Complex workflow variants (booking/API-ready graphs) |
| `pro` | $99 | Compliance-heavy verticals (override in distribution JSON) |
| `enterprise` | contact sales | Banking, regulated stacks |

Override any listing in `community-registry-distribution.json` → `overrides`.

## Maintainer workflow

```bash
# After changing vertical-packs, capability-modules, recipes, or packaged-workflows:
python scripts/build_community_catalog.py
python scripts/build_community_catalog.py --check   # CI guard

pytest api/tests/test_community_registry_unit.py -q
```

## Related

- [README.md](README.md) — MK-01 catalog index
- [READMEMARKETPLACEPLANNING.md](../READMEMARKETPLACEPLANNING.md) — marketplace strategy
- [PARTNER_REVIEW.md](PARTNER_REVIEW.md) — partner publish checklist

**Execution ID:** MK-01-REGISTRY
