"""Unit tests for MK-01 Phase D analytics_http_tool_spans helpers (no DB)."""

from datetime import UTC, datetime

from api.services.analytics.analytics_http_tool_spans import (
    parse_started_at_iso,
    tool_span_row_to_api_dict,
)


def test_parse_started_at_iso_z_suffix():
    dt = parse_started_at_iso("2026-04-25T12:00:05Z")
    assert dt is not None
    assert dt.tzinfo == UTC
    assert dt.year == 2026


def test_parse_started_at_iso_invalid():
    assert parse_started_at_iso("") is None
    assert parse_started_at_iso(None) is None
    assert parse_started_at_iso("not-a-date") is None


def test_span_row_to_api_dict_maps_http_summary():
    d = tool_span_row_to_api_dict(
        span_id="tc-1",
        tool_name="book_slot",
        tool_type="http_api",
        started_at=datetime(2026, 4, 25, 12, 0, 5, tzinfo=UTC),
        duration_ms=120,
        http_summary={"request_status": 201, "mapped_data": {"x": 1}},
    )
    assert d["span_id"] == "tc-1"
    assert d["tool_name"] == "book_slot"
    assert d["http"]["request_status"] == 201
    assert "2026-04-25" in d["started_at"]


def test_span_row_to_api_dict_empty_http():
    d = tool_span_row_to_api_dict(
        span_id="s",
        tool_name="t",
        tool_type="function",
        started_at=None,
        duration_ms=0,
        http_summary=None,
    )
    assert d["http"] is None
    assert d["started_at"] == ""
