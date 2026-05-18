"""Helpers for MK-01 Phase D `analytics_http_tool_spans` persistence."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any


def tool_span_row_to_api_dict(
    *,
    span_id: str,
    tool_name: str,
    tool_type: str,
    started_at: datetime | None,
    duration_ms: int,
    http_summary: dict[str, Any] | None,
) -> dict[str, Any]:
    """Shape aligned with :func:`extract_tool_spans_from_logs` entries (call detail API)."""
    http = http_summary if isinstance(http_summary, dict) and http_summary else None
    return {
        "span_id": span_id,
        "tool_name": tool_name,
        "tool_type": tool_type,
        "started_at": started_at.isoformat() if started_at else "",
        "duration_ms": duration_ms,
        "http": http,
    }


def parse_started_at_iso(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except ValueError:
        return None


def truncate_str(value: str | None, max_len: int) -> str:
    s = (value or "").strip()
    if len(s) <= max_len:
        return s
    return s[:max_len]
