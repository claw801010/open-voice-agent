"""Unit tests: HTTP tool response cache policy + keying (no Redis)."""

import json

from api.services.workflow.tools.http_tool_response_cache import (
    build_cache_key,
    redact_payload_for_cache,
    resolve_runtime_cache_decision,
)


def test_resolve_runtime_cache_requires_org_and_tool_mode():
    prefs = {"cache_enabled_when_shipped": True, "ttl_seconds": 120, "integration_overrides": []}
    off = resolve_runtime_cache_decision(prefs, "live_only")
    assert off.enabled is False
    on = resolve_runtime_cache_decision(prefs, "org_cache_when_enabled")
    assert on.enabled is True
    assert on.ttl_seconds == 120


def test_integration_override_blocks_cache():
    prefs = {
        "cache_enabled_when_shipped": True,
        "ttl_seconds": None,
        "integration_overrides": [
            {
                "integration_id": "conn-1",
                "cache_enabled_when_shipped": False,
                "pii_handling": "allow_with_redaction",
            }
        ],
    }
    d = resolve_runtime_cache_decision(
        prefs, "org_cache_when_enabled", integration_id="conn-1"
    )
    assert d.enabled is False


def test_block_cached_store_pii_disables_cache():
    prefs = {
        "cache_enabled_when_shipped": True,
        "integration_overrides": [
            {
                "integration_id": "conn-2",
                "cache_enabled_when_shipped": True,
                "pii_handling": "block_cached_store",
            }
        ],
    }
    d = resolve_runtime_cache_decision(
        prefs, "org_cache_when_enabled", integration_id="conn-2"
    )
    assert d.enabled is False


def test_build_cache_key_stable():
    k1 = build_cache_key(
        organization_id=1,
        tool_uuid="t-1",
        method="GET",
        url="https://api.example.com/x",
        headers={"A": "1"},
        body=None,
        params={"q": "1"},
    )
    k2 = build_cache_key(
        organization_id=1,
        tool_uuid="t-1",
        method="get",
        url="https://api.example.com/x",
        headers={"A": "1"},
        body=None,
        params={"q": "1"},
    )
    assert k1 == k2
    assert k1.startswith("http_tool_cache:v1:")


def test_redact_payload_for_cache():
    raw = {"email": "a@b.com", "nested": {"api_key": "secret", "ok": 1}}
    out = redact_payload_for_cache(raw)
    assert out["email"] == "[redacted]"
    assert out["nested"]["api_key"] == "[redacted]"
    assert out["nested"]["ok"] == 1
    # round-trip json safe
    json.dumps(out)
