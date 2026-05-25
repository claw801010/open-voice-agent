# Local booking / scheduling HTTP stub (MK-01)

**Goal:** exercise catalog **booking-complex** flows against a real HTTP endpoint (not only pytest mocks).

## Start the stub

From repo root:

```bash
python scripts/booking_scheduling_stub_server.py
```

Or with Docker infra already up:

```bash
docker compose -f docker-compose-local.yaml --profile booking-stub up -d booking-stub
```

Default base URL: **`http://127.0.0.1:8765`**

- `GET /health` → `{"status":"ok"}`
- `POST /api/v1/appointments`, `/api/v1/appointments/reschedule`, `/api/v1/reservations/modify`, `/api/v1/offers/attach`, `/api/v1/payment-promises`, `/api/v1/quotes/intent`, `/api/v1/claims/status`, `/api/v1/accounts/health`, `/api/v1/deals/stage`, `/api/v1/visits/enroll`, `/book_slot`, `/book_demo`, … → **201** with [booking-scheduling-upstream-response.sample.json](../fixtures/booking-scheduling-upstream-response.sample.json)

## Wire into a workflow

1. Install a **booking-complex** variant from the template catalog (`variant_id` = `booking_complex` where available).
2. Set template variable **`scheduling_api_base_url`** = `http://127.0.0.1:8765` (or your host).
3. Create an HTTP tool pointing at `{{scheduling_api_base_url}}/api/v1/appointments` (POST).
4. Add **response_mapping** keys (`appointment_id`, `slot_start`, `confirmation_code`) per [booking-http-analytics-smoke.md](booking-http-analytics-smoke.md).
5. Run **Test API Call**, then a **Web test** call; confirm **Analytics → call detail** shows **`mapped_data`** (and **`cache_hit`** when org HTTP cache is enabled).

**Related:** [PREBUILD_VERTICAL_ROADMAP.md](../PREBUILD_VERTICAL_ROADMAP.md), [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../VERTICAL_ANALYTICS_HTTP_MATRIX.md).
