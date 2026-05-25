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

## Proof in Analytics (MK-01)

**`catalog_slug`** = `hospitality-travel-concierge`. **Overview:** `/analytics?catalog_slug=hospitality-travel-concierge`. **Calls:** `/analytics/calls` — FAQ resolution and PMS tool success surface in **tool spans** / **`mapped_data`**. Matrix: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Booking modify** — **`booking_complex`** + **`modify_reservation`** HTTP tool + runbook happy path above.

See **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) for remaining items.

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Booking modify (dates / room)** | 24/7 self-serve changes | **Shipped** — **`booking_complex`** + **modify_reservation** |
| **Cancellation fee waiver / credit** | Guest recovery | **Roadmap** — policy engine + partner review |
| **Loyalty room upgrade offer** | Incremental revenue | **Roadmap** — CRS upsell HTTP tool |
