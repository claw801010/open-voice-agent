# Runbook — Retail: WISMO & store policy FAQ

**Pack slug:** `retail-wismo-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Reduce **“where is my order”** and basic policy load using voice with optional **live order lookup** via HTTP tools. Keep prompts aligned with published return and shipping policies.

## Prerequisites

- OMS, Shopify-style API, or ticketing endpoint for order lookup (tokenized; no full card data in prompts).
- Workflow with agent + tools wired; webhook/QA nodes if you post-call analyze ([READMEPLANNING.md](../READMEPLANNING.md) retail row).

## Happy-path test (QA)

1. Install **WISMO & store policy FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask a policy/FAQ question and get a coherent answer; if order lookup tools are not configured, agent offers support handoff instead of inventing tracking data.

## Booking-complex happy-path test (QA)

**Goal:** reserve a pickup / service window in **≤6 agent turns** after **`reserve_pickup_slot`** is wired.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765`.

1. Install **WISMO & store policy FAQ** with variant **`booking_complex`** from the catalog.
2. **Customize**; set **`scheduling_api_base_url`** = `http://127.0.0.1:8765` and **`pickup_location_code`** / **`store_name`** from pack defaults.
3. HTTP tool **`reserve_pickup_slot`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; map at minimum **`confirmation_code`**, **`slot_start`** (from `appointment.slot.start`), **`appointment_id`** (from `appointment.id`) for analytics ([VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md)).
4. Attach tool to the agent; **Publish**.
5. **Web test** script: ask for in-store pickup window → give date/time preference → confirm when agent summarizes.
6. **Expected:** tool invoked once preferences are structured; **Analytics** call detail shows **`mapped_data`**; list filter **`catalog_variant_id=booking_complex`** and **`tool_name=reserve_pickup_slot`**.

## Paid upsell happy-path test (QA)

**Goal:** resolve a WISMO-style question, then attach a warranty/subscription add-on in **≤6 agent turns** after **`offer_warranty_addon`** is wired (**upsell_complex** variant).

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (accepts `POST /api/v1/offers/attach` with sample JSON).

1. Install **WISMO & store policy FAQ** with variant **`upsell_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"upsell_complex"`).
2. **Customize**; set **`product_api_base_url`** = `http://127.0.0.1:8765` and **`upsell_product_sku`** from pack defaults.
3. HTTP tool **`offer_warranty_addon`**: `POST {{product_api_base_url}}/api/v1/offers/attach`; **response_mapping** — `offer_id` → `appointment.id`, `confirmation_code` → `confirmation_code`, `slot_start` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **WISMO & upsell** agent; **Publish**.
5. **Web test** script: ask a generic order-status question → accept warranty offer when prompted → confirm enrollment summary.
6. **Expected:** **`offer_warranty_addon`** invoked after WISMO resolution; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=retail-wismo-faq&catalog_variant_id=upsell_complex&tool_name=offer_warranty_addon`**.

## Day 1 checklist

1. **Tool contracts:** define stable JSON fields (`order_id`, `status`) and timeouts.
2. **Fallback:** when lookup fails, offer email/support handoff—not invented tracking numbers.
3. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for site; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.
4. **Load test:** a few parallel calls to validate latency band in [catalog/vertical-packs.json](../catalog/vertical-packs.json).

## Integrations

- OMS / e-commerce APIs via HTTP tools; KB articles for static FAQ.

## Catalog graph variants (MK-01)

- **Simple (default install):** [retail-wismo-faq.json](../catalog/packaged-workflows/retail-wismo-faq.json).
- **Complex (pickup / service booking):** [retail-wismo-booking-complex.json](../catalog/packaged-workflows/retail-wismo-booking-complex.json) — import via [import playbook](../catalog/import-packaged-workflow-json.md); attach HTTP tools for slots + OMS when credentials exist; filter **Analytics** by `catalog_slug` and `tool_name`.
- **Complex (WISMO + upsell):** [retail-wismo-upsell-complex.json](../catalog/packaged-workflows/retail-wismo-upsell-complex.json) — variant **`upsell_complex`**; wire HTTP **offer_warranty_addon**; see **Paid upsell happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `retail-wismo-faq`. **Overview:** `/analytics?catalog_slug=retail-wismo-faq`. **Calls:** `/analytics/calls` — WISMO resolution and OMS tool success surface in **tool spans** / **`mapped_data`** on call detail. HTTP field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md). Roadmap: [ANALYTICS_VERTICAL_ROADMAP.md](../catalog/ANALYTICS_VERTICAL_ROADMAP.md).

## Measure

- Deflection from human agents, CSAT on resolved WISMO, tool error rate.

## High-revenue motions (roadmap)

**Shipped:** **Paid upsell (warranty / subscription)** — **`upsell_complex`** variant + **`offer_warranty_addon`** HTTP tool + runbook happy path above.

See **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) for remaining items.

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Paid upsell (warranty / subscription)** | ARR attach after WISMO resolution | **Shipped** — **`upsell_complex`** + **offer_warranty_addon** |
| **Collections / payment promise** | Write-off reduction | **Roadmap** — legal + [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before ship |
