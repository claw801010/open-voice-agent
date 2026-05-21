"""Redis-backed HTTP tool response cache — WE-01-DATASTORE-INTEG runtime (v1)."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any

from loguru import logger

_CACHE_PREFIX = "http_tool_cache:v1:"
_DEFAULT_TTL_SECONDS = 3600
_SENSITIVE_KEY_RE = re.compile(
    r"(password|secret|token|api[_-]?key|authorization|ssn|email|phone|"
    r"credit|card|patient|mrn|dob|birth)",
    re.I,
)

_redis_client: Any | None = None


@dataclass(frozen=True)
class RuntimeCacheDecision:
    """Whether this HTTP tool request may use read-through / write-through cache."""

    enabled: bool
    ttl_seconds: int = _DEFAULT_TTL_SECONDS
    redact_before_store: bool = True


def resolve_runtime_cache_decision(
    stored_prefs: dict[str, Any],
    storage_mode: str,
    integration_id: str | None = None,
) -> RuntimeCacheDecision:
    """Honor org draft policy + tool ``response_storage_mode``."""
    from api.services.workflow.tools.http_tool_cache_policy import (
        coerce_response_storage_mode,
    )

    if coerce_response_storage_mode(storage_mode) != "org_cache_when_enabled":
        return RuntimeCacheDecision(enabled=False)
    if not stored_prefs.get("cache_enabled_when_shipped"):
        return RuntimeCacheDecision(enabled=False)

    ttl = stored_prefs.get("ttl_seconds")
    ttl_seconds = ttl if isinstance(ttl, int) and ttl >= 60 else _DEFAULT_TTL_SECONDS
    pii_handling = "allow_with_redaction"

    if integration_id:
        for row in stored_prefs.get("integration_overrides") or []:
            if not isinstance(row, dict):
                continue
            if row.get("integration_id") != integration_id:
                continue
            if not row.get("cache_enabled_when_shipped"):
                return RuntimeCacheDecision(enabled=False)
            row_ttl = row.get("ttl_seconds")
            if isinstance(row_ttl, int) and row_ttl >= 60:
                ttl_seconds = row_ttl
            ph = row.get("pii_handling")
            if ph in ("allow_with_redaction", "block_cached_store"):
                pii_handling = ph
            break

    if pii_handling == "block_cached_store":
        return RuntimeCacheDecision(enabled=False)

    return RuntimeCacheDecision(
        enabled=True,
        ttl_seconds=ttl_seconds,
        redact_before_store=True,
    )


def redact_payload_for_cache(value: Any) -> Any:
    """Shallow redaction of obvious PII fields before persisting cached JSON."""
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            key = str(k)
            if _SENSITIVE_KEY_RE.search(key):
                out[key] = "[redacted]"
            else:
                out[key] = redact_payload_for_cache(v)
        return out
    if isinstance(value, list):
        return [redact_payload_for_cache(item) for item in value]
    if isinstance(value, str) and len(value) > 256:
        return value[:256] + "…"
    return value


def build_cache_key(
    *,
    organization_id: int,
    tool_uuid: str,
    method: str,
    url: str,
    headers: dict[str, str],
    body: Any,
    params: Any,
) -> str:
    """Stable key for identical resolved HTTP requests within an org + tool."""
    canonical = {
        "org": organization_id,
        "tool": tool_uuid,
        "method": method.upper(),
        "url": url,
        "headers": {k: headers[k] for k in sorted(headers)},
        "body": body,
        "params": params,
    }
    digest = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()
    return f"{_CACHE_PREFIX}{digest}"


async def _redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    import redis.asyncio as aioredis

    from api.constants import REDIS_URL

    _redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


async def get_cached_http_response(cache_key: str) -> dict[str, Any] | None:
    try:
        client = await _redis()
        raw = await client.get(cache_key)
        if not raw:
            return None
        parsed = json.loads(raw)
        if isinstance(parsed, dict) and parsed.get("status") == "success":
            return parsed
    except Exception as e:
        logger.warning("HTTP tool cache read failed (live fallback): {}", e)
    return None


async def store_cached_http_response(
    cache_key: str,
    payload: dict[str, Any],
    *,
    ttl_seconds: int,
    redact: bool,
) -> None:
    try:
        to_store = dict(payload)
        if redact and isinstance(to_store.get("data"), (dict, list)):
            to_store["data"] = redact_payload_for_cache(to_store["data"])
        client = await _redis()
        await client.setex(
            cache_key,
            max(60, int(ttl_seconds)),
            json.dumps(to_store, default=str),
        )
    except Exception as e:
        logger.warning("HTTP tool cache write failed (non-fatal): {}", e)
