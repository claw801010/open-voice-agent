"""Unit tests for self-improvement org store helpers."""

from api.services.analytics.self_improvement_store import (
    append_proposal,
    auto_apply_stats_for_today,
    count_supporting_calls,
    empty_store,
    find_proposal,
    list_proposals_by_status,
    normalize_store,
    record_auto_apply,
    update_proposal,
)


def test_normalize_empty():
    store = normalize_store(None)
    assert store["v"] == 1
    assert store["proposals"] == []


def test_append_and_find():
    store = empty_store()
    row = {"id": "ip-abc", "status": "pending", "category": "phrasing_tone"}
    store = append_proposal(store, row)
    assert find_proposal(store, "ip-abc") is not None
    assert len(list_proposals_by_status(store, "pending")) == 1


def test_update_proposal():
    store = append_proposal(empty_store(), {"id": "ip-x", "status": "pending"})
    store, updated = update_proposal(store, "ip-x", {"status": "approved"})
    assert updated["status"] == "approved"


def test_count_supporting_calls_minimum_one():
    store = empty_store()
    assert count_supporting_calls(store, "phrasing_tone") == 1


def test_auto_apply_stats_reset_on_new_day():
    store = empty_store()
    store = record_auto_apply(store)
    count, _ = auto_apply_stats_for_today(store)
    assert count == 1
