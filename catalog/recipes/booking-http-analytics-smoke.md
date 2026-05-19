# Booking-style HTTP tool → analytics smoke (MK-01)

**Goal:** prove **`response_mapping`** on an HTTP tool produces **`mapped_data`** that appears on **Analytics → call detail** tool spans (same JSON shape the runtime logs on `rtf-function-call-end`).

## Sample upstream JSON

See **[booking-scheduling-upstream-response.sample.json](../fixtures/booking-scheduling-upstream-response.sample.json)** — mimics a scheduling API confirming an appointment.

Example **`response_mapping`** (output key → dot path in JSON):

| Output key (analytics-friendly) | Path in sample JSON |
|----------------------------------|---------------------|
| `appointment_id` | `appointment.id` |
| `slot_start` | `appointment.slot.start` |
| `confirmation_code` | `confirmation_code` |

In the HTTP tool editor, add the same keys under **Response mapping** (or use **Auto-map** when Test API Call returns JSON).

## Automated chain test (no network)

Pytest patches the HTTP client and asserts:

1. `execute_http_request` returns **`mapped_data`** after **`response_mapping`**.  
2. `extract_tool_spans_from_logs` surfaces that **`mapped_data`** under **`tool_spans[].http`** (what analytics call detail uses).

Run from repo:

```bash
cd api && python -m pytest tests/test_booking_http_mapping_analytics_span.py -q
```

**Related:** [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../VERTICAL_ANALYTICS_HTTP_MATRIX.md), [ANALYTICS_VERTICAL_ROADMAP.md](../ANALYTICS_VERTICAL_ROADMAP.md), [http-api.mdx](../../docs/voice-agent/tools/http-api.mdx). **Buyer-facing demo:** [http-api-analytics-redaction-gtm-demo.md](http-api-analytics-redaction-gtm-demo.md).
