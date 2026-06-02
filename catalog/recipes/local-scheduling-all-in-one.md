# All-in-one local scheduling (MK-01)

**Goal:** Run booking flows end-to-end **without** connecting a buyer CRM, calendar, or payment stack. Dograh stores appointments locally, exposes open slots, and returns **downloadable `.ics` calendar invites** per booking.

External systems are optional upgrades (live calendars, payments, CRM sync).

## Enable (default in local dev)

In `api/.env`:

```bash
ENVIRONMENT=local
ENABLE_LOCAL_SCHEDULING=true   # defaults true when ENVIRONMENT=local
BACKEND_API_ENDPOINT=http://127.0.0.1:8000
```

Restart the API. Bookings persist under **`run/local_scheduling/org_{id}.json`**.

## Install from catalog (auto-wired)

1. Open **Workflow → Template catalog** and install a **booking-complex** variant (`variant_id=booking_complex`).
2. **`install-from-catalog`** sets **`scheduling_api_base_url`** to  
   `{BACKEND_API_ENDPOINT}/api/v1/local-scheduling` and records `workflow_configurations.local_scheduling`.
3. Use **Wire local calendar** on the workflow guide (or Settings → Local demo calendar) to create the **`book_slot`** HTTP tool.

No `:8765` stub required for real persistence and invites.

## HTTP surface

Base: **`{BACKEND}/api/v1/local-scheduling`**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/config` | URLs + feature flag |
| GET | `/lookup_availability?date=YYYY-MM-DD` | Open slots minus already-booked times |
| POST | `/book_slot` | Voice HTTP tool path (catalog `response_mapping`) |
| POST | `/api/v1/appointments` | Runbook alias when `scheduling_api_base_url` points here |
| POST | `/api/v1/appointments/reschedule` | `reschedule_appointment` / `confirm_or_reschedule_interview` |
| POST | `/appointments` | Authenticated UI booking |
| GET | `/appointments/{id}/invite.ics` | Calendar invite download |
| GET/DELETE | `/appointments` | List / cancel (authenticated) |

Booking response includes **`invite_download_url`**, **`confirmation_code`**, and nested **`appointment.id`** / **`appointment.slot.start`** for analytics `mapped_data`.

Optional body fields: **`attendee_email`** (ATTENDEE line in `.ics`), **`duration_minutes`** (default 30).

## Open schedule (customer-defined slots)

**Settings → Local demo calendar → Open schedule** saves comma-separated UTC times (e.g. `09:00, 11:30, 14:00, 16:30`) per org. **`lookup_availability`** uses these instead of hard-coded demo slots.

API: `GET/PUT /api/v1/local-scheduling/open-schedule` (authenticated).

## Local payments (collections / redirect)

See **[local-payments-all-in-one.md](local-payments-all-in-one.md)** — persisted payment promises without Stripe; retail **`collections_complex`** auto-wires **`collections_api_base_url`** on install.

## UI smoke test

1. **Settings → Local demo calendar** — book a demo slot with an email → download **.ics** from the table.
2. Install healthcare **booking_complex** → wire local calendar → **Test API Call** on `book_slot`.
3. Run a **Web test** call; confirm **Analytics → call detail** shows mapped `appointment_id`, `confirmation_code`, `invite_download_url`.

## When to use the `:8765` stub instead

Use [booking-scheduling-stub-local.md](booking-scheduling-stub-local.md) only when you need **static fixture JSON** for non-booking PREBUILD endpoints (claims status, payment promises, etc.) without persistence. For **real bookings + calendar invites**, prefer this local scheduling API.

**Related:** [booking-http-analytics-smoke.md](booking-http-analytics-smoke.md), [PREBUILD_VERTICAL_ROADMAP.md](../PREBUILD_VERTICAL_ROADMAP.md).
