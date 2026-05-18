"""Chain test: booking-style HTTP response_mapping → mapped_data → analytics tool span shape.

No network: ``httpx.AsyncClient`` is mocked. Proves MK-01 vertical wiring docs (VERTICAL_ANALYTICS_HTTP_MATRIX).
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.analytics.call_intel import extract_tool_spans_from_logs
from api.services.workflow.tools.custom_tool import execute_http_request


@pytest.mark.asyncio
async def test_execute_http_maps_booking_fields_for_downstream_analytics():
    """execute_http_request fills mapped_data from response_mapping (scheduling-style JSON)."""
    upstream = {
        "appointment": {
            "id": "appt-7",
            "slot": {"start": "2026-04-25T10:00:00Z"},
        },
        "confirmation_code": "ZZ99",
    }
    config = {
        "method": "POST",
        "url": "https://scheduling.example.com/api/v1/appointments",
        "timeout_ms": 3000,
        "parameters": [],
        "response_mapping": {
            "appointment_id": "appointment.id",
            "slot_start": "appointment.slot.start",
            "confirmation_code": "confirmation_code",
        },
    }

    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json = lambda: upstream

    mock_client = MagicMock()
    mock_client.request = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("api.services.workflow.tools.custom_tool.httpx.AsyncClient") as ac:
        ac.return_value = mock_client

        out = await execute_http_request(
            config=config,
            arguments={},
            call_context_vars=None,
            organization_id=None,
        )

    assert out.get("status") == "success"
    md = out.get("mapped_data") or {}
    assert md.get("appointment_id") == "appt-7"
    assert md.get("confirmation_code") == "ZZ99"
    assert "2026-04-25" in str(md.get("slot_start", ""))


def test_analytics_tool_span_preserves_http_mapped_data():
    """Log envelope matches execute_http_request result → extract_tool_spans_from_logs http.summary."""
    payload = {
        "status": "success",
        "status_code": 201,
        "data": {"appointment": {"id": "appt-7"}},
        "mapped_data": {
            "appointment_id": "appt-7",
            "slot_start": "2026-04-25T10:00:00Z",
        },
    }
    events = [
        {
            "type": "rtf-function-call-end",
            "payload": {
                "function_name": "book_slot",
                "tool_call_id": "tc-book-1",
                "result": json.dumps(payload),
            },
            "timestamp": "2026-04-25T12:00:05+00:00",
        },
    ]
    spans = extract_tool_spans_from_logs({"realtime_feedback_events": events})
    assert len(spans) == 1
    assert spans[0]["tool_name"] == "book_slot"
    http = spans[0].get("http") or {}
    assert http.get("mapped_data", {}).get("appointment_id") == "appt-7"
    assert http.get("request_status") == 201
