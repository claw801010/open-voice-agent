# Runbook — Financial services: card & branch banking FAQ

**Pack slug:** `financial-services-banking-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Contain tier-1 **card lost/stolen**, **non-PCI balance/payment redirect**, and **branch FAQ** calls with fraud guardrails—scheduling branch appointments without collecting full PAN or credentials on the call.

## Prerequisites

- Institution-approved scripts and disclosure copy (recording, not account servicing).
- Optional core banking HTTP tools (tokenized only; no full card data in prompts).
- Legal / compliance sign-off before outbound or buyer-facing GTM ([PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md)).

## Happy-path test (QA)

1. Install **Card & branch banking FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask a branch-hours or card-safety question and receive a coherent, script-aligned answer; agent offers escalation to {{support_phone}} or {{card_block_portal_url}} when live tools are not wired.

## Booking-complex happy-path test (QA)

**Goal:** schedule a **branch appointment** in **≤6 agent turns** after **`schedule_branch_appointment`** is wired.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765`.

1. Install **Card & branch banking FAQ** with variant **`booking_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize**; set **`scheduling_api_base_url`** = `http://127.0.0.1:8765`, **`institution_name`**, and **`preferred_branch_code`** from pack defaults.
3. HTTP tool **`schedule_branch_appointment`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `appointment_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach tool to the **Banking FAQ & branch booking** agent; **Publish**.
5. **Web test** script: ask about branch services → request appointment → give timezone + preferred window → confirm summary.
6. **Expected:** **`schedule_branch_appointment`** invoked; call detail shows **`mapped_data`**; filter **`/analytics/calls?catalog_slug=financial-services-banking-faq&catalog_variant_id=booking_complex&tool_name=schedule_branch_appointment`**.

## Tokenized balance lookup happy-path test (QA)

**Goal:** return **tokenized account balance** in **≤6 agent turns** after **`lookup_account_balance`** is wired (**balance_lookup_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) and [ANALYTICS_REDACTION_MATRIX.md](../catalog/ANALYTICS_REDACTION_MATRIX.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (accepts `POST /api/v1/accounts/balance` with sample JSON).

1. Install **Card & branch banking FAQ** with variant **`balance_lookup_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"balance_lookup_complex"`).
2. **Customize**; set **`banking_api_base_url`** = `http://127.0.0.1:8765`, **`institution_name`**, and **`support_phone`** from pack defaults.
3. HTTP tool **`lookup_account_balance`**: `POST {{banking_api_base_url}}/api/v1/accounts/balance`; **response_mapping** — `account_id` → `appointment.id`, `balance_available` → `confirmation_code`, `as_of_date` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Banking FAQ & balance lookup** agent; **Publish**.
5. **Web test** script: ask for account balance → provide tokenized account reference → confirm summary when agent reads back tool result.
6. **Expected:** **`lookup_account_balance`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=financial-services-banking-faq&catalog_variant_id=balance_lookup_complex&tool_name=lookup_account_balance`**.

## Card block / fraud report happy-path test (QA)

**Goal:** submit a **tokenized card block** in **≤6 agent turns** after **`report_card_lost_stolen`** is wired (**card_block_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) and [ANALYTICS_REDACTION_MATRIX.md](../catalog/ANALYTICS_REDACTION_MATRIX.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (accepts `POST /api/v1/cards/block` with sample JSON).

1. Install **Card & branch banking FAQ** with variant **`card_block_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"card_block_complex"`).
2. **Customize**; set **`cards_api_base_url`** = `http://127.0.0.1:8765`, **`institution_name`**, and **`card_block_reason_code`** from pack defaults.
3. HTTP tool **`report_card_lost_stolen`**: `POST {{cards_api_base_url}}/api/v1/cards/block`; **response_mapping** — `block_id` → `appointment.id`, `status_code` → `confirmation_code`, `blocked_at` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Banking FAQ & card block** agent; **Publish**.
5. **Web test** script: report lost card → provide tokenized last-four reference → confirm summary when agent reads back tool result.
6. **Expected:** **`report_card_lost_stolen`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=financial-services-banking-faq&catalog_variant_id=card_block_complex&tool_name=report_card_lost_stolen`**.

## Day 1 checklist

1. **Scripts:** institution-approved card and FAQ copy only; no balance reads without tokenized lookup tool.
2. **Disclosures:** recording and fraud-awareness per compliance tags.
3. **Handoff:** fraud desk or branch queue when complexity exceeds script scope.
4. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for web; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.

## Integrations

- Core banking / branch scheduling via HTTP tools; branch locator deep links in template variables.

## Catalog graph variants (MK-01)

- **Simple (default install):** [financial-services-banking-faq.json](../catalog/packaged-workflows/financial-services-banking-faq.json).
- **Complex (branch appointment):** [financial-services-booking-complex.json](../catalog/packaged-workflows/financial-services-booking-complex.json) — variant **`booking_complex`**; wire HTTP **schedule_branch_appointment**; see **Booking-complex happy-path test** above.
- **Complex (balance lookup):** [financial-services-balance-lookup-complex.json](../catalog/packaged-workflows/financial-services-balance-lookup-complex.json) — variant **`balance_lookup_complex`**; wire **lookup_account_balance**; see **Tokenized balance lookup happy-path test** above.
- **Complex (card block):** [financial-services-card-block-complex.json](../catalog/packaged-workflows/financial-services-card-block-complex.json) — variant **`card_block_complex`**; wire **report_card_lost_stolen**; see **Card block / fraud report happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `financial-services-banking-faq`. **Overview:** `/analytics?catalog_slug=financial-services-banking-faq`. **Calls:** `/analytics/calls` — FAQ resolution and scheduling tool success surface in **tool spans** / **`mapped_data`** on call detail. HTTP field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Branch appointment scheduling** — **`booking_complex`** + **`schedule_branch_appointment`**; **Tokenized balance lookup** — **`balance_lookup_complex`** + **`lookup_account_balance`**; **Card block / fraud report** — **`card_block_complex`** + **`report_card_lost_stolen`** (see happy-path sections above).

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Branch appointment scheduling** | Self-serve branch visits | **Shipped** — **`booking_complex`** + **schedule_branch_appointment** |
| **Tokenized balance lookup** | Tier-1 containment after verify | **Shipped** — **`balance_lookup_complex`** + **lookup_account_balance** |
| **Card block / fraud report API** | Faster card safety resolution | **Shipped** — **`card_block_complex`** + **report_card_lost_stolen** |

**Roadmap tail:** remaining items (if any) in **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) — empty when all motions above are shipped.
