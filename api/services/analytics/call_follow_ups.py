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
) -> tuple[dict[str, Any], dict[str, Any]]:
    item = {
        "id": f"fu-{uuid.uuid4().hex[:12]}",
        "action_type": action_type,
        "status": "pending",
        "notes": notes.strip(),
        "scheduled_at": scheduled_at,
        "contact_hint": (contact_hint or "").strip() or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_user_id": user_id,
    }
    ann = dict(annotations or {})
    items = list_follow_ups(ann)
    items.append(item)
    ann[ANNOT_KEY_FOLLOW_UPS] = items
    return ann, item


def get_cached_ai_review(annotations: dict[str, Any] | None) -> dict[str, Any] | None:
    ann = annotations or {}
    raw = ann.get(ANNOT_KEY_AI_REVIEW)
    return raw if isinstance(raw, dict) else None


def set_cached_ai_review(annotations: dict[str, Any] | None, review: dict[str, Any]) -> dict[str, Any]:
    ann = dict(annotations or {})
    ann[ANNOT_KEY_AI_REVIEW] = review
    return ann
