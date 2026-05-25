# Runbook — Hospitality / travel: concierge & booking modify

**Pack slug:** `hospitality-travel-concierge`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Provide **24/7 concierge FAQ** and **reservation modify** handoffs for hotels and travel brands—containing tier-1 calls while keeping PMS/CRS changes behind tokenized HTTP tools.

## Prerequisites

- Published cancellation and amenity policy copy aligned with brand legal review.
- PMS or CRS HTTP endpoint for reservation modify (tokenized confirmation refs only).
- Optional embed or PSTN routing per property ([recipes/embed-widget.md](../recipes/embed-widget.md), [recipes/inbound-pstn.md](../recipes/inbound-pstn.md)).

## Happy-path test (QA)

1. Install **Travel concierge & booking FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** guest can ask a policy/amenity question and get a coherent answer; agent offers email handoff when modify tools are not configured.

## Booking-complex happy-path test (QA)

**Goal:** modify a reservation in **≤6 agent turns** after **`modify_reservation`** is wired.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765`.

1. Install **Travel concierge & booking FAQ** with variant **`booking_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize**; set **`pms_api_base_url`** = `http://127.0.0.1:8765`, **`property_name`**, **`confirmation_prefix`**, and **`default_room_type`** from pack defaults.
3. HTTP tool **`modify_reservation`**: `POST {{pms_api_base_url}}/api/v1/reservations/modify`; **response_mapping** — `reservation_id` → `appointment.id`, `new_check_in` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach tool to the **Concierge & booking modify** agent; **Publish**.
5. **Web test** script: ask to move check-in date → provide confirmation ref + new dates → confirm summary when agent reads back tool result.
6. **Expected:** **`modify_reservation`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=hospitality-travel-concierge&catalog_variant_id=booking_complex&tool_name=modify_reservation`**.

## Cancellation fee waiver happy-path test (QA)

**Goal:** apply a **documented cancellation fee waiver or credit** in **≤6 agent turns** after **`apply_cancellation_waiver`** is wired (**waiver_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (accepts `POST /api/v1/cancellations/waiver` with sample JSON).

1. Install **Travel concierge & booking FAQ** with variant **`waiver_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"waiver_complex"`).
2. **Customize**; set **`policy_api_base_url`** = `http://127.0.0.1:8765`, **`waiver_policy_code`**, and **`confirmation_prefix`** from pack defaults.
3. HTTP tool **`apply_cancellation_waiver`**: `POST {{policy_api_base_url}}/api/v1/cancellations/waiver`; **response_mapping** — `waiver_id` → `appointment.id`, `confirmation_code` → `confirmation_code`, `credit_amount` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Concierge & waiver** agent; **Publish**.
5. **Web test** script: ask about cancellation fee → provide confirmation ref + reason → confirm waiver reference when agent summarizes.
6. **Expected:** **`apply_cancellation_waiver`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=hospitality-travel-concierge&catalog_variant_id=waiver_complex&tool_name=apply_cancellation_waiver`**.

## Loyalty room upgrade happy-path test (QA)

**Goal:** offer and attach a **loyalty room upgrade** in **≤6 agent turns** after **`offer_room_upgrade`** is wired (**upsell_complex** variant).

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (accepts `POST /api/v1/offers/attach` with sample JSON).

1. Install **Travel concierge & booking FAQ** with variant **`upsell_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"upsell_complex"`).
2. **Customize**; set **`crs_api_base_url`** = `http://127.0.0.1:8765`, **`upgrade_room_type`**, and **`confirmation_prefix`** from pack defaults.
3. HTTP tool **`offer_room_upgrade`**: `POST {{crs_api_base_url}}/api/v1/offers/attach`; **response_mapping** — `offer_id` → `appointment.id`, `confirmation_code` → `confirmation_code`, `upgrade_effective` → `appointment.slot.start`.
4. Attach tool to the **Concierge & upsell** agent; **Publish**.
5. **Web test** script: ask an amenity question → accept room upgrade when offered → confirm reference when agent summarizes.
6. **Expected:** **`offer_room_upgrade`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=hospitality-travel-concierge&catalog_variant_id=upsell_complex&tool_name=offer_room_upgrade`**.

## Day 1 checklist

1. **Policy copy:** cancellation and fee language matches published guest-facing terms.
2. **PMS contract:** stable JSON fields for confirmation ref, dates, room type; timeouts documented.
3. **Fallback:** when modify fails, offer human front desk or email — never invent confirmation numbers.
4. **Measure:** deflection rate, modify success rate, average handle time.

## Integrations

- PMS / CRS via HTTP tools; KB for static FAQ.

## Catalog graph variants (MK-01)

- **Simple (default install):** [hospitality-travel-concierge.json](../catalog/packaged-workflows/hospitality-travel-concierge.json).
- **Complex (booking modify):** [hospitality-travel-booking-complex.json](../catalog/packaged-workflows/hospitality-travel-booking-complex.json) — variant **`booking_complex`**; wire HTTP **modify_reservation**; see **Booking-complex happy-path test** above.
- **Complex (cancellation waiver):** [hospitality-travel-waiver-complex.json](../catalog/packaged-workflows/hospitality-travel-waiver-complex.json) — variant **`waiver_complex`**; wire **apply_cancellation_waiver**; see **Cancellation fee waiver happy-path test** above.
- **Complex (loyalty room upgrade):** [hospitality-travel-upsell-complex.json](../catalog/packaged-workflows/hospitality-travel-upsell-complex.json) — variant **`upsell_complex`**; wire **offer_room_upgrade**; see **Loyalty room upgrade happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `hospitality-travel-concierge`. **Overview:** `/analytics?catalog_slug=hospitality-travel-concierge`. **Calls:** `/analytics/calls` — FAQ resolution and PMS tool success surface in **tool spans** / **`mapped_data`**. Matrix: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Booking modify** — **`booking_complex`** + **`modify_reservation`**; **Cancellation fee waiver / credit** — **`waiver_complex`** + **`apply_cancellation_waiver`**; **Loyalty room upgrade** — **`upsell_complex`** + **`offer_room_upgrade`** (see happy-path sections above).

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Booking modify (dates / room)** | 24/7 self-serve changes | **Shipped** — **`booking_complex`** + **modify_reservation** |
| **Cancellation fee waiver / credit** | Guest recovery | **Shipped** — **`waiver_complex`** + **apply_cancellation_waiver** |
| **Loyalty room upgrade offer** | Incremental revenue | **Shipped** — **`upsell_complex`** + **offer_room_upgrade** |

**Roadmap tail:** remaining items (if any) in **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) — empty when all motions above are shipped.
