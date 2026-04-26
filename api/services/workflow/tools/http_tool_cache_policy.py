"""HTTP tool integration response cache — WE-01-DATASTORE-INTEG extension point.

Today: every HTTP tool call is a live request; nothing here reads or writes a cache.

When org-admin–controlled integration caching ships, centralize policy checks
(TTL, PII class, which integration) in this module and call from
``execute_http_request`` in ``custom_tool.py``.
"""

from __future__ import annotations

import os

from loguru import logger

_TRUTHY = frozenset({"1", "true", "yes", "on"})

_warned_misconfigured: bool = False


def integration_response_cache_enabled() -> bool:
    """Return True only when env requests cache (feature not implemented yet)."""
    raw = os.environ.get("HTTP_TOOL_INTEGRATION_CACHE_ENABLED", "")
    return raw.strip().lower() in _TRUTHY


def warn_if_cache_env_misconfigured() -> None:
    """Log at most once if operators set the future flag before runtime exists."""
    global _warned_misconfigured
    if not integration_response_cache_enabled() or _warned_misconfigured:
        return
    _warned_misconfigured = True
    logger.warning(
        "HTTP_TOOL_INTEGRATION_CACHE_ENABLED is true, but WE-01-DATASTORE-INTEG "
        "response caching is not implemented — all HTTP tool calls remain live. "
        "Unset this variable or see product docs (HTTP tool Storage model)."
    )
