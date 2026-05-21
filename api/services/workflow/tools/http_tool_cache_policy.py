"""HTTP tool integration response cache — WE-01-DATASTORE-INTEG extension point.

Today: every HTTP tool call is a live request. **No** response cache or integration-backed
read-through is active in this codebase.

Do **not** add environment toggles here until org policy + persistence are specified in
READMEPLANTOEXECUTE (**WE-01-DATASTORE-INTEG**) and reviewed for compliance.

When the feature ships, centralize TTL / PII class / integration selection in this module
and call from ``execute_http_request`` in ``custom_tool.py``.

Runtime read-through / write-through cache is implemented in
``http_tool_response_cache.py`` when org ``cache_enabled_when_shipped`` is true and the tool uses
``org_cache_when_enabled``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

# Explicit status for operators and API/UI.
INTEGRATION_RESPONSE_CACHE_STATUS: str = "shipped_v1"

# Planning signal for API + docs (WE-01-DATASTORE-INTEG); revise when shipping or changing boundary.
INTEGRATION_RESPONSE_CACHE_DEFERRAL_NOT_BEFORE: str = "2026-07-01"

# Bump when `GET /organizations/http-integration-cache-policy` JSON shape changes (clients may cache UI).
HTTP_INTEGRATION_CACHE_POLICY_SCHEMA_VERSION: int = 4

POLICY_AUDIT_MAX_ENTRIES: int = 25

# Stored under OrganizationConfigurationKey.HTTP_INTEGRATION_CACHE_POLICY.value
_HTTP_CACHE_POLICY_STORED_JSON_VERSION: int = 1

_TTL_MIN = 60
_TTL_MAX = 90 * 24 * 3600  # 90 days

_MAX_INTEGRATION_OVERRIDES = 50

ResponseStorageMode = Literal["live_only", "org_cache_when_enabled"]


def coerce_response_storage_mode(raw: Any) -> ResponseStorageMode:
    """Normalize HTTP tool config ``response_storage_mode`` for runtime (WE-01-DATASTORE-INTEG).

    Unknown or missing values default to ``live_only``. Integration cache is not implemented yet;
    callers may log when mode is ``org_cache_when_enabled``.
    """
    if raw == "org_cache_when_enabled":
        return "org_cache_when_enabled"
    return "live_only"


def normalize_stored_http_cache_policy_document(
    cache_enabled_when_shipped: bool,
    ttl_seconds: int | None,
    *,
    integration_overrides: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """JSON blob persisted on the organization (draft prefs only; runtime cache still off)."""
    return {
        "v": _HTTP_CACHE_POLICY_STORED_JSON_VERSION,
        "cache_enabled_when_shipped": cache_enabled_when_shipped,
        "ttl_seconds": ttl_seconds,
        "integration_overrides": normalize_integration_cache_overrides(integration_overrides),
    }


def normalize_integration_cache_overrides(raw: Any) -> list[dict[str, Any]]:
    """Dedupe by ``integration_id`` (Nango connection id); **last** row wins, cap length, stable sort."""
    if not isinstance(raw, list):
        return []
    merged_by_id: dict[str, dict[str, Any]] = {}
    for item in raw[:_MAX_INTEGRATION_OVERRIDES]:
        if not isinstance(item, dict):
            continue
        iid = item.get("integration_id")
        if not isinstance(iid, str) or not iid.strip():
            continue
        key = iid.strip()
        ce = bool(item.get("cache_enabled_when_shipped", False))
        ttl = item.get("ttl_seconds")
        ttl_out: int | None
        if ttl is None:
            ttl_out = None
        elif isinstance(ttl, int) and _TTL_MIN <= ttl <= _TTL_MAX:
            ttl_out = ttl
        else:
            ttl_out = None
        pii: str = item.get("pii_handling") or "allow_with_redaction"
        if pii not in ("allow_with_redaction", "block_cached_store"):
            pii = "allow_with_redaction"
        merged_by_id[key] = {
            "integration_id": key,
            "cache_enabled_when_shipped": ce,
            "ttl_seconds": ttl_out,
            "pii_handling": pii,
        }
    out = list(merged_by_id.values())
    out.sort(key=lambda x: x["integration_id"])
    return out


def _parse_audit_entries(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if not isinstance(item, dict):
            continue
        ts = item.get("ts")
        actor = item.get("actor_provider_id")
        ce = item.get("cache_enabled_when_shipped")
        if not isinstance(ts, str) or not ts.strip():
            continue
        if not isinstance(actor, str) or not actor.strip():
            continue
        if not isinstance(ce, bool):
            continue
        ttl = item.get("ttl_seconds")
        ttl_out: int | None
        if ttl is None:
            ttl_out = None
        elif isinstance(ttl, int) and _TTL_MIN <= ttl <= _TTL_MAX:
            ttl_out = ttl
        else:
            ttl_out = None
        row: dict[str, Any] = {
            "ts": ts.strip(),
            "actor_provider_id": actor.strip(),
            "cache_enabled_when_shipped": ce,
            "ttl_seconds": ttl_out,
        }
        ioc = item.get("integration_overrides_count")
        if isinstance(ioc, int) and ioc >= 0:
            row["integration_overrides_count"] = ioc
        out.append(row)
    return out


def parse_stored_http_cache_policy_audit(raw: Any) -> list[dict[str, Any]]:
    """Return validated audit tail from org configuration JSON (newest last)."""
    if not isinstance(raw, dict):
        return []
    return _parse_audit_entries(raw.get("policy_audit"))


def _overrides_equal(a: list[dict[str, Any]], b: list[dict[str, Any]]) -> bool:
    if len(a) != len(b):
        return False
    for x, y in zip(a, b, strict=True):
        if x != y:
            return False
    return True


def merge_http_cache_policy_document_with_audit(
    prev_raw: Any,
    cache_enabled_when_shipped: bool,
    ttl_seconds: int | None,
    actor_provider_id: str,
    integration_overrides: list[dict[str, Any]],
) -> dict[str, Any]:
    """Persist prefs plus rolling audit when values change vs previous stored prefs."""
    prev_prefs = parse_stored_http_cache_policy_preferences(prev_raw)
    prev_audit = parse_stored_http_cache_policy_audit(prev_raw)
    prev_rows = prev_prefs.get("integration_overrides") or []
    new_rows = normalize_integration_cache_overrides(integration_overrides)

    changed = prev_prefs["cache_enabled_when_shipped"] != cache_enabled_when_shipped or (
        prev_prefs["ttl_seconds"] != ttl_seconds
    )
    changed = changed or not _overrides_equal(prev_rows, new_rows)

    audit = list(prev_audit)
    if changed:
        audit.append(
            {
                "ts": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "actor_provider_id": actor_provider_id,
                "cache_enabled_when_shipped": cache_enabled_when_shipped,
                "ttl_seconds": ttl_seconds,
                "integration_overrides_count": len(new_rows),
            }
        )
    if len(audit) > POLICY_AUDIT_MAX_ENTRIES:
        audit = audit[-POLICY_AUDIT_MAX_ENTRIES:]

    return {
        "v": _HTTP_CACHE_POLICY_STORED_JSON_VERSION,
        "cache_enabled_when_shipped": cache_enabled_when_shipped,
        "ttl_seconds": ttl_seconds,
        "integration_overrides": new_rows,
        "policy_audit": audit,
    }


def parse_stored_http_cache_policy_preferences(raw: Any) -> dict[str, Any]:
    """Coalesce DB JSON into API ``stored_preferences`` (org defaults + integration overrides)."""
    default: dict[str, Any] = {
        "cache_enabled_when_shipped": False,
        "ttl_seconds": None,
        "integration_overrides": [],
    }
    if not isinstance(raw, dict):
        return default.copy()

    ce = raw.get("cache_enabled_when_shipped")
    if isinstance(ce, bool):
        default["cache_enabled_when_shipped"] = ce

    ttl = raw.get("ttl_seconds")
    if ttl is None:
        default["ttl_seconds"] = None
    elif isinstance(ttl, int) and _TTL_MIN <= ttl <= _TTL_MAX:
        default["ttl_seconds"] = ttl
    else:
        default["ttl_seconds"] = None

    default["integration_overrides"] = normalize_integration_cache_overrides(
        raw.get("integration_overrides")
    )

    return default
