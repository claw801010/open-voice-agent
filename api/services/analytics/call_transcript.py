"""Transcript helpers for analytics (no gen_ai / db imports)."""

from __future__ import annotations

from typing import Any

from api.utils.transcript import generate_transcript_text


def transcript_from_logs(logs: dict[str, Any] | None, max_chars: int = 12000) -> str:
    events = (logs or {}).get("realtime_feedback_events") or []
    text = generate_transcript_text(events) if events else ""
    if len(text) > max_chars:
        return text[: max_chars - 80] + "\n… [transcript truncated]"
    return text
