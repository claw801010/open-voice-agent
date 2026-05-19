# Runbook — B2B SaaS: trial nurture & PQL voice qual

**Pack slug:** `b2b-saas-trial-nurture`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Use voice for **short qualification**, trial check-ins, and onboarding nudges with variables that map to **CRM** (HubSpot/Salesforce-style) via HTTP tools—improving pipeline velocity without scaling SDR headcount linearly.

## Prerequisites

- CRM or CDP endpoints for create/update **non-sensitive** fields; never put secrets in workflow JSON.
- Clear opt-in for outbound; respect **TCPA**/local prospecting laws—this runbook does not replace legal review.

## Happy-path test (QA)

1. Install **Trial nurture & PQL voice qual** from **Template catalog**.
2. **Try (Web only)** or **Simulation → Start Web test** with sample `company_size` / `use_case` variables.
3. **Expected:** short qualification conversation completes; agent proposes a sensible next step (e.g. demo or email follow-up). CRM HTTP tools may be stubs in dev — conversation should still end without errors.

## Day 1 checklist

1. **Segments:** define who gets voice vs. email (e.g. high-intent trial only).
2. **Variables:** `company_size`, `use_case`, `next_step`—keep PII out of logs where possible.
3. **Outbound campaigns:** [recipes/outbound-campaign.md](../recipes/outbound-campaign.md) for batch patterns.
4. **Inbound demo line:** [recipes/inbound-pstn.md](../recipes/inbound-pstn.md).

## Integrations

- CRM HTTP tools; calendar links for booking; optional Slack notify via webhook node.

## Catalog graph variants (MK-01)

- **Simple (default install):** [b2b-saas-trial-nurture.json](../catalog/packaged-workflows/b2b-saas-trial-nurture.json).
- **Complex (demo / CS booking prompts):** [b2b-trial-booking-complex.json](../catalog/packaged-workflows/b2b-trial-booking-complex.json) — import via [import playbook](../catalog/import-packaged-workflow-json.md); wire **book_demo** or calendar HTTP tools using `{{scheduling_api_base_url}}` and pack variables; review calls under **Analytics**.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `b2b-saas-trial-nurture`. **Overview:** `/analytics?catalog_slug=b2b-saas-trial-nurture` for preset widgets when the board is still generic default. **Calls:** `/analytics/calls` — filter by **`outcome_key`**, **`tool_name`**, and CRM-related HTTP traces on call detail. Matrix: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md); GTM walkthrough: [http-api-analytics-redaction-gtm-demo.md](../catalog/recipes/http-api-analytics-redaction-gtm-demo.md).

## Measure

- Meetings booked, trial-to-paid conversion uplift (cohorted), call completion rate.
