# Runbook — B2B SaaS: trial nurture & PQL voice qual

**Pack slug:** `b2b-saas-trial-nurture`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Use voice for **short qualification**, trial check-ins, and onboarding nudges with variables that map to **CRM** (HubSpot/Salesforce-style) via HTTP tools—improving pipeline velocity without scaling SDR headcount linearly.

## Prerequisites

- CRM or CDP endpoints for create/update **non-sensitive** fields; never put secrets in workflow JSON.
- Clear opt-in for outbound; respect **TCPA**/local prospecting laws—this runbook does not replace legal review.

## Day 1 checklist

1. **Segments:** define who gets voice vs. email (e.g. high-intent trial only).
2. **Variables:** `company_size`, `use_case`, `next_step`—keep PII out of logs where possible.
3. **Outbound campaigns:** [recipes/outbound-campaign.md](../recipes/outbound-campaign.md) for batch patterns.
4. **Inbound demo line:** [recipes/inbound-pstn.md](../recipes/inbound-pstn.md).

## Integrations

- CRM HTTP tools; calendar links for booking; optional Slack notify via webhook node.

## Measure

- Meetings booked, trial-to-paid conversion uplift (cohorted), call completion rate.
