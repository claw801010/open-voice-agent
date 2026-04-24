"""Integration tests: GET daily and weekly usage rollups (org + per-workflow), auth and org scope."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import update

from api.db.models import OrganizationModel, UserModel, WorkflowRunModel
from api.enums import CallType

_MIN_GRAPH = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {"id": "2", "type": "endCall", "data": {"name": "End", "prompt": "Bye"}},
    ],
    "edges": [{"id": "e1", "source": "1", "target": "2", "data": {"label": "End"}}],
}


@pytest.fixture
async def org_user_usage_rollup(async_session):
    org = OrganizationModel(provider_id="test-usage-daily-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-usage-daily-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.fixture
async def user_no_org(async_session):
    user = UserModel(provider_id="test-usage-daily-user-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()
    return user


@pytest.mark.asyncio
async def test_org_daily_rollup_requires_organization(test_client_factory, user_no_org):
    user = user_no_org
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/usage/daily-rollup")
    assert res.status_code == 400
    assert "organization" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_org_daily_rollup_rejects_incomplete_date_range(test_client_factory, org_user_usage_rollup):
    _, user = org_user_usage_rollup
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/usage/daily-rollup?since=2025-01-01")
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_org_daily_rollup_rejects_days_over_max(test_client_factory, org_user_usage_rollup):
    _, user = org_user_usage_rollup
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/usage/daily-rollup?days=91")
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_org_daily_rollup_fixed_range_counts_runs(
    test_client_factory, db_session, org_user_usage_rollup, async_session
):
    org, user = org_user_usage_rollup
    wf = await db_session.create_workflow(
        name="Daily rollup WF",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    r1 = await db_session.create_workflow_run(
        "run-a",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.INBOUND,
    )
    r2 = await db_session.create_workflow_run(
        "run-b",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.OUTBOUND,
    )
    await async_session.execute(
        update(WorkflowRunModel)
        .where(WorkflowRunModel.id == r1.id)
        .values(created_at=datetime(2025, 3, 10, 14, 0, 0, tzinfo=timezone.utc))
    )
    await async_session.execute(
        update(WorkflowRunModel)
        .where(WorkflowRunModel.id == r2.id)
        .values(created_at=datetime(2025, 3, 12, 9, 30, 0, tzinfo=timezone.utc))
    )
    await async_session.flush()

    async with test_client_factory(user) as client:
        res = await client.get(
            "/api/v1/organizations/usage/daily-rollup?since=2025-03-10&until=2025-03-12",
        )
    assert res.status_code == 200
    data = res.json()
    assert "buckets" in data
    by_day = {b["day_start"]: b for b in data["buckets"]}
    assert by_day["2025-03-10"]["run_count"] == 1
    assert by_day["2025-03-10"]["runs_inbound"] == 1
    assert by_day["2025-03-10"]["runs_outbound"] == 0
    assert by_day["2025-03-12"]["run_count"] == 1
    assert by_day["2025-03-12"]["runs_outbound"] == 1


@pytest.mark.asyncio
async def test_workflow_daily_rollup_404_when_workflow_not_in_org(
    test_client_factory, db_session, org_user_usage_rollup, async_session
):
    org, user = org_user_usage_rollup
    other = OrganizationModel(provider_id="test-usage-daily-org-other")
    async_session.add(other)
    await async_session.flush()
    other_user = UserModel(provider_id="test-usage-daily-other-owner", selected_organization_id=other.id)
    async_session.add(other_user)
    await async_session.flush()
    foreign_wf = await db_session.create_workflow(
        name="Foreign WF",
        workflow_definition=_MIN_GRAPH,
        user_id=other_user.id,
        organization_id=other.id,
    )

    async with test_client_factory(user) as client:
        res = await client.get(
            f"/api/v1/workflow/{foreign_wf.id}/usage/daily-rollup?since=2025-01-01&until=2025-01-02",
        )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_workflow_daily_rollup_scoped_to_workflow(
    test_client_factory, db_session, org_user_usage_rollup, async_session
):
    org, user = org_user_usage_rollup
    wf_a = await db_session.create_workflow(
        name="WF A",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    wf_b = await db_session.create_workflow(
        name="WF B",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    ra = await db_session.create_workflow_run(
        "a1", wf_a.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )
    rb = await db_session.create_workflow_run(
        "b1", wf_b.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )
    await async_session.execute(
        update(WorkflowRunModel)
        .where(WorkflowRunModel.id == ra.id)
        .values(created_at=datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc))
    )
    await async_session.execute(
        update(WorkflowRunModel)
        .where(WorkflowRunModel.id == rb.id)
        .values(created_at=datetime(2025, 6, 1, 13, 0, 0, tzinfo=timezone.utc))
    )
    await async_session.flush()

    async with test_client_factory(user) as client:
        res = await client.get(
            f"/api/v1/workflow/{wf_a.id}/usage/daily-rollup?since=2025-06-01&until=2025-06-01",
        )
    assert res.status_code == 200
    buckets = res.json()["buckets"]
    assert len(buckets) == 1
    assert buckets[0]["day_start"] == "2025-06-01"
    assert buckets[0]["run_count"] == 1


# --- Weekly rollup (parity with daily route tests) ---


@pytest.mark.asyncio
async def test_org_weekly_rollup_requires_organization(test_client_factory, user_no_org):
    user = user_no_org
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/usage/weekly-rollup")
    assert res.status_code == 400
    assert "organization" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_org_weekly_rollup_rejects_incomplete_date_range(test_client_factory, org_user_usage_rollup):
    _, user = org_user_usage_rollup
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/usage/weekly-rollup?until=2025-01-31")
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_org_weekly_rollup_rejects_weeks_over_max(test_client_factory, org_user_usage_rollup):
    _, user = org_user_usage_rollup
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/usage/weekly-rollup?weeks=53")
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_org_weekly_rollup_fixed_range_counts_runs(
    test_client_factory, db_session, org_user_usage_rollup, async_session
):
    """UTC ISO weeks: two runs in week of 2025-03-10, one run in week of 2025-03-17."""
    org, user = org_user_usage_rollup
    wf = await db_session.create_workflow(
        name="Weekly rollup WF",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    r1 = await db_session.create_workflow_run(
        "w1", wf.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )
    r2 = await db_session.create_workflow_run(
        "w2", wf.id, "smallwebrtc", user.id, call_type=CallType.OUTBOUND
    )
    r3 = await db_session.create_workflow_run(
        "w3", wf.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )
    await async_session.execute(
        update(WorkflowRunModel)
        .where(WorkflowRunModel.id == r1.id)
        .values(created_at=datetime(2025, 3, 10, 10, 0, 0, tzinfo=timezone.utc))
    )
    await async_session.execute(
        update(WorkflowRunModel)
        .where(WorkflowRunModel.id == r2.id)
        .values(created_at=datetime(2025, 3, 11, 15, 0, 0, tzinfo=timezone.utc))
    )
    await async_session.execute(
        update(WorkflowRunModel)
        .where(WorkflowRunModel.id == r3.id)
        .values(created_at=datetime(2025, 3, 20, 12, 0, 0, tzinfo=timezone.utc))
    )
    await async_session.flush()

    async with test_client_factory(user) as client:
        res = await client.get(
            "/api/v1/organizations/usage/weekly-rollup?since=2025-03-10&until=2025-03-23",
        )
    assert res.status_code == 200
    data = res.json()
    by_week = {b["week_start"]: b for b in data["buckets"]}
    assert by_week["2025-03-10"]["run_count"] == 2
    assert by_week["2025-03-10"]["runs_inbound"] == 1
    assert by_week["2025-03-10"]["runs_outbound"] == 1
    assert by_week["2025-03-17"]["run_count"] == 1
    assert by_week["2025-03-17"]["runs_inbound"] == 1


@pytest.mark.asyncio
async def test_workflow_weekly_rollup_404_when_workflow_not_in_org(
    test_client_factory, db_session, org_user_usage_rollup, async_session
):
    org, user = org_user_usage_rollup
    other = OrganizationModel(provider_id="test-usage-weekly-org-other")
    async_session.add(other)
    await async_session.flush()
    other_user = UserModel(provider_id="test-usage-weekly-other-owner", selected_organization_id=other.id)
    async_session.add(other_user)
    await async_session.flush()
    foreign_wf = await db_session.create_workflow(
        name="Foreign WF weekly",
        workflow_definition=_MIN_GRAPH,
        user_id=other_user.id,
        organization_id=other.id,
    )

    async with test_client_factory(user) as client:
        res = await client.get(
            f"/api/v1/workflow/{foreign_wf.id}/usage/weekly-rollup?since=2025-01-01&until=2025-01-07",
        )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_workflow_weekly_rollup_scoped_to_workflow(
    test_client_factory, db_session, org_user_usage_rollup, async_session
):
    org, user = org_user_usage_rollup
    wf_a = await db_session.create_workflow(
        name="WF weekly A",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    wf_b = await db_session.create_workflow(
        name="WF weekly B",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    ra1 = await db_session.create_workflow_run(
        "wa1", wf_a.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )
    await db_session.create_workflow_run(
        "wa2", wf_a.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )
    await db_session.create_workflow_run(
        "wb1", wf_b.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )
    week_start = datetime(2025, 7, 7, 8, 0, 0, tzinfo=timezone.utc)  # Monday UTC
    await async_session.execute(
        update(WorkflowRunModel).where(WorkflowRunModel.workflow_id == wf_a.id).values(created_at=week_start)
    )
    await async_session.execute(
        update(WorkflowRunModel).where(WorkflowRunModel.workflow_id == wf_b.id).values(created_at=week_start)
    )
    await async_session.flush()

    async with test_client_factory(user) as client:
        res = await client.get(
            f"/api/v1/workflow/{wf_a.id}/usage/weekly-rollup?since=2025-07-07&until=2025-07-13",
        )
    assert res.status_code == 200
    buckets = res.json()["buckets"]
    assert len(buckets) == 1
    assert buckets[0]["week_start"] == "2025-07-07"
    assert buckets[0]["run_count"] == 2
