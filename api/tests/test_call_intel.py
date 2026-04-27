"""Unit tests for analytics call_intel helpers."""

import json

from api.services.analytics.call_intel import (
    distinct_tool_names_from_spans,
    extract_tool_spans_from_logs,
    parse_analytics_call_id,
    workflow_run_to_analytics_call_id,
)


def test_call_id_roundtrip():
    assert workflow_run_to_analytics_call_id(42) == "wr-42"
    assert parse_analytics_call_id("wr-42") == 42
    assert parse_analytics_call_id("42") == 42
    assert parse_analytics_call_id("bad") is None


def test_extract_tool_spans_http_tool():
    http_result = {
        "status": "success",
        "status_code": 201,
        "data": {"id": "x"},
        "mapped_data": {"appointment_id": "x"},
    }
    logs = {
        "realtime_feedback_events": [
            {
                "type": "rtf-function-call-start",
                "payload": {"function_name": "book_slot", "tool_call_id": "tc1"},
                "timestamp": "2026-01-15T10:00:00+00:00",
            },
            {
                "type": "rtf-function-call-end",
                "payload": {
                    "function_name": "book_slot",
                    "tool_call_id": "tc1",
                    "result": json.dumps(http_result),
                },
                "timestamp": "2026-01-15T10:00:01+00:00",
            },
        ]
    }
    spans = extract_tool_spans_from_logs(logs)
    assert len(spans) == 1
    assert spans[0]["tool_name"] == "book_slot"
    assert spans[0]["tool_type"] == "http_api"
    assert spans[0]["http"]["request_status"] == 201
    assert spans[0]["http"]["mapped_data"]["appointment_id"] == "x"
    assert spans[0]["duration_ms"] == 1000
    assert distinct_tool_names_from_spans(spans) == ["book_slot"]
