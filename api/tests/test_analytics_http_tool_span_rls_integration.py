"""Postgres RLS on analytics_http_tool_spans for non-superuser roles (MK-01 Phase D).

Superuser and BYPASSRLS bypass RLS; typical local pytest uses a superuser DB URL.
We create a dedicated role (NOBYPASSRLS) and ``SET ROLE`` so policies are enforced,
matching production behavior described in READMEPLANTOEXECUTE (non-superuser RLS CI).
"""

import pytest
from sqlalchemy import select, text

from api.db.analytics_http_tool_span_rls import set_analytics_http_tool_span_rls_org
from api.db.models import AnalyticsHttpToolSpanModel, OrganizationModel, UserModel
from api.enums import CallType

_MIN_GRAPH = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {"id": "2", "type": "endCall", "data": {"name": "End", "prompt": "Bye"}},
    ],
    "edges": [{"id": "e1", "source": "1", "target": "2", "data": {"label": "End"}}],
}

_ANALYTICS_HTTP_TOOL_SPAN_RLS_CI_ROLE = "analytics_http_tool_span_rls_ci"


@pytest.fixture(scope="session")
async def ensure_analytics_http_tool_span_rls_ci_role(test_engine):
    """Role used with SET ROLE so FORCE ROW LEVEL SECURITY applies in tests."""
    role = _ANALYTICS_HTTP_TOOL_SPAN_RLS_CI_ROLE
    async with test_engine.begin() as conn:
        await conn.execute(
            text(
                f"""
                DO $rls$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_catalog.pg_roles
                    WHERE rolname = '{role}'
                  ) THEN
                    CREATE ROLE {role}
                      NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOLOGIN;
                  END IF;
                END
                $rls$;
                """
            )
        )
        await conn.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
        await conn.execute(
            text(f"GRANT SELECT ON TABLE public.analytics_http_tool_spans TO {role}")
        )
    return role


@pytest.mark.asyncio
async def test_span_rls_ci_role_sees_only_rows_for_current_org_guc(
    async_session,
    db_session,
    ensure_analytics_http_tool_span_rls_ci_role,
):
    role = ensure_analytics_http_tool_span_rls_ci_role

    org1 = OrganizationModel(provider_id="test-span-rls-org-a")
    org2 = OrganizationModel(provider_id="test-span-rls-org-b")
    async_session.add(org1)
    async_session.add(org2)
    await async_session.flush()

    user1 = UserModel(
        provider_id="test-span-rls-user-a", selected_organization_id=org1.id
    )
    user2 = UserModel(
        provider_id="test-span-rls-user-b", selected_organization_id=org2.id
    )
    async_session.add(user1)
    async_session.add(user2)
    await async_session.flush()

    wf1 = await db_session.create_workflow(
        name="RLS WF org1",
        workflow_definition=_MIN_GRAPH,
        user_id=user1.id,
        organization_id=org1.id,
    )
    wf2 = await db_session.create_workflow(
        name="RLS WF org2",
        workflow_definition=_MIN_GRAPH,
        user_id=user2.id,
        organization_id=org2.id,
    )
    await async_session.flush()

    run1 = await db_session.create_workflow_run(
        "rls-run-1",
        wf1.id,
        "smallwebrtc",
        user1.id,
        call_type=CallType.INBOUND,
    )
    run2 = await db_session.create_workflow_run(
        "rls-run-2",
        wf2.id,
        "smallwebrtc",
        user2.id,
        call_type=CallType.INBOUND,
    )
    async_session.add(
        AnalyticsHttpToolSpanModel(
            organization_id=org1.id,
            workflow_id=wf1.id,
            workflow_run_id=run1.id,
            span_id="rls-span-org1",
            tool_name="t1",
            tool_type="http_api",
            duration_ms=1,
            http_summary=None,
        )
    )
    async_session.add(
        AnalyticsHttpToolSpanModel(
            organization_id=org2.id,
            workflow_id=wf2.id,
            workflow_run_id=run2.id,
            span_id="rls-span-org2",
            tool_name="t2",
            tool_type="http_api",
            duration_ms=1,
            http_summary=None,
        )
    )
    await async_session.flush()

    await async_session.execute(text(f"SET ROLE {role}"))
    try:
        await set_analytics_http_tool_span_rls_org(async_session, org1.id)
        q = await async_session.execute(
            select(AnalyticsHttpToolSpanModel).order_by(
                AnalyticsHttpToolSpanModel.id
            )
        )
        visible = q.scalars().all()
        assert len(visible) == 1
        assert visible[0].organization_id == org1.id
        assert visible[0].span_id == "rls-span-org1"

        await set_analytics_http_tool_span_rls_org(async_session, org2.id)
        q2 = await async_session.execute(
            select(AnalyticsHttpToolSpanModel).order_by(
                AnalyticsHttpToolSpanModel.id
            )
        )
        visible2 = q2.scalars().all()
        assert len(visible2) == 1
        assert visible2[0].organization_id == org2.id
        assert visible2[0].span_id == "rls-span-org2"
    finally:
        await async_session.execute(text("RESET ROLE"))
