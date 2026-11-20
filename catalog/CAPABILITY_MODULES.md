# Capability modules (MK-01)

Composable **business motions** buyers ask for—appointment booking, FAQ, lead verification, WISMO, payments, and more—mapped to shipped **vertical packs** without duplicating full workflow JSON.

## For buyers

1. Open **Template catalog** (`/workflow/catalog`).
2. Under **Capabilities**, select one or more motions (e.g. **Appointment scheduling** + **FAQ & policy answers**).
3. Packs that implement **any** selected motion stay visible; others are filtered out.
4. Use **Install best match** when one vertical covers everything, or **Install plan (N)** when motions span industries (multi-pack compose).

## Catalog source

- **`catalog/capability-modules.json`** — canonical list (`id`, `label`, `category`, `demand_rank`, `pack_refs`).
- Each `pack_ref` points at a vertical pack `slug` and optional `variant_id` (simple vs booking/complex).

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/catalog/capability-modules` | List modules + categories |
| `GET /api/v1/catalog/capability-modules/resolve?module_ids=a,b` | Best single-pack install target |
| `GET /api/v1/catalog/capability-modules/compose-plan?module_ids=a,b` | Multi-pack install plan |
| `POST /api/v1/workflow/install-from-capability-modules` | Install best match |
| `POST /api/v1/workflow/install-from-capability-modules/plan` | Install full compose plan |

`GET /api/v1/catalog/vertical-packs` enriches each pack with **`capability_module_ids`** for badges and filters. Installed workflows store selected motions under **`workflow_configurations.mk01.capability_module_ids`** (editor header + analytics lineage).

## Categories (v2)

| Category | Examples |
|----------|----------|
| Scheduling | appointment scheduling, site visit, salon booking, discovery call |
| FAQ & knowledge | FAQ/policy, product assistance, service area FAQ |
| Sales & growth | lead capture, qualification, verification |
| Verification & trust | identity/token lookup, scripted guardrails |
| Payments & billing | payment redirect, balance inquiry, collections |
| Operations & status | WISMO, outage status, location router, human handoff |
| Field / local services | estimates, stylist routing, solopreneur intake |

## CI

- [test_capability_modules_catalog.py](../api/tests/test_capability_modules_catalog.py)
- [test_capability_modules_resolve_unit.py](../api/tests/test_capability_modules_resolve_unit.py)
- [test_capability_modules_compose_unit.py](../api/tests/test_capability_modules_compose_unit.py)
- [capabilityModules.test.ts](../ui/src/lib/catalog/capabilityModules.test.ts)
- Playwright: [catalog-marketplace.spec.ts](../ui/e2e/catalog-marketplace.spec.ts) (capability install)
