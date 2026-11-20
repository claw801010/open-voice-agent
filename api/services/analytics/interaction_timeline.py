"""Unified omnichannel interaction timeline (voice + local async channels)."""

from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

Channel = Literal["voice", "sms", "email", "web"]

STORE_VERSION = 1
MAX_EVENTS = 500


def empty_timeline() -> dict[str, Any]:
    return {"v": STORE_VERSION, "events": []}


def normalize_timeline(raw: Any) -> dict[str, Any]:
    base = empty_timeline()
    if not isinstance(raw, dict):
        return base
    out = copy.deepcopy(base)
    events = raw.get("events")
    out["events"] = [e for e in events if isinstance(e, dict)] if isinstance(events, list) else []
    return out


def _new_event_id() -> str:
    return f"evt-{uuid.uuid4().hex[:12]}"


def append_event(store: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    out = normalize_timeline(store)
    events = [event, *out["events"]]
    out["events"] = events[:MAX_EVENTS]
    return out


def build_voice_event(
    *,
    workflow_run_id: int,
    workflow_id: int | None,
    workflow_name: str | None,
    catalog_slug: str | None,
    mode: str | None,
    disposition: str | None = None,
    outcome_key: str | None = None,
) -> dict[str, Any]:
    call_id = f"wr-{workflow_run_id}"
    summary_bits = [b for b in (disposition, outcome_key, mode) if b]
    summary = "Voice call"
    if summary_bits:
        summary = f"Voice call · {' · '.join(summary_bits)}"
    return {
        "id": _new_event_id(),
        "channel": "voice",
        "at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "workflow_run_id": workflow_run_id,
        "call_id": call_id,
        "workflow_id": workflow_id,
        "workflow_name": workflow_name,
        "catalog_slug": catalog_slug,
        "ref_id": call_id,
        "status": "completed",
    }


def build_messaging_event(
    *,
    message: dict[str, Any],
    workflow_run_id: int | None = None,
    call_id: str | None = None,
) -> dict[str, Any]:
    channel = str(message.get("channel") or "sms")
    if channel not in ("sms", "email"):
        channel = "sms"
    body = str(message.get("body") or "")[:120]
    to_addr = str(message.get("to") or "")
    summary = f"{channel.upper()} to {to_addr}: {body}".strip()
    return {
        "id": _new_event_id(),
        "channel": channel,
        "at": str(message.get("sent_at") or datetime.now(timezone.utc).isoformat()),
        "summary": summary,
        "workflow_run_id": workflow_run_id,
        "call_id": call_id,
        "workflow_id": None,
        "workflow_name": None,
        "catalog_slug": None,
        "ref_id": str(message.get("id") or ""),
        "status": str(message.get("status") or "sent"),
    }


def list_events(
    store: dict[str, Any],
    *,
    channel: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    events = normalize_timeline(store)["events"]
    if channel and channel != "all":
        events = [e for e in events if str(e.get("channel")) == channel]
    return events[: max(1, min(limit, MAX_EVENTS))]
