"""HTTP tool integration response cache — WE-01-DATASTORE-INTEG extension point.

Today: every HTTP tool call is a live request. **No** response cache or integration-backed
read-through is active in this codebase.

Do **not** add environment toggles here until org policy + persistence are specified in
READMEPLANTOEXECUTE (**WE-01-DATASTORE-INTEG**) and reviewed for compliance.

When the feature ships, centralize TTL / PII class / integration selection in this module
and call from ``execute_http_request`` in ``custom_tool.py``.
"""

from __future__ import annotations

# Explicit status for operators and future code paths.
INTEGRATION_RESPONSE_CACHE_STATUS: str = "not_implemented"

# Planning signal for API + docs (WE-01-DATASTORE-INTEG); revise when shipping or changing boundary.
INTEGRATION_RESPONSE_CACHE_DEFERRAL_NOT_BEFORE: str = "2026-07-01"
