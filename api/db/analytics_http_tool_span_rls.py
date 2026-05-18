"""Session-local Postgres setting for ``analytics_http_tool_spans`` RLS."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_ANALYTICS_HTTP_TOOL_SPAN_RLS_SETTING = "app.current_organization_id"


async def set_analytics_http_tool_span_rls_org(
    session: AsyncSession, organization_id: int
) -> None:
    """Restrict span-table visibility to ``organization_id`` for this transaction.

    Policies on ``analytics_http_tool_spans`` compare ``organization_id`` to
    ``current_setting('app.current_organization_id', true)::integer``.
    Superuser and BYPASSRLS roles ignore RLS (common in local dev).
    """
    await session.execute(
        text("SELECT set_config(:name, :value, true)"),
        {
            "name": _ANALYTICS_HTTP_TOOL_SPAN_RLS_SETTING,
            "value": str(int(organization_id)),
        },
    )
