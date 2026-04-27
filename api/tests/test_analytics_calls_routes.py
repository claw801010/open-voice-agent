"""Integration tests: GET /api/v1/analytics/calls and call detail."""

import json

import pytest
from sqlalchemy import update

from api.db.models import WorkflowModel
from api.enums import CallType


_MIN_GRAPH = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {"id": "2", "type": "endCall", "data": {"name": "End", "prompt": "Bye"}},
    ],
    "edges": [{"id": "e1", "source": "1", "target": "2", "data": {"label": "End"}}],
}


@pytest.fixture
async def org_user_analytics(async_session):
    from api.db.models import OrganizationModel, UserModel

    org = OrganizationModel(provider_id="test-analytics-calls-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-analytics-calls-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


def _http_tool_log_events():
    http_result = {
        "status": "success",
        "status_code": 200,
        "data": {},
        "mapped_data": {"slot": "10:00"},
    }
    return [
        {
            "type": "rtf-function-call-start",
            "payload": {"function_name": "reserve_time", "tool_call_id": "a1"},
            "timestamp": "2026-04-20T12:00:00+00:00",
        },
        {
            "type": "rtf-function-call-end",
            "payload": {
                "function_name": "reserve_time",
                "tool_call_id": "a1",
                "result": json.dumps(http_result),
            },
            "timestamp": "2026-04-20T12:00:02+00:00",
        },
    ]


@pytest.mark.asyncio
async def test_analytics_calls_requires_org(test_client_factory, async_session):
    from api.db.models import UserModel

    user = UserModel(provider_id="test-analytics-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()

    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/analytics/calls")
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_analytics_calls_list_and_detail(
    test_client_factory, db_session, org_user_analytics, async_session
):
    org, user = org_user_analytics
    wf = await db_session.create_workflow(
        name="Analytics WF",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    await async_session.execute(
        update(WorkflowModel)
        .where(WorkflowModel.id == wf.id)
        .values(
            workflow_configurations={
                "mk01": {
                    "catalog_slug": "healthcare-screening",
                    "installed_at": "2026-04-01",
                }
            }
        )
    )
    await async_session.flush()

    run = await db_session.create_workflow_run(
        "test-run",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.INBOUND,
    )
    await db_session.update_workflow_run(
        run.id,
        gathered_context={
            "mapped_call_disposition": "completed",
            "outcome_key": "booked",
        },
        cost_info={"call_duration_seconds": 45.2},
        logs={"realtime_feedback_events": _http_tool_log_events()},
        is_completed=True,
    )

    async with test_client_factory(user) as client:
        listed = await client.get("/api/v1/analytics/calls?limit=10")
    assert listed.status_code == 200
    body = listed.json()
    assert "items" in body and "next_cursor" in body
    assert len(body["items"]) >= 1
    row = next(x for x in body["items"] if x["call_id"] == f"wr-{run.id}")
    assert row["workflow_id"] == wf.id
    assert row["workflow_slug"] == "healthcare-screening"
    assert row["disposition"] == "completed"
    assert row["outcome_key"] == "booked"
    assert "reserve_time" in row["tool_names"]

    async with test_client_factory(user) as client:
        detail = await client.get(f"/api/v1/analytics/calls/wr-{run.id}")
    assert detail.status_code == 200
    d = detail.json()
    assert d["call_id"] == f"wr-{run.id}"
    assert d["metrics"]["tool_invocation_count"] == 1
    assert len(d["tool_spans"]) == 1
    assert d["tool_spans"][0]["http"]["request_status"] == 200
    assert d["outcomes"]["outcome_key"] == "booked"

    async with test_client_factory(user) as client:
        alt = await client.get(f"/api/v1/analytics/calls/{run.id}")
    assert alt.status_code == 200

    async with test_client_factory(user) as client:
        filtered = await client.get(
            "/api/v1/analytics/calls?tool_name=reserve_time&workflow_id=" + str(wf.id)
        )
    assert filtered.status_code == 200
    fbody = filtered.json()
    assert any(x["call_id"] == f"wr-{run.id}" for x in fbody["items"])


@pytest.mark.asyncio
async def test_analytics_call_detail_404_wrong_org(
    test_client_factory, db_session, org_user_analytics, async_session
):
    org, user = org_user_analytics
    wf = await db_session.create_workflow(
        name="Other org WF",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    run = await db_session.create_workflow_run(
        "r", wf.id, "smallwebrtc", user.id, call_type=CallType.INBOUND
    )

    from api.db.models import OrganizationModel, UserModel

    org2 = OrganizationModel(provider_id="test-analytics-org-2")
    async_session.add(org2)
    await async_session.flush()
    user2 = UserModel(provider_id="test-analytics-user-2", selected_organization_id=org2.id)
    async_session.add(user2)
    await async_session.flush()

    async with test_client_factory(user2) as client:
        res = await client.get(f"/api/v1/analytics/calls/wr-{run.id}")
    assert res.status_code == 404
