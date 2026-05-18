"""Unit tests for call live trace + quality report builders."""

import json

from api.services.analytics.call_live_trace import (
    build_live_trace_timeline,
    build_llm_inference_insights,
    build_tool_function_report,
    build_tool_invocation_details,
)
from api.services.analytics.call_quality_report import build_call_quality_report

_HTTP_RESULT = {
    "status": "success",
    "status_code": 201,
    "mapped_data": {"appointment_id": "apt-1"},
}


def _sample_logs():
    return {
        "realtime_feedback_events": [
            {
                "type": "rtf-user-transcription",
                "payload": {"text": "Book tomorrow", "final": True},
                "timestamp": "2026-01-15T10:00:00+00:00",
                "turn": 1,
            },
            {
                "type": "rtf-ttfb-metric",
                "payload": {"ttfb_seconds": 0.5, "model": "gpt-4o-mini", "processor": "openai"},
                "timestamp": "2026-01-15T10:00:01+00:00",
                "turn": 1,
            },
            {
                "type": "rtf-function-call-start",
                "payload": {"function_name": "book_slot", "tool_call_id": "tc1"},
                "timestamp": "2026-01-15T10:00:02+00:00",
            },
            {
                "type": "rtf-function-call-end",
                "payload": {
                    "function_name": "book_slot",
                    "tool_call_id": "tc1",
                    "result": json.dumps(_HTTP_RESULT),
                },
                "timestamp": "2026-01-15T10:00:03+00:00",
            },
            {
                "type": "rtf-bot-text",
                "payload": {"text": "You're booked."},
                "timestamp": "2026-01-15T10:00:04+00:00",
            },
        ]
    }


def test_live_trace_timeline_and_tools():
    logs = _sample_logs()
    timeline = build_live_trace_timeline(logs)
    kinds = [e["kind"] for e in timeline]
    assert "conversation" in kinds
    assert "llm" in kinds
    assert "tool" in kinds

    invocations = build_tool_invocation_details(logs)
    assert len(invocations) == 1
    assert invocations[0]["tool_name"] == "book_slot"
    assert invocations[0]["success"] is True
    assert invocations[0]["http"]["request_status"] == 201

    llm = build_llm_inference_insights(logs)
    assert llm["inference_count"] == 1
    assert llm["avg_ttfb_ms"] == 500
    assert "gpt-4o-mini" in llm["models"]


def test_tool_function_report_and_quality():
    logs = _sample_logs()
    report_rows = build_tool_function_report(logs)
    assert report_rows[0]["function_name"] == "book_slot"
    assert report_rows[0]["invocation_count"] == 1
    assert report_rows[0]["success_rate"] == 1.0

    quality = build_call_quality_report(
        logs=logs,
        gathered_context={"outcome_key": "booked", "customer_outcome": "booked"},
        annotations={"qa": {"score": 4, "flags": ["polite"]}},
        duration_ms=120_000,
    )
    assert quality["containment"] == "contained"
    assert quality["outcome_key"] == "booked"
    assert quality["tool_invocation_count"] >= 1
    assert quality["cx_score"] >= 50
    assert quality["tool_functions"][0]["function_name"] == "book_slot"
