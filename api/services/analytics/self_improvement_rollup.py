"""Dedupe and re-evaluate pending self-improvement proposals (MK-01-SELFIMPROVE)."""

from __future__ import annotations

import re
from typing import Any

from api.services.analytics.self_improvement_policy import (
    ImprovementProposal,
    evaluate_proposal,
    resolve_effective_policy,
)
from api.services.analytics.self_improvement_store import (
    auto_apply_stats_for_today,
    normalize_store,
)


def _dedup_key(row: dict[str, Any]) -> str:
    text = str(row.get("text") or "").lower()
    text = re.sub(r"\s+", " ", text).strip()[:96]
    wf = row.get("workflow_id")
    cat = str(row.get("category") or "unknown")
    return f"{wf}|{cat}|{text}"


def rollup_pending_proposals(store: dict[str, Any]) -> tuple[dict[str, Any], dict[str, int]]:
    """Merge duplicate pending proposals; return updated store + stats."""
    out = normalize_store(store)
    pending = [r for r in out["proposals"] if r.get("status") == "pending"]
    other = [r for r in out["proposals"] if r.get("status") != "pending"]

    merged: dict[str, dict[str, Any]] = {}
    duplicates_removed = 0
    for row in pending:
        key = _dedup_key(row)
        if key not in merged:
            merged[key] = dict(row)
            merged[key]["supporting_calls"] = 1
            continue
        duplicates_removed += 1
        existing = merged[key]
        existing["supporting_calls"] = int(existing.get("supporting_calls") or 1) + 1
        # Keep newest created_at
        if str(row.get("created_at") or "") > str(existing.get("created_at") or ""):
            existing["created_at"] = row.get("created_at")
            existing["call_id"] = row.get("call_id")
            existing["recommendation_index"] = row.get("recommendation_index")

    rolled = list(merged.values())
    stats = {
        "pending_before": len(pending),
        "pending_after": len(rolled),
        "duplicates_removed": duplicates_removed,
        "re_evaluated_auto_apply": 0,
    }

    effective = resolve_effective_policy(out.get("policy_overrides"))
    if effective.mode in ("auto_with_queue", "full_auto"):
        auto_today, hours_since = auto_apply_stats_for_today(out)
        for idx, row in enumerate(rolled):
            supporting = int(row.get("supporting_calls") or 1)
            decision = evaluate_proposal(
                ImprovementProposal(
                    text=str(row.get("text") or ""),
                    title=str(row.get("title") or ""),
                    confidence=0.85,
                    supporting_calls=supporting,
                    quality_score=None,
                    auto_applies_today=auto_today,
                    hours_since_last_auto_apply=hours_since,
                ),
                policy=effective,
            )
            rolled[idx] = {
                **row,
                "category": decision.category,
                "risk_tier": decision.risk_tier,
                "requires_human": decision.requires_human,
                "auto_eligible": decision.auto_eligible,
                "decision": decision.decision,
                "reasons": decision.reasons,
            }
            if decision.decision == "auto_apply":
                stats["re_evaluated_auto_apply"] += 1

    out["proposals"] = rolled + other
    return out, stats
