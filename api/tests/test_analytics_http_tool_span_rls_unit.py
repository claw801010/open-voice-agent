"""Unit tests for analytics span-table RLS session helper (no DB)."""

from unittest.mock import AsyncMock

import pytest

from api.db.analytics_http_tool_span_rls import set_analytics_http_tool_span_rls_org


@pytest.mark.asyncio
async def test_set_analytics_http_tool_span_rls_org_uses_set_config_local():
    session = AsyncMock()
    await set_analytics_http_tool_span_rls_org(session, 42)
    session.execute.assert_called_once()
    args, kwargs = session.execute.call_args
    sql = args[0]
    params = args[1] if len(args) > 1 else kwargs
    assert "set_config" in str(sql).lower()
    assert params["name"] == "app.current_organization_id"
    assert params["value"] == "42"
