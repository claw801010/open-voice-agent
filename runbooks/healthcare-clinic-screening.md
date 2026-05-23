# Runbook — Healthcare: patient screening & triage

**Pack slug:** `healthcare-clinic-screening`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Stand up a **voice** flow for symptom triage, scheduling handoff, or after-hours coverage with **minimal PHI** in prompts and logs. This runbook is operational guidance—not legal advice; involve compliance for HIPAA/BAA and state telehealth rules.

## Prerequisites

- Org and workflow created (from template or blank); see [READMELEARNME.md](../READMELEARNME.md) for stack orientation.
- Telephony provider and numbers if using **PSTN**; WebRTC embed if using **web** ([recipes/embed-widget.md](../recipes/embed-widget.md)).
- Decision on **recording**: off by default until BAA and policy allow storage.

## Happy-path test (QA)

1. Open **Template catalog**, install **Patient screening & triage** (default simple variant).
2. Click **Try (Web only)** or open the workflow and use **Simulation → Start Web test** with default template variables.
3. **Expected:** Web call connects; agent greets and runs the triage script; call ends cleanly (no graph validation errors). In dev, HTTP scheduling tools may be unwired — agent should still hand off or close politely.

## Booking-complex happy-path test (QA)

**Goal:** book a visit in **≤6 agent turns** after the HTTP **`book_slot`** tool is wired (MK-01 rubric).

**Prerequisites:** [booking scheduling stub](../catalog/recipes/booking-scheduling-stub-local.md) on `http://127.0.0.1:8765` (or buyer scheduling API).

1. **Template catalog** → **Patient screening & triage** → install with variant **`booking_complex`** (or `POST /api/v1/workflow/install-from-catalog` with `"variant_id":"booking_complex"`).
2. **Customize** the installed workflow; set **`scheduling_api_base_url`** = `http://127.0.0.1:8765` under template variables.
3. Create HTTP tool **`book_slot`**: `POST {{scheduling_api_base_url}}/api/v1/appointments`; **response_mapping** — `appointment_id` → `appointment.id`, `slot_start` → `appointment.slot.start`, `confirmation_code` → `confirmation_code` ([booking-http-analytics-smoke.md](../catalog/recipes/booking-http-analytics-smoke.md)).
4. Attach **`book_slot`** to the main **Agent** node; **Save** and **Publish** when validation passes.
5. **Simulation → Start Web test**. Caller script (one turn each): state visit type → preferred date/time window → confirm booking when agent offers.
6. **Expected:** agent invokes **`book_slot`**; call ends with confirmation language; **Analytics → call detail** shows HTTP span with **`mapped_data.appointment_id`** (and **`confirmation_code`**). Filter **`/analytics/calls?catalog_slug=healthcare-clinic-screening&catalog_variant_id=booking_complex&tool_name=book_slot`**.

## Day 1 checklist

1. **Variables:** map only what the agent needs (e.g. `patient_locale`, `clinic_timezone`)—avoid free-text PHI in tool payloads unless required.
2. **Handoff:** define warm transfer or callback number for emergencies; block agent from diagnosing.
3. **Publish & validate:** use workflow validation in UI; run a **Web call** test ([READMEEXPERIENCE.md](../READMEEXPERIENCE.md) no-code path).
4. **PSTN (optional):** follow [recipes/inbound-pstn.md](../recipes/inbound-pstn.md); label disclosure and recording per jurisdiction.

## Integrations

- EHR scheduling APIs: typically via **HTTP tools** on agent nodes ([READMEADK.md](../READMEADK.md) REST patterns).
- Secure messaging: out of band from this repo; document URLs in org runbooks.

## Catalog graph variants (MK-01)

- **Simple (default install):** [healthcare-clinic-screening.json](../catalog/packaged-workflows/healthcare-clinic-screening.json) — minimal linear triage.
- **Complex (booking-ready prompts):** [healthcare-triage-booking-complex.json](../catalog/packaged-workflows/healthcare-triage-booking-complex.json) — import via `POST /api/v1/workflow/create/definition` ([import playbook](../catalog/import-packaged-workflow-json.md)); attach an HTTP **book_slot** (or equivalent) tool using `{{scheduling_api_base_url}}` and pack variables from [vertical-packs.json](../catalog/vertical-packs.json). Prove outcomes and tool traces in **Analytics** ([ANALYTICS_VERTICAL_ROADMAP.md](../catalog/ANALYTICS_VERTICAL_ROADMAP.md)).

## Proof in Analytics (MK-01)

Use **`catalog_slug`** = `healthcare-clinic-screening` to align calls list, CSV exports, and Overview filters with this vertical. **Overview:** `/analytics?catalog_slug=healthcare-clinic-screening` applies the widget preset when the org dashboard is still the generic default order. **Calls:** `/analytics/calls` — filter by **`tool_name`** for HTTP booking/triage evidence; **call detail** shows **tool spans** and **`mapped_data`**. Map **`response_mapping`** keys to buyer KPIs via [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md). Demo script: [http-api-analytics-redaction-gtm-demo.md](../catalog/recipes/http-api-analytics-redaction-gtm-demo.md).

## Measure

- Containment vs. handoff rate, average handle time, after-hours coverage hours, zero critical mis-triage (human review sample).
