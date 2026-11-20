"""Unit tests for self-improvement proposal rollup."""

from api.services.analytics.self_improvement_rollup import rollup_pending_proposals
from api.services.analytics.self_improvement_store import append_proposal, empty_store


def test_merges_duplicate_pending_proposals():
    store = empty_store()
    text = "Reword the greeting to sound warmer and more natural."
    for i in range(3):
        store = append_proposal(
            store,
            {
                "id": f"ip-{i}",
                "status": "pending",
                "title": "Tone",
                "text": text,
                "category": "phrasing_tone",
                "risk_tier": "low",
                "workflow_id": 9,
                "created_at": f"2026-06-27T12:00:0{i}+00:00",
            },
        )
    updated, stats = rollup_pending_proposals(store)
    assert stats["duplicates_removed"] == 2
    assert stats["pending_after"] == 1
    pending = [p for p in updated["proposals"] if p["status"] == "pending"]
    assert pending[0]["supporting_calls"] == 3


def test_leaves_non_pending_untouched():
    store = append_proposal(
        empty_store(),
        {"id": "ip-a", "status": "approved", "text": "x", "category": "unknown", "workflow_id": 1},
    )
    store = append_proposal(
        store,
        {"id": "ip-b", "status": "pending", "text": "unique text here", "category": "unknown", "workflow_id": 1},
    )
    updated, stats = rollup_pending_proposals(store)
    assert stats["pending_after"] == 1
    assert len([p for p in updated["proposals"] if p["status"] == "approved"]) == 1
