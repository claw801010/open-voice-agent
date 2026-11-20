"""Org-scoped persistence for agent self-improvement queue (MK-01-SELFIMPROVE)."""

from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any

STORE_VERSION = 1
MAX_PROPOSALS = 200


def empty_store() -> dict[str, Any]:
    return {
        "v": STORE_VERSION,
        "policy_overrides": {},
        "proposals": [],
        "auto_apply_stats": {
            "day": _utc_day(),
            "count": 0,
            "last_at": None,
        },
    }


def _utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def normalize_store(raw: Any) -> dict[str, Any]:
    base = empty_store()
    if not isinstance(raw, dict):
        return base
    out = copy.deepcopy(base)
    out["policy_overrides"] = (
        dict(raw["policy_overrides"]) if isinstance(raw.get("policy_overrides"), dict) else {}
    )
    proposals = raw.get("proposals")
    out["proposals"] = [p for p in proposals if isinstance(p, dict)] if isinstance(proposals, list) else []
    stats = raw.get("auto_apply_stats")
    if isinstance(stats, dict):
        out["auto_apply_stats"] = {**base["auto_apply_stats"], **stats}
    return out


def new_proposal_id() -> str:
    return f"ip-{uuid.uuid4().hex[:12]}"


def append_proposal(store: dict[str, Any], proposal: dict[str, Any]) -> dict[str, Any]:
    out = normalize_store(store)
    proposals = list(out["proposals"])
    proposals.insert(0, proposal)
    out["proposals"] = proposals[:MAX_PROPOSALS]
    return out


def find_proposal(store: dict[str, Any], proposal_id: str) -> dict[str, Any] | None:
    for row in normalize_store(store)["proposals"]:
        if row.get("id") == proposal_id:
            return row
    return None


def update_proposal(
    store: dict[str, Any],
    proposal_id: str,
    patch: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    out = normalize_store(store)
    proposals = list(out["proposals"])
    for idx, row in enumerate(proposals):
        if row.get("id") != proposal_id:
            continue
        updated = {**row, **patch}
        proposals[idx] = updated
        out["proposals"] = proposals
        return out, updated
    return out, None


def count_supporting_calls(store: dict[str, Any], category: str) -> int:
    count = 0
    for row in normalize_store(store)["proposals"]:
        if row.get("category") != category:
            continue
        if row.get("status") in ("pending", "approved", "applied", "auto_applied"):
            count += 1
    return max(count, 1)


def auto_apply_stats_for_today(store: dict[str, Any]) -> tuple[int, float | None]:
    stats = normalize_store(store)["auto_apply_stats"]
    day = str(stats.get("day") or "")
    if day != _utc_day():
        return 0, None
    count = int(stats.get("count") or 0)
    last_at = stats.get("last_at")
    hours: float | None = None
    if last_at:
        try:
            last_dt = datetime.fromisoformat(str(last_at).replace("Z", "+00:00"))
            delta = datetime.now(timezone.utc) - last_dt
            hours = delta.total_seconds() / 3600.0
        except ValueError:
            hours = None
    return count, hours


def record_auto_apply(store: dict[str, Any]) -> dict[str, Any]:
    out = normalize_store(store)
    stats = dict(out["auto_apply_stats"])
    today = _utc_day()
    if stats.get("day") != today:
        stats = {"day": today, "count": 0, "last_at": None}
    stats["count"] = int(stats.get("count") or 0) + 1
    stats["last_at"] = datetime.now(timezone.utc).isoformat()
    out["auto_apply_stats"] = stats
    return out


def list_proposals_by_status(store: dict[str, Any], status: str | None = None) -> list[dict[str, Any]]:
    rows = normalize_store(store)["proposals"]
    if not status:
        return list(rows)
    return [r for r in rows if str(r.get("status") or "") == status]
