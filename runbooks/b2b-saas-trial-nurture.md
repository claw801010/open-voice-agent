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

## Booking-complex happy-path test (QA)

**Goal:** book a **demo** in **≤6 agent turns** after **`book_demo`** is wired.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765`.

1. Install **Trial nurture & PQL voice qual** with variant **`booking_complex`**.
2. **Customize**; set **`scheduling_api_base_url`** = `http://127.0.0.1:8765`, **`demo_duration_minutes`**, and **`crm_owner_email`** as needed.
3. HTTP tool **`book_demo`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `meeting_id` → `appointment.id`, `meeting_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach to agent; **Publish**.
5. **Web test** script: trial goals → request demo → provide timezone + time window → confirm booking.
6. **Expected:** **`book_demo`** appears in call detail tool spans with **`mapped_data`**; **`/analytics/calls?catalog_slug=b2b-saas-trial-nurture&catalog_variant_id=booking_complex&tool_name=book_demo`**.

## Renewal / QBR happy-path test (QA)

**Goal:** schedule a **QBR** in **≤6 agent turns** after **`book_qbr`** is wired (**renewal_complex** variant).

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765`.

1. Install **Trial nurture & PQL voice qual** with variant **`renewal_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"renewal_complex"`).
2. **Customize**; set **`scheduling_api_base_url`** = `http://127.0.0.1:8765`, **`crm_api_base_url`** = `http://127.0.0.1:8765` (optional second tool), **`account_health_tier`**, and **`crm_owner_email`** as needed.
3. HTTP tool **`book_qbr`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `meeting_id` → `appointment.id`, `meeting_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. *(Optional)* HTTP tool **`sync_crm_health`**: `POST {{crm_api_base_url}}/api/v1/accounts/health` with non-sensitive fields only.
5. Attach **`book_qbr`** to the **Renewal & QBR** agent; **Publish**.
6. **Web test** script: renewal goals → agree to QBR → provide timezone + window → confirm booking summary.
7. **Expected:** **`book_qbr`** in call detail with **`mapped_data`**; filter **`/analytics/calls?catalog_slug=b2b-saas-trial-nurture&catalog_variant_id=renewal_complex&tool_name=book_qbr`**.

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
- **Complex (renewal / QBR):** [b2b-trial-renewal-complex.json](../catalog/packaged-workflows/b2b-trial-renewal-complex.json) — variant **`renewal_complex`**; wire **book_qbr** (+ optional **sync_crm_health**); see **Renewal / QBR happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `b2b-saas-trial-nurture`. **Overview:** `/analytics?catalog_slug=b2b-saas-trial-nurture` for preset widgets when the board is still generic default. **Calls:** `/analytics/calls` — filter by **`outcome_key`**, **`tool_name`**, and CRM-related HTTP traces on call detail. Matrix: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md); GTM walkthrough: [http-api-analytics-redaction-gtm-demo.md](../catalog/recipes/http-api-analytics-redaction-gtm-demo.md).

## Measure

- Meetings booked, trial-to-paid conversion uplift (cohorted), call completion rate.

## High-revenue motions (roadmap)

**Shipped:** **Renewal / QBR expansion** — **`renewal_complex`** variant + **`book_qbr`** HTTP tool + runbook happy path above.

See **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) for remaining items.

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Renewal / QBR expansion** | LTV and expansion pipeline | **Shipped** — **`renewal_complex`** + **book_qbr** |
| **Trial → paid upgrade** | Conversion lift after voice PQL | **Roadmap** — CRM stage update HTTP after qual |
