# Runbook — HR / staffing: candidate FAQ & interview scheduling

**Pack slug:** `hr-staffing-recruiting-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Improve **candidate experience** with scripted careers FAQ, **tokenized application status** lookups, and **interview scheduling** with calendar invites—runnable on Dograh's built-in local calendar without connecting an ATS on day one.

## Prerequisites

- Company-approved careers FAQ copy and recording disclosures.
- **Local scheduling (default):** [local-scheduling-all-in-one.md](../catalog/recipes/local-scheduling-all-in-one.md) for interview booking + `.ics` invites.
- Optional ATS HTTP tools for live application status (tokenized only).
- Legal / HR sign-off before buyer-facing GTM ([PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md)).

## Happy-path test (QA)

1. Install **Candidate FAQ & interview scheduling** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask an application-process or interview-prep question and receive a coherent, brand-aligned answer; agent offers escalation to {{support_phone}} or {{careers_portal_url}} when live tools are not wired.

## Booking-complex happy-path test (QA)

**Goal:** schedule an **interview** in **≤6 agent turns** after **`schedule_interview`** is wired.

**Prerequisites:** [All-in-one local scheduling](../catalog/recipes/local-scheduling-all-in-one.md) (`ENABLE_LOCAL_SCHEDULING`; install-from-catalog auto-sets `scheduling_api_base_url`). Optional: [booking stub](../catalog/recipes/booking-scheduling-stub-local.md) on `:8765`.

1. Install **Candidate FAQ & interview scheduling** with variant **`booking_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize**; confirm **`scheduling_api_base_url`** points at local scheduling (auto on install; or **Wire local calendar**); set **`company_name`**, **`default_requisition_code`**, and **`interview_type_default`** from pack defaults.
3. HTTP tool **`schedule_interview`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `interview_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`, `invite_download_url` → `invite_download_url`.
4. Attach tool to the **Candidate FAQ & interview scheduling** agent; **Publish**.
5. **Web test** script: ask to schedule a phone screen → give timezone + preferred window → provide email for calendar invite → confirm summary.
6. **Expected:** **`schedule_interview`** invoked; call detail shows **`mapped_data`**; filter **`/analytics/calls?catalog_slug=hr-staffing-recruiting-faq&catalog_variant_id=booking_complex&tool_name=schedule_interview`**.

## Application status lookup happy-path test (QA)

**Goal:** return **tokenized application status** in **≤6 agent turns** after **`lookup_application_status`** is wired (**application_status_complex** variant). Review [PARTNER_REVIEW.md](../catalog/PARTNER_REVIEW.md) and [ANALYTICS_REDACTION_MATRIX.md](../catalog/ANALYTICS_REDACTION_MATRIX.md) before buyer-facing GTM.

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` for static fixture JSON (accepts `POST /api/v1/applications/status` with sample JSON).

1. Install **Candidate FAQ & interview scheduling** with variant **`application_status_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"application_status_complex"`).
2. **Customize**; set **`ats_api_base_url`** = `http://127.0.0.1:8765`, **`company_name`**, and **`default_requisition_code`** from pack defaults.
3. HTTP tool **`lookup_application_status`**: `POST {{ats_api_base_url}}/api/v1/applications/status`; **response_mapping** — `application_id` → `appointment.id`, `status_code` → `confirmation_code`, `last_updated` → `appointment.slot.start` (reuse scheduling sample shape for local stub QA).
4. Attach tool to the **Candidate FAQ & application status** agent; **Publish**.
5. **Web test** script: ask about application status → provide tokenized application reference → confirm summary when agent reads back tool result.
6. **Expected:** **`lookup_application_status`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=hr-staffing-recruiting-faq&catalog_variant_id=application_status_complex&tool_name=lookup_application_status`**.

## Interview confirm / reschedule happy-path test (QA)

**Goal:** confirm or **reschedule** an upcoming interview in **≤6 agent turns** after **`confirm_or_reschedule_interview`** is wired (**interview_confirm_complex** variant).

**Prerequisites:** [All-in-one local scheduling](../catalog/recipes/local-scheduling-all-in-one.md) for persisted slots; optional [booking stub](../catalog/recipes/booking-scheduling-stub-local.md) on `:8765` for static reschedule JSON (`POST /api/v1/appointments/reschedule`).

1. Install **Candidate FAQ & interview scheduling** with variant **`interview_confirm_complex`** (`POST /api/v1/workflow/install-from-catalog` with `"variant_id":"interview_confirm_complex"`).
2. **Customize**; confirm **`scheduling_api_base_url`** points at local scheduling (auto on install; or **Wire local calendar**).
3. HTTP tool **`confirm_or_reschedule_interview`**: `POST {{scheduling_api_base_url}}/api/v1/appointments/reschedule`; **response_mapping** — `interview_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code`.
4. Attach tool to the **Confirm & remind** agent; **Publish**.
5. **Web test** script: reference an upcoming interview → ask to move to a new time window → confirm when agent summarizes.
6. **Expected:** **`confirm_or_reschedule_interview`** invoked; call detail **`mapped_data`** present; filter **`/analytics/calls?catalog_slug=hr-staffing-recruiting-faq&catalog_variant_id=interview_confirm_complex&tool_name=confirm_or_reschedule_interview`**.

## Day 1 checklist

1. **Scripts:** company-approved careers FAQ only; no SSN or compensation quotes in prompts.
2. **Disclosures:** recording per compliance tags.
3. **Handoff:** recruiter queue when complexity exceeds script scope.
4. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for web; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.

## Integrations

- **Built-in local calendar** for interview booking and `.ics` invites (no ATS required).
- Optional ATS status via HTTP tools; careers portal deep links in template variables.

## Catalog graph variants (MK-01)

- **Simple (default install):** [hr-staffing-recruiting-faq.json](../catalog/packaged-workflows/hr-staffing-recruiting-faq.json).
- **Complex (interview scheduling):** [hr-staffing-booking-complex.json](../catalog/packaged-workflows/hr-staffing-booking-complex.json) — variant **`booking_complex`**; wire HTTP **schedule_interview**; see **Booking-complex happy-path test** above.
- **Complex (application status):** [hr-staffing-application-status-complex.json](../catalog/packaged-workflows/hr-staffing-application-status-complex.json) — variant **`application_status_complex`**; wire **lookup_application_status**; see **Application status lookup happy-path test** above.
- **Complex (interview confirm):** [hr-staffing-interview-confirm-complex.json](../catalog/packaged-workflows/hr-staffing-interview-confirm-complex.json) — variant **`interview_confirm_complex`**; wire **confirm_or_reschedule_interview**; see **Interview confirm / reschedule happy-path test** above.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `hr-staffing-recruiting-faq`. **Overview:** `/analytics?catalog_slug=hr-staffing-recruiting-faq`. **Calls:** `/analytics/calls` — FAQ resolution and scheduling tool success surface in **tool spans** / **`mapped_data`** on call detail. HTTP field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md).

## High-revenue motions (roadmap)

**Shipped:** **Interview scheduling** — **`booking_complex`** + **`schedule_interview`**; **Application status lookup** — **`application_status_complex`** + **`lookup_application_status`**; **Interview confirm / reschedule** — **`interview_confirm_complex`** + **`confirm_or_reschedule_interview`** (see happy-path sections above).

| Motion | Buyer value | Status |
|--------|-------------|--------|
| **Interview scheduling** | Self-serve candidate scheduling + calendar invites | **Shipped** — **`booking_complex`** + **schedule_interview** |
| **Application status lookup** | Tokenized ATS status without agent hold | **Shipped** — **`application_status_complex`** + **lookup_application_status** |
| **Interview confirm / reschedule** | No-show reduction for recruiting | **Shipped** — **`interview_confirm_complex`** + **confirm_or_reschedule_interview** |

**Roadmap tail:** remaining items (if any) in **`roadmap_motions`** in [vertical-packs.json](../catalog/vertical-packs.json) — empty when all motions above are shipped.
