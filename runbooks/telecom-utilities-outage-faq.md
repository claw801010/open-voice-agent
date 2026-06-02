# Runbook — Telecom / utilities: outage & billing FAQ

**Pack slug:** `telecom-utilities-outage-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Deflect repeat **outage status**, **plan compare (non-binding)**, and **payment redirect** calls with utility guardrails—scheduling field service callbacks without card capture on the call.

## Prerequisites

- Utility-approved scripts and disclosure copy (recording, not account servicing).
- Optional BSS/OSS HTTP tools (tokenized only; no full payment data in prompts).
- Legal / compliance sign-off before outbound or buyer-facing GTM ([PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md)).

## Happy-path test (QA)

1. Install **Outage & billing FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask an outage or billing redirect question and receive a coherent, script-aligned answer; agent offers escalation to {{support_phone}} or {{outage_status_portal_url}} when live tools are not wired.

## Booking-complex happy-path test (QA)

**Goal:** schedule a **field service callback** in **≤6 agent turns** after **`schedule_service_callback`** is wired.

**Prerequisites:** [All-in-one local scheduling](../catalog/recipes/local-scheduling-all-in-one.md) (`ENABLE_LOCAL_SCHEDULING`; install-from-catalog auto-sets `scheduling_api_base_url`).

1. Install **Outage & billing FAQ** with variant **`booking_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize**; confirm **`scheduling_api_base_url`** points at local scheduling (auto on install; or **Wire local calendar**); set **`utility_name`**, and **`default_service_area_code`** from pack defaults.
3. HTTP tool **`schedule_service_callback`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `callback_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach tool to the **Outage FAQ & service callback** agent; **Publish**.
5. **Web test** script: report service issue → request callback → give timezone + preferred window → confirm summary.
6. **Expected:** **`schedule_service_callback`** invoked; call detail shows **`mapped_data`**; filter **`/analytics/calls?catalog_slug=telecom-utilities-outage-faq&catalog_variant_id=booking_complex&tool_name=schedule_service_callback`**.

## Live outage status lookup happy-path test (QA)

**Goal:** return **tokenized outage status** in **≤6 agent turns** after **`lookup_outage_status`** is wired (**outage_status_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) and [ANALYTICS_REDACTION_MATRIX.md](../catalog/ANALYTICS_REDACTION_MATRIX.md) before buyer-facing GTM.

**Prerequisites:** [local integrations all-in-one](../catalog/recipes/local-integrations-all-in-one.md) (`ENABLE_LOCAL_INTEGRATIONS=true`; install auto-wires **`oss_api_base_url`**).

1. Install **Outage & billing FAQ** with variant **`outage_status_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"outage_status_complex"`).
2. **Customize**; confirm **`oss_api_base_url`** points at `{BACKEND}/api/v1/local-integrations` (or click **Wire local integrations** on the catalog guide card). Set **`utility_name`** and **`default_service_area_code`** from pack defaults.
3. HTTP tool **`lookup_outage_status`**: `POST {{oss_api_base_url}}/api/v1/outages/status`; **response_mapping** — `outage_id` → `appointment.id`, `restoration_eta` → `confirmation_code`, `status_code` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Outage FAQ & status lookup** agent; **Publish**.
5. **Web test** script: ask about outage in your area → provide service area hint → confirm summary when agent reads back tool result.
6. **Expected:** **`lookup_outage_status`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=telecom-utilities-outage-faq&catalog_variant_id=outage_status_complex&tool_name=lookup_outage_status`**.

## Payment redirect confirm happy-path test (QA)

**Goal:** submit a **tokenized payment redirect confirm** in **≤6 agent turns** after **`confirm_payment_redirect`** is wired (**payment_redirect_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) and [ANALYTICS_REDACTION_MATRIX.md](../catalog/ANALYTICS_REDACTION_MATRIX.md) before buyer-facing GTM.

**Prerequisites:** [local payments all-in-one](../catalog/recipes/local-payments-all-in-one.md) (`ENABLE_LOCAL_PAYMENTS=true`; install auto-wires **`billing_api_base_url`**).

1. Install **Outage & billing FAQ** with variant **`payment_redirect_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"payment_redirect_complex"`).
2. **Customize**; confirm **`billing_api_base_url`** points at `{BACKEND}/api/v1/local-payments` (or click **Wire local payments** on the catalog guide card). Set **`utility_name`** and **`payment_redirect_reason_code`** from pack defaults.
3. HTTP tool **`confirm_payment_redirect`**: `POST {{billing_api_base_url}}/api/v1/payments/redirect/confirm`; **response_mapping** — `redirect_id` → `appointment.id`, `portal_url` → `confirmation_code`, `expires_at` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Billing FAQ & payment redirect** agent; **Publish**.
5. **Web test** script: ask to pay bill → provide tokenized account hint → confirm summary when agent reads back tool result.
6. **Expected:** **`confirm_payment_redirect`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=telecom-utilities-outage-faq&catalog_variant_id=payment_redirect_complex&tool_name=confirm_payment_redirect`**.

## Day 1 checklist

1. **Scripts:** utility-approved outage and FAQ copy only; no payment card capture in prompts.
2. **Disclosures:** recording and life-safety escalation per compliance tags.
3. **Handoff:** field ops or billing queue when complexity exceeds script scope.
4. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for web; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.

## Integrations

- BSS/OSS outage feeds and field scheduling via HTTP tools; payment portal deep links in template variables.

## Catalog graph variants (MK-01)

- **Simple (default install):** [telecom-utilities-outage-faq.json](../catalog/packaged-workflows/telecom-utilities-outage-faq.json).
- **Complex (service callback):** [telecom-utilities-booking-complex.json](../catalog/packaged-workflows/telecom-utilities-booking-complex.json) — variant **`booking_complex`**; wire HTTP **schedule_service_callback**; see **Booking-complex happy-path test** above.
- **Complex (outage status):** [telecom-utilities-outage-status-complex.json](../catalog/packaged-workflows/telecom-utilities-outage-status-complex.json) — variant **`outage_status_complex`**; wire **lookup_outage_status**; see **Live outage status lookup happy-path test** above.
- **Complex (payment redirect):** [telecom-utilities-payment-redirect-complex.json](../catalog/packaged-workflows/telecom-utilities-payment-redirect-complex.json) — variant **`payment_redirect_complex`**; wire **confirm_payment_redirect**; see **Payment redirect confirm happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `telecom-utilities-outage-faq`. **Overview:** `/analytics?catalog_slug=telecom-utilities-outage-faq`. **Calls:** `/analytics/calls` — FAQ resolution and scheduling tool success surface in **tool spans** / **`mapped_data`** on call detail. HTTP field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Field service callback scheduling** — **`booking_complex`** + **`schedule_service_callback`**; **Live outage status lookup** — **`outage_status_complex`** + **`lookup_outage_status`**; **Payment redirect confirm** — **`payment_redirect_complex`** + **`confirm_payment_redirect`** (see happy-path sections above).

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Field service callback scheduling** | Self-serve outage follow-up | **Shipped** — **`booking_complex`** + **schedule_service_callback** |
| **Live outage status lookup** | Real-time ETAs from OSS/BSS | **Shipped** — **`outage_status_complex`** + **lookup_outage_status** |
| **Payment redirect confirm** | Safer billing handoff | **Shipped** — **`payment_redirect_complex`** + **confirm_payment_redirect** |

**Roadmap tail:** remaining items (if any) in **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) — empty when all motions above are shipped.
