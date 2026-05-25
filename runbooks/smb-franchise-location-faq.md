# Runbook — SMB / franchises: multi-location FAQ & lead callback

**Pack slug:** `smb-franchise-location-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

One template × many locations: contain tier-1 **multi-site FAQ** and **lead callback scheduling** for SMB and franchise operators—without building per-store voice flows from scratch.

## Prerequisites

- Brand-approved FAQ copy and location directory links.
- Optional calendar or CRM HTTP tools for callback scheduling.
- Partner / ops sign-off before buyer-facing GTM ([PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md)).

## Happy-path test (QA)

1. Install **Multi-location FAQ & lead callback** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask a hours-or-services question and receive a coherent, brand-aligned answer; agent offers escalation to {{support_phone}} or {{location_directory_url}} when live routing tools are not wired.

## Booking-complex happy-path test (QA)

**Goal:** schedule a **lead callback** in **≤6 agent turns** after **`schedule_lead_callback`** is wired.

**Prerequisites:** [All-in-one local scheduling](../catalog/recipes/local-scheduling-all-in-one.md) (`ENABLE_LOCAL_SCHEDULING`; install-from-catalog auto-sets `scheduling_api_base_url`). Optional: [booking stub](../catalog/recipes/booking-scheduling-stub-local.md) on `:8765`.

1. Install **Multi-location FAQ & lead callback** with variant **`booking_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize**; confirm **`scheduling_api_base_url`** points at local scheduling (auto on install; or **Wire local calendar**); set **`brand_name`**, **`default_location_code`**, and **`preferred_callback_window_hours`** from pack defaults.
3. HTTP tool **`schedule_lead_callback`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `callback_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach tool to the **Location FAQ & lead callback** agent; **Publish**.
5. **Web test** script: ask about a service → request callback → give timezone + preferred window → confirm summary.
6. **Expected:** **`schedule_lead_callback`** invoked; call detail shows **`mapped_data`**; filter **`/analytics/calls?catalog_slug=smb-franchise-location-faq&catalog_variant_id=booking_complex&tool_name=schedule_lead_callback`**.

## Talk-to-location router happy-path test (QA)

**Goal:** resolve **store routing** in **≤6 agent turns** after **`route_call_to_location`** is wired (**location_router_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` for static fixture JSON (accepts `POST /api/v1/locations/route` with sample JSON).

1. Install **Multi-location FAQ & lead callback** with variant **`location_router_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"location_router_complex"`).
2. **Customize**; set **`locations_api_base_url`** = `http://127.0.0.1:8765`, **`brand_name`**, and **`routing_policy_code`** from pack defaults.
3. HTTP tool **`route_call_to_location`**: `POST {{locations_api_base_url}}/api/v1/locations/route`; **response_mapping** — `route_id` → `appointment.id`, `target_location_code` → `confirmation_code`, `transfer_extension` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Location FAQ & router** agent; **Publish**.
5. **Web test** script: ask to speak with a nearby store → give city or ZIP → confirm summary when agent reads back routing result.
6. **Expected:** **`route_call_to_location`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=smb-franchise-location-faq&catalog_variant_id=location_router_complex&tool_name=route_call_to_location`**.

## CRM lead capture happy-path test (QA)

**Goal:** capture **sales or service lead intent** in **≤6 agent turns** after **`capture_lead_intent`** is wired (**lead_capture_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` for static fixture JSON (accepts `POST /api/v1/leads/intent` with sample JSON).

1. Install **Multi-location FAQ & lead callback** with variant **`lead_capture_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"lead_capture_complex"`).
2. **Customize**; set **`crm_api_base_url`** = `http://127.0.0.1:8765`, **`crm_lead_source_code`**, and **`brand_name`** from pack defaults.
3. HTTP tool **`capture_lead_intent`**: `POST {{crm_api_base_url}}/api/v1/leads/intent`; **response_mapping** — `intent_id` → `appointment.id`, `confirmation_code` → `confirmation_code`, `follow_up_by` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Location FAQ & lead capture** agent; **Publish**.
5. **Web test** script: ask about a service → express interest in a quote or visit → confirm reference when agent summarizes CRM handoff.
6. **Expected:** **`capture_lead_intent`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=smb-franchise-location-faq&catalog_variant_id=lead_capture_complex&tool_name=capture_lead_intent`**.

## Day 1 checklist

1. **Copy:** brand FAQ and location directory URLs match published site content.
2. **Locations:** `default_location_code` and directory link tested for top markets.
3. **Fallback:** when scheduling fails, offer human callback queue — never invent confirmation numbers.
4. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for web; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.

## Integrations

- Calendar / CRM via HTTP tools; Sheets or directory APIs for location metadata.

## Catalog graph variants (MK-01)

- **Simple (default install):** [smb-franchise-location-faq.json](../catalog/packaged-workflows/smb-franchise-location-faq.json).
- **Complex (lead callback):** [smb-franchise-booking-complex.json](../catalog/packaged-workflows/smb-franchise-booking-complex.json) — variant **`booking_complex`**; wire HTTP **schedule_lead_callback**; see **Booking-complex happy-path test** above.
- **Complex (location router):** [smb-franchise-location-router-complex.json](../catalog/packaged-workflows/smb-franchise-location-router-complex.json) — variant **`location_router_complex`**; wire **route_call_to_location**; see **Talk-to-location router happy-path test** above.
- **Complex (CRM lead capture):** [smb-franchise-lead-capture-complex.json](../catalog/packaged-workflows/smb-franchise-lead-capture-complex.json) — variant **`lead_capture_complex`**; wire **capture_lead_intent**; see **CRM lead capture happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `smb-franchise-location-faq`. **Overview:** `/analytics?catalog_slug=smb-franchise-location-faq`. **Calls:** `/analytics/calls` — FAQ resolution and scheduling tool success surface in **tool spans** / **`mapped_data`**. Matrix: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Lead callback scheduling** — **`booking_complex`** + **`schedule_lead_callback`**; **Talk-to-location router** — **`location_router_complex`** + **`route_call_to_location`**; **CRM lead capture** — **`lead_capture_complex`** + **`capture_lead_intent`** (see happy-path sections above).

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Lead callback scheduling** | Pipeline velocity per location | **Shipped** — **`booking_complex`** + **schedule_lead_callback** |
| **Talk-to-location router** | Right-site deflection | **Shipped** — **`location_router_complex`** + **route_call_to_location** |
| **CRM lead capture** | One template × many stores | **Shipped** — **`lead_capture_complex`** + **capture_lead_intent** |

**Roadmap tail:** remaining items (if any) in **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) — empty when all motions above are shipped.
