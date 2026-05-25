# Runbook — Insurance: FNOL guidance & policy FAQ

**Pack slug:** `insurance-fnol-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Contain tier-1 **FNOL (first notice of loss)** and **policy FAQ** calls with scripted guardrails—routing hot leads and scheduling adjuster callbacks without replacing licensed adjusters or legal review.

## Prerequisites

- Carrier-approved FNOL scripts and disclosure copy (recording, not legal advice).
- Optional claims core or CRM HTTP tools (tokenized; no full card data in prompts).
- Legal / compliance sign-off before outbound or buyer-facing GTM ([PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md)).

## Happy-path test (QA)

1. Install **FNOL guidance & policy FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask a policy-style question and receive a coherent, script-aligned answer; agent offers escalation to {{support_phone}} or {{claims_portal_url}} when status lookup is not wired.

## Booking-complex happy-path test (QA)

**Goal:** schedule an **adjuster callback** in **≤6 agent turns** after **`schedule_adjuster_callback`** is wired.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765`.

1. Install **FNOL guidance & policy FAQ** with variant **`booking_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize**; set **`scheduling_api_base_url`** = `http://127.0.0.1:8765`, **`carrier_name`**, **`line_of_business`**, and **`preferred_callback_window_hours`** from pack defaults.
3. HTTP tool **`schedule_adjuster_callback`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `callback_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach tool to the **FNOL & adjuster callback** agent; **Publish**.
5. **Web test** script: brief FNOL context → request adjuster callback → give timezone + preferred window → confirm summary.
6. **Expected:** **`schedule_adjuster_callback`** invoked; call detail shows **`mapped_data`**; filter **`/analytics/calls?catalog_slug=insurance-fnol-faq&catalog_variant_id=booking_complex&tool_name=schedule_adjuster_callback`**.

## Quote intent happy-path test (QA)

**Goal:** capture **quote-ready intent** in **≤6 agent turns** after **`capture_quote_intent`** is wired (**quote_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (accepts `POST /api/v1/quotes/intent` with sample JSON).

1. Install **FNOL guidance & policy FAQ** with variant **`quote_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"quote_complex"`).
2. **Customize**; set **`quoting_api_base_url`** = `http://127.0.0.1:8765`, **`quote_product_code`**, and **`line_of_business`** from pack defaults.
3. HTTP tool **`capture_quote_intent`**: `POST {{quoting_api_base_url}}/api/v1/quotes/intent`; **response_mapping** — `intent_id` → `appointment.id`, `confirmation_code` → `confirmation_code`, `follow_up_by` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **FNOL & quote intent** agent; **Publish**.
5. **Web test** script: ask about new auto coverage → express quote-ready intent → confirm reference when agent summarizes handoff to licensed agent.
6. **Expected:** **`capture_quote_intent`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=insurance-fnol-faq&catalog_variant_id=quote_complex&tool_name=capture_quote_intent`**.

## Claims status lookup happy-path test (QA)

**Goal:** return **tokenized claim status** in **≤6 agent turns** after **`lookup_claim_status`** is wired (**claims_lookup_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) and [ANALYTICS_REDACTION_MATRIX.md](../catalog/ANALYTICS_REDACTION_MATRIX.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (accepts `POST /api/v1/claims/status` with sample JSON).

1. Install **FNOL guidance & policy FAQ** with variant **`claims_lookup_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"claims_lookup_complex"`).
2. **Customize**; set **`claims_api_base_url`** = `http://127.0.0.1:8765`, **`carrier_name`**, and **`line_of_business`** from pack defaults.
3. HTTP tool **`lookup_claim_status`**: `POST {{claims_api_base_url}}/api/v1/claims/status`; **response_mapping** — `claim_id` → `appointment.id`, `status_code` → `confirmation_code`, `last_updated` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **FNOL & claims status** agent; **Publish**.
5. **Web test** script: ask for claim status → provide tokenized claim reference → confirm summary when agent reads back tool result.
6. **Expected:** **`lookup_claim_status`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=insurance-fnol-faq&catalog_variant_id=claims_lookup_complex&tool_name=lookup_claim_status`**.

## Day 1 checklist

1. **Scripts:** carrier-approved FNOL and FAQ copy only; no coverage determinations on the call.
2. **Disclosures:** recording and “not legal advice” per compliance tags.
3. **Handoff:** licensed adjuster queue or portal when complexity exceeds script scope.
4. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for web; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.

## Integrations

- Claims core / CRM via HTTP tools; document portal deep links in template variables.

## Catalog graph variants (MK-01)

- **Simple (default install):** [insurance-fnol-faq.json](../catalog/packaged-workflows/insurance-fnol-faq.json).
- **Complex (adjuster callback):** [insurance-fnol-booking-complex.json](../catalog/packaged-workflows/insurance-fnol-booking-complex.json) — variant **`booking_complex`**; wire HTTP **schedule_adjuster_callback**; see **Booking-complex happy-path test** above.
- **Complex (quote intent):** [insurance-fnol-quote-complex.json](../catalog/packaged-workflows/insurance-fnol-quote-complex.json) — variant **`quote_complex`**; wire **capture_quote_intent**; see **Quote intent happy-path test** above.
- **Complex (claims status lookup):** [insurance-fnol-claims-lookup-complex.json](../catalog/packaged-workflows/insurance-fnol-claims-lookup-complex.json) — variant **`claims_lookup_complex`**; wire **lookup_claim_status**; see **Claims status lookup happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `insurance-fnol-faq`. **Overview:** `/analytics?catalog_slug=insurance-fnol-faq`. **Calls:** `/analytics/calls` — FNOL resolution and scheduling tool success surface in **tool spans** / **`mapped_data`** on call detail. HTTP field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Adjuster callback scheduling** — **`booking_complex`** + **`schedule_adjuster_callback`**; **Quote intent qualification** — **`quote_complex`** + **`capture_quote_intent`**; **Live claims status lookup** — **`claims_lookup_complex`** + **`lookup_claim_status`** (see happy-path sections above; [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before GTM).

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Adjuster callback scheduling** | Faster FNOL → inspection path | **Shipped** — **`booking_complex`** + **schedule_adjuster_callback** |
| **Quote intent qualification** | Hot-lead routing | **Shipped** — **`quote_complex`** + **capture_quote_intent** |
| **Live claims status lookup** | Contain tier-1 status calls | **Shipped** — **`claims_lookup_complex`** + **lookup_claim_status** (+ PII / partner review before GTM) |

**Roadmap tail:** remaining items (if any) in **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) — empty when all motions above are shipped.
