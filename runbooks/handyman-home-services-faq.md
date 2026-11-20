# Runbook — Handyman / home services FAQ

**Pack slug:** `handyman-home-services-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Owner-operator handyman template — tier-1 voice FAQ and scheduling for local-service buyers. Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before external GTM.

## Prerequisites

- Brand-approved FAQ copy and service menu.
- Optional local scheduling / CRM HTTP tools ([local-scheduling-all-in-one.md](../catalog/recipes/local-scheduling-all-in-one.md), [local-integrations-all-in-one.md](../catalog/recipes/local-integrations-all-in-one.md)).

## Happy-path test (QA)

1. Install **Handyman / home services FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults.
3. **Expected:** caller receives coherent FAQ answers; agent offers escalation to {{support_phone}} when needed.

## Booking-complex happy-path test (QA)

**Goal:** book a **home service visit**

**Prerequisites:** `ENABLE_LOCAL_SCHEDULING`; install auto-sets `scheduling_api_base_url`.

1. Install with variant **`booking_complex`**.
2. **Customize**; confirm **`scheduling_api_base_url`** ( **Wire local calendar** ).
3. HTTP tool **`schedule_home_service`**: `POST {{scheduling_api_base_url}}/api/v1/appointments` (or `/book_slot` for salon).
4. Attach tool; **Publish**; **Web test** through booking script.
5. **Expected:** **`schedule_home_service`** invoked; filter **`/analytics/calls?catalog_slug=handyman-home-services-faq&catalog_variant_id=booking_complex&tool_name=schedule_home_service`**.


## Quote intent happy-path test (QA)

**Goal:** capture **service quote intent** with **`capture_quote_intent`** (**quote_complex**).

1. Install with **`quote_complex`**.
2. Set **`quoting_api_base_url`** (local integrations or quotes stub).
3. HTTP **`capture_quote_intent`**: `POST {{quoting_api_base_url}}/api/v1/quotes/intent`.
4. **Expected:** filter `quote_complex` + `capture_quote_intent`.


## Day 1 checklist

1. FAQ copy matches website.
2. No firm price quotes without site visit (trades) / policy-safe ranges only.
3. Recording disclosure on PSTN.

## Catalog graph variants (MK-01)

See `catalog/packaged-workflows/` for simple and complex JSON graphs.

## Proof in Analytics (MK-01)

Filter **`catalog_slug=handyman-home-services-faq`** after install; use **Analytics proof** on marketplace card when seeded.

## High-revenue motions (roadmap)

**Shipped:** see happy-path sections above. **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) is empty for this pack — all listed motions ship in catalog variants.

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Primary complex variant** | Buyer demo default | **Shipped** — see booking / quote / intake sections |
