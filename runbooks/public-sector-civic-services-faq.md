# Runbook — Public sector: civic services & permits FAQ

**Pack slug:** `public-sector-civic-services-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Deflect **office hours**, **permit and licensing FAQ**, and **department routing** calls with public-sector guardrails—scheduling case-worker callbacks without collecting SSN or payment data on the call.

## Prerequisites

- Agency-approved scripts and disclosure copy (recording, not case adjudication).
- Optional records HTTP tools (tokenized only; no full PII in prompts).
- Legal / compliance sign-off before outbound or buyer-facing GTM ([PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md)).

## Happy-path test (QA)

1. Install **Civic services & permits FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask an office-hours or permit FAQ question and receive a coherent, script-aligned answer; agent offers escalation to {{support_phone}} or {{services_directory_url}} when live tools are not wired.

## Booking-complex happy-path test (QA)

**Goal:** schedule a **case worker callback** in **≤6 agent turns** after **`schedule_civic_callback`** is wired.

**Prerequisites:** [All-in-one local scheduling](../catalog/recipes/local-scheduling-all-in-one.md) (`ENABLE_LOCAL_SCHEDULING`; install-from-catalog auto-sets `scheduling_api_base_url`).

1. Install **Civic services & permits FAQ** with variant **`booking_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize**; confirm **`scheduling_api_base_url`** points at local scheduling (auto on install; or **Wire local calendar**); set **`agency_name`**, and **`default_department_code`** from pack defaults.
3. HTTP tool **`schedule_civic_callback`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `callback_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach tool to the **Civic FAQ & case callback** agent; **Publish**.
5. **Web test** script: ask about permit status → request callback → give timezone + preferred window → confirm summary.
6. **Expected:** **`schedule_civic_callback`** invoked; call detail shows **`mapped_data`**; filter **`/analytics/calls?catalog_slug=public-sector-civic-services-faq&catalog_variant_id=booking_complex&tool_name=schedule_civic_callback`**.

## Permit status lookup happy-path test (QA)

**Goal:** return **tokenized permit status** in **≤6 agent turns** after **`lookup_permit_status`** is wired (**permit_status_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) and [ANALYTICS_REDACTION_MATRIX.md](../catalog/ANALYTICS_REDACTION_MATRIX.md) before buyer-facing GTM.

**Prerequisites:** [local integrations all-in-one](../catalog/recipes/local-integrations-all-in-one.md) (`ENABLE_LOCAL_INTEGRATIONS=true`; install auto-wires **`records_api_base_url`**).

1. Install **Civic services & permits FAQ** with variant **`permit_status_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"permit_status_complex"`).
2. **Customize**; confirm **`records_api_base_url`** points at `{BACKEND}/api/v1/local-integrations` (or **Wire local integrations**). Set **`agency_name`** and **`default_department_code`** from pack defaults.
3. HTTP tool **`lookup_permit_status`**: `POST {{records_api_base_url}}/api/v1/permits/status`; **response_mapping** — `permit_id` → `appointment.id`, `status_code` → `confirmation_code`, `last_updated` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Civic FAQ & permit lookup** agent; **Publish**.
5. **Web test** script: ask about permit status → provide tokenized application reference → confirm summary when agent reads back tool result.
6. **Expected:** **`lookup_permit_status`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=public-sector-civic-services-faq&catalog_variant_id=permit_status_complex&tool_name=lookup_permit_status`**.

## Multilingual routing happy-path test (QA)

**Goal:** submit a **language routing request** in **≤6 agent turns** after **`route_by_language`** is wired (**language_router_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) before buyer-facing GTM.

**Prerequisites:** [local integrations all-in-one](../catalog/recipes/local-integrations-all-in-one.md) (`ENABLE_LOCAL_INTEGRATIONS=true`; install auto-wires **`routing_api_base_url`**).

1. Install **Civic services & permits FAQ** with variant **`language_router_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"language_router_complex"`).
2. **Customize**; confirm **`routing_api_base_url`** points at `{BACKEND}/api/v1/local-integrations` (or **Wire local integrations**). Set **`agency_name`** and **`language_routing_policy_code`** from pack defaults.
3. HTTP tool **`route_by_language`**: `POST {{routing_api_base_url}}/api/v1/calls/route-by-language`; **response_mapping** — `route_id` → `appointment.id`, `target_queue` → `confirmation_code`, `language_code` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Civic FAQ & language router** agent; **Publish**.
5. **Web test** script: ask for Spanish support → confirm language preference → confirm summary when agent reads back tool result.
6. **Expected:** **`route_by_language`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=public-sector-civic-services-faq&catalog_variant_id=language_router_complex&tool_name=route_by_language`**.

## Day 1 checklist

1. **Scripts:** agency-approved civic FAQ copy only; no SSN or card capture in prompts.
2. **Disclosures:** recording and public-safety escalation per compliance tags.
3. **Handoff:** clerk or case worker queue when complexity exceeds script scope.
4. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for web; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.

## Integrations

- Civic scheduling and permit records via HTTP tools; services directory deep links in template variables.

## Catalog graph variants (MK-01)

- **Simple (default install):** [public-sector-civic-services-faq.json](../catalog/packaged-workflows/public-sector-civic-services-faq.json).
- **Complex (case callback):** [public-sector-booking-complex.json](../catalog/packaged-workflows/public-sector-booking-complex.json) — variant **`booking_complex`**; wire HTTP **schedule_civic_callback**; see **Booking-complex happy-path test** above.
- **Complex (permit status):** [public-sector-permit-status-complex.json](../catalog/packaged-workflows/public-sector-permit-status-complex.json) — variant **`permit_status_complex`**; wire **lookup_permit_status**; see **Permit status lookup happy-path test** above.
- **Complex (language router):** [public-sector-language-router-complex.json](../catalog/packaged-workflows/public-sector-language-router-complex.json) — variant **`language_router_complex`**; wire **route_by_language**; see **Multilingual routing happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `public-sector-civic-services-faq`. **Overview:** `/analytics?catalog_slug=public-sector-civic-services-faq`. **Calls:** `/analytics/calls` — FAQ resolution and scheduling tool success surface in **tool spans** / **`mapped_data`** on call detail. HTTP field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Case worker callback scheduling** — **`booking_complex`** + **`schedule_civic_callback`**; **Permit status lookup** — **`permit_status_complex`** + **`lookup_permit_status`**; **Multilingual routing** — **`language_router_complex`** + **`route_by_language`** (see happy-path sections above).

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Case worker callback scheduling** | Self-serve civic follow-up | **Shipped** — **`booking_complex`** + **schedule_civic_callback** |
| **Permit status lookup** | Real-time permit records | **Shipped** — **`permit_status_complex`** + **lookup_permit_status** |
| **Multilingual routing** | Language-appropriate handoff | **Shipped** — **`language_router_complex`** + **route_by_language** |

**Roadmap tail:** remaining items (if any) in **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) — empty when all motions above are shipped.
