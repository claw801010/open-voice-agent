# Template quality rubric — reviewer worksheet (MK-01-RUBRIC)

**Execution ID:** [MK-01-RUBRIC](../READMEPLANTOEXECUTE.md#mk-01-rubric--template-quality-rubric-stub)  
**Use with:** [vertical-packs.json](vertical-packs.json), [PARTNER_REVIEW.md](PARTNER_REVIEW.md), pack runbooks under [runbooks/](../runbooks/).

Copy this table into a PR description or ticket when adding or materially changing a vertical pack.

## Pack under review

| Field | Value |
|-------|--------|
| **Pack slug** | |
| **PR / branch** | |
| **Reviewer** | |
| **Date** | |

## Pass / fail gates (v0)

| # | Criterion | Pass? | Notes |
|---|-----------|-------|-------|
| 1 | **Industry + primary use case** are explicit in `industry`, `display_name`, and `summary` (buyer can tell who it is for in one read). | ☐ | |
| 2 | **Packaged graph** referenced by `workflow_template.packaged_definition_ref` exists under [packaged-workflows/](packaged-workflows/) and installs without validation errors in CI. | ☐ | |
| 3 | **Happy-path test** is documented in the pack runbook (steps + expected outcome); at least one scenario is copy-pasteable for QA. | ☐ | |
| 4 | **`default_template_variables`** lists every key the graph expects; values are **safe placeholders** (no real PII, secrets, or production URLs). | ☐ | |
| 5 | **`cost_latency_estimate_band`** is plausible for declared `supported_modes` and typical tool/LLM usage described in the runbook. | ☐ | |
| 6 | **`compliance_tags`** match integrations and data flows described in the runbook and [PARTNER_REVIEW.md](PARTNER_REVIEW.md) (no contradictory claims). | ☐ | |
| 7 | **`runbook_path`** resolves to a checked-in markdown file; runbook links back to this pack slug. | ☐ | |
| 8 | **`use_cases`** and **`languages`** are non-empty and aligned with READMEPLANNING §6 positioning for the vertical. | ☐ | |
| 9 | **Revenue / booking / analytics claims:** if the summary or `use_cases` mention scheduling, payments, conversion, or **insights/dashboards**, the **packaged graph or runbook** makes clear what is **shipped vs roadmap** ([PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md), [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md)). | ☐ | |

## Catalog JSON field map (quick reference)

| Rubric row | `vertical-packs.json` fields |
|------------|------------------------------|
| 1 | `industry`, `display_name`, `summary`, `use_cases` |
| 2 | `workflow_template.packaged_definition_ref` |
| 3 | `runbook_path` (documented test) |
| 4 | `default_template_variables` |
| 5 | `cost_latency_estimate_band`, `supported_modes` |
| 6 | `compliance_tags`, runbook + PARTNER_REVIEW |
| 7 | `runbook_path` |
| 8 | `use_cases`, `languages` |
| 9 | `summary`, `use_cases`, runbook, [PREBUILD_VERTICAL_ROADMAP.md](PREBUILD_VERTICAL_ROADMAP.md), [ANALYTICS_VERTICAL_ROADMAP.md](ANALYTICS_VERTICAL_ROADMAP.md) |

## Sign-off

- [ ] All gates **Pass** or documented waiver with owner approval  
- [ ] `pack_semver` bumped per [catalog/README.md](README.md) versioning rules  

**Maintainers:** extend this file when MK-01-RUBRIC adds automated checks; keep the worksheet human-first for partner submissions.
