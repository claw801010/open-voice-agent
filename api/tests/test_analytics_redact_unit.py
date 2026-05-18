"""Unit tests: analytics PII redaction (no DB)."""

import pytest

from api.services.analytics.analytics_redact import (
    REDACTED,
    coerce_detail_redaction_enabled,
    redact_analytics_call_detail,
    redact_csv_cell,
    redact_mapping_tree,
    redact_plain_string,
)


def test_redact_plain_string_email_and_phone():
    assert "@" not in redact_plain_string("Reach user@example.com please")
    assert REDACTED in redact_plain_string("Reach user@example.com please")
    assert redact_plain_string("booked") == "booked"


def test_redact_mapping_tree_sensitive_keys():
    raw = {
        "slot": "10:00",
        "patient_email": "x@y.co",
        "nested": {"contact_phone": "555-123-4567"},
    }
    out = redact_mapping_tree(raw)
    assert out["slot"] == "10:00"
    assert out["patient_email"] == REDACTED
    assert out["nested"]["contact_phone"] == REDACTED


def test_redact_analytics_call_detail_tool_spans_and_outcomes():
    detail = {
        "call_id": "wr-1",
        "metrics": {"llm_rounds": 0, "tool_invocation_count": 1},
        "outcomes": {"outcome_key": "ok", "notes": "call backup@site.org"},
        "tool_spans": [
            {
                "span_id": "a",
                "tool_name": "t",
                "tool_type": "http_api",
                "http": {
                    "mapped_data": {"slot": "9:00", "patient_email": "p@q.com"},
                    "error_message": "fail see admin@corp.io",
                },
            }
        ],
        "qa": {"score": 1.0, "flags": [], "reviewer_notes": "bad tone x@y.z"},
    }
    out = redact_analytics_call_detail(detail)
    assert out["outcomes"]["outcome_key"] == "ok"
    assert "@" not in str(out["outcomes"]["notes"])
    assert out["tool_spans"][0]["http"]["mapped_data"]["slot"] == "9:00"
    assert out["tool_spans"][0]["http"]["mapped_data"]["patient_email"] == REDACTED
    assert "@" not in out["tool_spans"][0]["http"]["error_message"]
    assert "@" not in (out["qa"]["reviewer_notes"] or "")


def test_redact_analytics_call_detail_live_trace_tool_receive():
    detail = {
        "call_id": "wr-1",
        "live_trace": {
            "tool_invocations": [
                {
                    "tool_call_id": "tc1",
                    "receive": {
                        "mapped_data": {"email": "u@example.com"},
                        "error": "notify admin@corp.io",
                    },
                    "http": {"error_message": "x@y.z", "mapped_data": {"phone": "555-0100"}},
                }
            ],
        },
    }
    out = redact_analytics_call_detail(detail)
    inv = out["live_trace"]["tool_invocations"][0]
    assert inv["receive"]["mapped_data"]["email"] == REDACTED
    assert "@" not in inv["receive"]["error"]
    assert "@" not in inv["http"]["error_message"]


def test_redact_csv_cell_coerces_and_masks():
    assert "@" not in redact_csv_cell('id="a@b.c"')
    assert redact_csv_cell(42) == "42"


@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, True),
        (True, True),
        (False, False),
        ("false", False),
        ("true", True),
        ("no", False),
    ],
)
def test_coerce_detail_redaction_enabled(raw, expected):
    assert coerce_detail_redaction_enabled(raw, default_when_missing=True) is expected
