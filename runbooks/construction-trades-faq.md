# Runbook — Construction / trades FAQ & site visits

**Pack slug:** `construction-trades-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Licensed contractor voice template — tier-1 voice FAQ and scheduling for local-service buyers. Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before external GTM.

## Prerequisites

- Brand-approved FAQ copy and service menu.
- Optional local scheduling / CRM HTTP tools ([local-scheduling-all-in-one.md](../catalog/recipes/local-scheduling-all-in-one.md), [local-integrations-all-in-one.md](../catalog/recipes/local-integrations-all-in-one.md)).

## Happy-path test (QA)

1. Install **Construction / trades FAQ & site visits** from **Template catalog**.
2. **Try (Web only)** with defaults.
3. **Expected:** caller receives coherent FAQ answers; agent offers escalation to {{support_phone}} when needed.

## Booking-complex happy-path test (QA)

**Goal:** schedule an **on-site walkthrough**

**Prerequisites:** `ENABLE_LOCAL_SCHEDULING`; install auto-sets `scheduling_api_base_url`.

1. Install with variant **`booking_complex`**.
2. **Customize**; confirm **`scheduling_api_base_url`** ( **Wire local calendar** ).
3. HTTP tool **`schedule_site_visit`**: `POST {{scheduling_api_base_url}}/api/v1/appointments` (or `/book_slot` for salon).
4. Attach tool; **Publish**; **Web test** through booking script.
5. **Expected:** **`schedule_site_visit`** invoked; filter **`/analytics/calls?catalog_slug=construction-trades-faq&catalog_variant_id=booking_complex&tool_name=schedule_site_visit`**.


## Project estimate intake happy-path test (QA)

**Goal:** capture **estimate / bid intent** in ≤6 turns with **`capture_project_intent`** (**estimate_complex**).

1. Install with **`estimate_complex`**.
2. Set **`crm_api_base_url`** ( **Wire local integrations** ).
3. HTTP **`capture_project_intent`**: `POST {{crm_api_base_url}}/api/v1/leads/intent`.
4. **Expected:** tool span on call detail; filter `estimate_complex` + `capture_project_intent`.


## Day 1 checklist

1. FAQ copy matches website.
2. No firm price quotes without site visit (trades) / policy-safe ranges only.
3. Recording disclosure on PSTN.

## Catalog graph variants (MK-01)

See `catalog/packaged-workflows/` for simple and complex JSON graphs.

## Proof in Analytics (MK-01)

Filter **`catalog_slug=construction-trades-faq`** after install; use **Analytics proof** on marketplace card when seeded.

## High-revenue motions (roadmap)

**Shipped:** see happy-path sections above. **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) is empty for this pack — all listed motions ship in catalog variants.

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Primary complex variant** | Buyer demo default | **Shipped** — see booking / quote / intake sections |
