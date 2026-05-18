"""Unit tests for analytics CSV helper (no DB)."""

from api.services.analytics.analytics_calls_csv import analytics_call_rows_to_csv_bytes


def test_csv_utf8_bom_and_header_when_empty():
    b = analytics_call_rows_to_csv_bytes([])
    text = b.decode("utf-8")
    assert text.startswith("\ufeff")
    lines = text.strip().splitlines()
    assert lines[0].lstrip("\ufeff").startswith("call_id")


def test_csv_row_roundtrip_values():
    rows = [
        {
            "call_id": "wr-99",
            "workflow_id": 3,
            "workflow_slug": "healthcare-clinic-screening",
            "catalog_variant_id": "booking_complex",
            "started_at": "2026-04-01T12:00:00+00:00",
            "duration_ms": 120000,
            "disposition": "completed",
            "outcome_key": "booked",
            "tool_names": ["reserve_time", "lookup"],
        }
    ]
    b = analytics_call_rows_to_csv_bytes(rows)
    body = b.decode("utf-8")
    assert "wr-99" in body
    assert "booking_complex" in body
    assert "reserve_time" in body and "lookup" in body
