"""Persist customer follow-ups on workflow run annotations."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from api.schemas.analytics_call_review import FollowUpActionType, FollowUpStatus

ANNOT_KEY_FOLLOW_UPS = "analytics_follow_ups"
ANNOT_KEY_AI_REVIEW = "analytics_ai_review"


def list_follow_ups(annotations: dict[str, Any] | None) -> list[dict[str, Any]]:
    ann = annotations or {}
    raw = ann.get(ANNOT_KEY_FOLLOW_UPS)
    return list(raw) if isinstance(raw, list) else []


def append_follow_up(
    annotations: dict[str, Any] | None,
    *,
    action_type: FollowUpActionType,
    notes: str,
    scheduled_at: str | None,
    contact_hint: str | None,
    user_id: int | None,
    suggested_message: str | None = None,
    requires_review: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": f"fu-{uuid.uuid4().hex[:12]}",
        "action_type": action_type,
        "status": "pending",
        "notes": notes.strip(),
        "scheduled_at": scheduled_at,
        "contact_hint": (contact_hint or "").strip() or None,
        "suggested_message": (suggested_message or "").strip() or None,
        "requires_review": bool(requires_review or suggested_message),
        "created_at": now,
        "updated_at": None,
        "created_by_user_id": user_id,
    }
    ann = dict(annotations or {})
    items = list_follow_ups(ann)
    items.append(item)
    ann[ANNOT_KEY_FOLLOW_UPS] = items
    return ann, item


def update_follow_up(
    annotations: dict[str, Any] | None,
    follow_up_id: str,
    *,
    status: FollowUpStatus | None = None,
    notes: str | None = None,
    suggested_message: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    ann = dict(annotations or {})
    items = list_follow_ups(ann)
    idx = next((i for i, row in enumerate(items) if row.get("id") == follow_up_id), None)
    if idx is None:
        return ann, None
    row = dict(items[idx])
    if status is not None:
        row["status"] = status
    if notes is not None:
        row["notes"] = notes.strip()
    if suggested_message is not None:
        row["suggested_message"] = suggested_message.strip() or None
        row["requires_review"] = True
    row["updated_at"] = datetime.now(timezone.utc).isoformat()
    items[idx] = row
    ann[ANNOT_KEY_FOLLOW_UPS] = items
    return ann, row


def is_inbox_pending(item: dict[str, Any]) -> bool:
    status = str(item.get("status") or "pending")
    if status != "pending":
        return False
    return bool(item.get("requires_review")) or bool(item.get("suggested_message"))


def get_cached_ai_review(annotations: dict[str, Any] | None) -> dict[str, Any] | None:
    ann = annotations or {}
    raw = ann.get(ANNOT_KEY_AI_REVIEW)
    return raw if isinstance(raw, dict) else None


def set_cached_ai_review(annotations: dict[str, Any] | None, review: dict[str, Any]) -> dict[str, Any]:
    ann = dict(annotations or {})
    ann[ANNOT_KEY_AI_REVIEW] = review
    return ann
