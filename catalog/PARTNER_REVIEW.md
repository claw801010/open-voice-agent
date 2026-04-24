# Partner pack — review checklist (MK-01-PARTNER)

Use this checklist before a vertical pack is treated as **published** in the marketplace narrative (repo catalog, partner site, or internal approval). Submission is typically a **pull request** that updates [vertical-packs.json](vertical-packs.json), [packaged-workflows/](packaged-workflows/), and [runbooks/](runbooks/).

## Safety & content

- [ ] **Prompts and scripts** avoid instructions that encourage harmful, illegal, or deceptive behavior.
- [ ] **Medical / legal**: No claims of diagnosis or legal advice unless the pack is explicitly scoped and disclaimed; align copy with your counsel for regulated industries.
- [ ] **Emergency**: Flow does not claim to replace emergency services; appropriate disclaimers where triage could be misinterpreted.

## PII and data minimization

- [ ] **Collection**: Only variables and extraction fields needed for the stated use case; document what is spoken or stored.
- [ ] **Retention**: Runbook states what is logged (transcripts, recordings) and org responsibilities.
- [ ] **Secrets**: No API keys, tokens, or private URLs embedded in packaged JSON committed to the repo; use template variables and org-level configuration.

## Telephony and compliance copy

- [ ] **Recording / consent**: Where recording or analytics apply, runbook includes jurisdiction-appropriate disclosure patterns (opt-in, two-party, etc.) — **legal review** for production.
- [ ] **TCPA / outreach**: Outbound or campaign-style use is not implied without appropriate consent and list-hygiene notes in the runbook.
- [ ] **Payment / PCI**: No collection of full card numbers in prompts; compliance tags in JSON reflect constraints (e.g. `no-payment-card-in-prompt`).

## Technical

- [ ] **Packaged graph** validates against the workflow schema used by the API; triggers regenerated on install as today.
- [ ] **Runbook** path in JSON matches a file under [runbooks/](runbooks/).
- [ ] **Semver**: `pack_semver` in [vertical-packs.json](vertical-packs.json) bumped per [catalog README](README.md#pack-versioning-semver).

## Versioning policy

See [README.md](README.md#pack-versioning-semver). **Major** = breaking graph or variable contract; **minor** = additive behavior; **patch** = copy/runbook-only fixes.
