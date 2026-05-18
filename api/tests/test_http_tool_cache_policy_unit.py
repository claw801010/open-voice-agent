"""Unit tests: http_tool_cache_policy stored preference parsing (no DB)."""

from api.services.workflow.tools import http_tool_cache_policy as m


def test_parse_stored_defaults_for_garbage():
    prefs = m.parse_stored_http_cache_policy_preferences(None)
    assert prefs["cache_enabled_when_shipped"] is False
    assert prefs["ttl_seconds"] is None
    assert prefs["integration_overrides"] == []
    prefs2 = m.parse_stored_http_cache_policy_preferences("x")
    assert prefs2["cache_enabled_when_shipped"] is False
    assert prefs2["integration_overrides"] == []


def test_parse_stored_coerces_invalid_ttl_to_none():
    raw = {"v": 1, "cache_enabled_when_shipped": True, "ttl_seconds": 10}
    prefs = m.parse_stored_http_cache_policy_preferences(raw)
    assert prefs["cache_enabled_when_shipped"] is True
    assert prefs["ttl_seconds"] is None
    assert prefs["integration_overrides"] == []


def test_parse_stored_accepts_valid_ttl():
    raw = {"v": 1, "cache_enabled_when_shipped": False, "ttl_seconds": 3600}
    prefs = m.parse_stored_http_cache_policy_preferences(raw)
    assert prefs["ttl_seconds"] == 3600
    assert prefs["integration_overrides"] == []


def test_coerce_response_storage_mode_defaults():
    assert m.coerce_response_storage_mode(None) == "live_only"
    assert m.coerce_response_storage_mode("") == "live_only"


def test_coerce_response_storage_mode_org_cache():
    assert m.coerce_response_storage_mode("org_cache_when_enabled") == "org_cache_when_enabled"


def test_coerce_response_storage_mode_unknown_to_live_only():
    assert m.coerce_response_storage_mode("invalid") == "live_only"
    assert m.coerce_response_storage_mode(1) == "live_only"


def test_normalize_stored_round_trip():
    doc = m.normalize_stored_http_cache_policy_document(True, 120)
    assert doc["v"] == 1
    assert doc["cache_enabled_when_shipped"] is True
    assert doc["ttl_seconds"] == 120
    assert doc["integration_overrides"] == []
    parsed = m.parse_stored_http_cache_policy_preferences(doc)
    assert parsed["cache_enabled_when_shipped"] is True
    assert parsed["ttl_seconds"] == 120
    assert parsed["integration_overrides"] == []


def test_normalize_integration_overrides_dedupes_and_sorts():
    raw = [
        {"integration_id": "b", "cache_enabled_when_shipped": True, "pii_handling": "block_cached_store"},
        {"integration_id": "a", "ttl_seconds": 3600},
        {"integration_id": "b", "cache_enabled_when_shipped": False},
    ]
    out = m.normalize_integration_cache_overrides(raw)
    assert [x["integration_id"] for x in out] == ["a", "b"]
    assert out[1]["cache_enabled_when_shipped"] is False
    # Last row for `b` wins; it omits `pii_handling`, so default applies.
    assert out[1]["pii_handling"] == "allow_with_redaction"
    assert out[0]["ttl_seconds"] == 3600


def test_merge_appends_audit_when_prefs_change():
    doc = m.merge_http_cache_policy_document_with_audit(
        None, True, 120, actor_provider_id="actor-1", integration_overrides=[]
    )
    assert doc["cache_enabled_when_shipped"] is True
    assert doc["ttl_seconds"] == 120
    assert len(doc["policy_audit"]) == 1
    assert doc["policy_audit"][0]["actor_provider_id"] == "actor-1"
    assert doc["policy_audit"][0]["cache_enabled_when_shipped"] is True


def test_merge_skips_audit_when_prefs_unchanged():
    prev = m.merge_http_cache_policy_document_with_audit(
        None, True, 120, actor_provider_id="a", integration_overrides=[]
    )
    again = m.merge_http_cache_policy_document_with_audit(
        prev, True, 120, actor_provider_id="b", integration_overrides=[]
    )
    assert len(again["policy_audit"]) == 1


def test_merge_appends_audit_when_only_overrides_change():
    # Seed org prefs change so an audit row exists; then change only overrides.
    prev = m.merge_http_cache_policy_document_with_audit(
        None, True, None, actor_provider_id="a", integration_overrides=[]
    )
    assert len(prev["policy_audit"]) == 1
    again = m.merge_http_cache_policy_document_with_audit(
        prev,
        True,
        None,
        actor_provider_id="b",
        integration_overrides=[
            {"integration_id": "conn-1", "cache_enabled_when_shipped": True, "pii_handling": "allow_with_redaction"}
        ],
    )
    assert len(again["policy_audit"]) == 2
    assert again["policy_audit"][-1].get("integration_overrides_count") == 1


def test_parse_policy_audit_filters_invalid_rows():
    raw = {
        "cache_enabled_when_shipped": True,
        "policy_audit": [
            {"ts": "2026-01-01T00:00:00Z", "actor_provider_id": "u1", "cache_enabled_when_shipped": False},
            {"bad": True},
        ],
    }
    audit = m.parse_stored_http_cache_policy_audit(raw)
    assert len(audit) == 1
    assert audit[0]["actor_provider_id"] == "u1"
