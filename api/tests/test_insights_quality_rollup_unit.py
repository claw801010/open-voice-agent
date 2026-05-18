"""Unit tests for org-level insights quality roll-up."""

import json

from api.services.analytics.insights_quality_rollup import rollup_quality_insights

_HTTP_RESULT = {
    "status": "success",
    "status_code": 201,
    "mapped_data": {"appointment_id": "a1"},
}


def _logs_with_tool():
    return {
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
                    "result": json.dumps(_HTTP_RESULT),
                },
                "timestamp": "2026-01-15T10:00:01+00:00",
            },
        ]
    }


def test_rollup_quality_insights_containment_and_cx():
    snapshots = [
        {
            "logs": _logs_with_tool(),
            "gathered_context": {"outcome_key": "booked"},
            "annotations": {"node_results": {"qa_1": {"score": 5}}},
            "cost_info": {"call_duration_seconds": 60},
        },
        {
            "logs": {},
            "gathered_context": {"customer_outcome": "escalated to human"},
            "annotations": {},
            "cost_info": {"call_duration_seconds": 30},
        },
    ]
    out = rollup_quality_insights(snapshots, total_calls_in_range=2)
    assert out["sampled_calls"] == 2
    assert out["sample_capped"] is False
    assert out["avg_cx_score"] is not None
    assert out["calls_with_qa"] == 1
    assert out["avg_qa_score"] == 5.0
    labels = {m["containment"] for m in out["containment_mix"]}
    assert "contained" in labels
    assert "escalated" in labels
    assert any(t["function_name"] == "book_slot" for t in out["tool_health"])


def test_rollup_empty_with_total_calls_capped_flag():
    out = rollup_quality_insights([], total_calls_in_range=10)
    assert out["sampled_calls"] == 0
    assert out["sample_capped"] is True
