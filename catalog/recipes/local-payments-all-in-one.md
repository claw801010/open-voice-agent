# All-in-one local payments (MK-01)

**Goal:** Run **collections**, **payment redirect**, and **concierge enroll** flows without Stripe or a buyer processor. Dograh stores promises, redirect confirms, and concierge enrollments locally with booking-compatible JSON for analytics `mapped_data`.

External payment processors are optional upgrades.

## Enable (default in local dev)

In `api/.env`:

```bash
ENVIRONMENT=local
ENABLE_LOCAL_PAYMENTS=true   # defaults true when ENVIRONMENT=local
BACKEND_API_ENDPOINT=http://127.0.0.1:8000
```

Records persist under **`run/local_payments/org_{id}.json`**.

## Install from catalog (auto-wired)

When `ENABLE_LOCAL_PAYMENTS` is on, **`install-from-catalog`** sets:

| Template variable | Local base |
|-------------------|------------|
| **`collections_api_base_url`** | `{BACKEND}/api/v1/local-payments` (retail **`collections_complex`**) |
| **`billing_api_base_url`** | same base (telecom **`payment_redirect_complex`**, healthcare **`concierge_complex`**) |

### Retail collections

1. Install retail **`collections_complex`** from Template catalog.
2. Wire HTTP tool **`capture_payment_promise`**:  
   `POST {{collections_api_base_url}}/api/v1/payment-promises`
3. **response_mapping** — `promise_id` → `appointment.id`, `confirmation_code` → `confirmation_code`, `promised_date` → `appointment.slot.start`

Or use **Wire local payments** on the workflow editor catalog guide card (creates tools + sets URLs).

### Telecom payment redirect

Install **`payment_redirect_complex`**; **`billing_api_base_url`** is auto-wired. Wire **`confirm_payment_redirect`**:  
`POST {{billing_api_base_url}}/api/v1/payments/redirect/confirm`

### Healthcare concierge enroll

Install **`concierge_complex`**; **`billing_api_base_url`** is auto-wired. Wire **`enroll_concierge_visit`**:  
`POST {{billing_api_base_url}}/api/v1/visits/enroll`

## HTTP surface

Base: **`{BACKEND}/api/v1/local-payments`**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/config` | URLs + feature flag |
| GET | `/records` | Authenticated list (Settings UI) |
| POST | `/api/v1/payment-promises` | `capture_payment_promise` |
| POST | `/api/v1/payments/redirect/confirm` | `confirm_payment_redirect` |
| POST | `/api/v1/visits/enroll` | `enroll_concierge_visit` |

## UI smoke test

**Settings → Local demo payments** — view recorded promises, redirects, and enrollments after a voice HTTP tool call or manual POST.

**Workflow editor** — catalog guide card **Wire local payments** (when the vertical uses payment HTTP tools).

**Related:** [local-scheduling-all-in-one.md](local-scheduling-all-in-one.md), [booking-http-analytics-smoke.md](booking-http-analytics-smoke.md).
