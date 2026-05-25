# All-in-one local payments (MK-01)

**Goal:** Run **collections** and **payment redirect** flows without Stripe or a buyer processor. Dograh stores promises and redirect confirms locally with booking-compatible JSON for analytics `mapped_data`.

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

1. Install retail **`collections_complex`** from Template catalog.
2. **`install-from-catalog`** sets **`collections_api_base_url`** to  
   `{BACKEND_API_ENDPOINT}/api/v1/local-payments` when `ENABLE_LOCAL_PAYMENTS` is on.
3. Wire HTTP tool **`capture_payment_promise`**:  
   `POST {{collections_api_base_url}}/api/v1/payment-promises`
4. **response_mapping** — `promise_id` → `appointment.id`, `confirmation_code` → `confirmation_code`, `promised_date` → `appointment.slot.start`

For telecom **`payment_redirect_complex`**, point **`billing_api_base_url`** at the same base (or full URL below) and use **`confirm_payment_redirect`**:  
`POST {BASE}/api/v1/payments/redirect/confirm`

## HTTP surface

Base: **`{BACKEND}/api/v1/local-payments`**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/config` | URLs + feature flag |
| GET | `/records` | Authenticated list (Settings UI) |
| POST | `/api/v1/payment-promises` | `capture_payment_promise` |
| POST | `/api/v1/payments/redirect/confirm` | `confirm_payment_redirect` |

## UI smoke test

**Settings → Local demo payments** — view recorded promises after a voice HTTP tool call or manual POST.

**Related:** [local-scheduling-all-in-one.md](local-scheduling-all-in-one.md), [booking-http-analytics-smoke.md](booking-http-analytics-smoke.md).
