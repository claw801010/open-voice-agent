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
async def test_analytics_insights_requires_org(test_client_factory, async_session):
    from api.db.models import UserModel

    user = UserModel(provider_id="test-insights-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()

    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/analytics/insights")
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
    assert "cx_score" not in row

    async with test_client_factory(user) as client:
        with_qm = await client.get(
            f"/api/v1/analytics/calls?limit=10&include_qm_summary=true&workflow_id={wf.id}"
        )
    assert with_qm.status_code == 200
    qm_row = next(
        x for x in with_qm.json()["items"] if x["call_id"] == f"wr-{run.id}"
    )
    assert "cx_score" in qm_row
    assert "containment" in qm_row
    assert "qa_score" in qm_row
    assert "scorecard_pass_rate" in qm_row

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

    async with test_client_factory(user) as client:
        by_cat = await client.get("/api/v1/analytics/calls?catalog_slug=healthcare-screening&limit=20")
    assert by_cat.status_code == 200
    cat_body = by_cat.json()
    assert any(x["call_id"] == f"wr-{run.id}" for x in cat_body["items"])

    async with test_client_factory(user) as client:
        other_cat = await client.get("/api/v1/analytics/calls?catalog_slug=retail-wismo-faq&limit=20")
    assert other_cat.status_code == 200
    assert not any(x["call_id"] == f"wr-{run.id}" for x in other_cat.json()["items"])

    async with test_client_factory(user) as client:
        exported = await client.get("/api/v1/analytics/calls/export?max_rows=100")
    assert exported.status_code == 200
    assert "csv" in (exported.headers.get("content-type") or "").lower()
    csv_text = exported.text
    assert "call_id" in csv_text
    assert f"wr-{run.id}" in csv_text


@pytest.mark.asyncio
async def test_analytics_insights_rollup(
    test_client_factory, db_session, org_user_analytics, async_session
):
    org, user = org_user_analytics
    wf = await db_session.create_workflow(
        name="Insights WF",
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
                    "catalog_slug": "dental-booking",
                    "installed_at": "2026-04-01",
                }
            }
        )
    )
    await async_session.flush()

    r1 = await db_session.create_workflow_run("i1", wf.id, "smallwebrtc", user.id, call_type=CallType.INBOUND)
    await db_session.update_workflow_run(
        r1.id,
        gathered_context={"outcome_key": "booked", "mapped_call_disposition": "completed"},
        logs={"realtime_feedback_events": _http_tool_log_events()},
        is_completed=True,
    )
    r2 = await db_session.create_workflow_run("i2", wf.id, "smallwebrtc", user.id, call_type=CallType.INBOUND)
    await db_session.update_workflow_run(
        r2.id,
        gathered_context={"mapped_call_disposition": "abandoned"},
        is_completed=True,
    )

    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/analytics/insights?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["total_calls"] >= 2
    assert data["calls_with_outcome"] >= 1
    assert "outcome_mix" in data
    assert any(
        b["outcome"] == "booked" and b["count"] >= 1 for b in data["outcome_mix"]
    )
    assert data["calls_with_logged_tools"] >= 1
    assert data.get("calls_with_tool_evidence") == data["calls_with_logged_tools"]
    assert any(
        t["tool_name"] == "reserve_time" and t["count"] >= 1 for t in data["tool_name_mix"]
    )
    assert "since" in data and "until" in data
    qs = data.get("quality_summary") or {}
    assert qs.get("sampled_calls", 0) >= 1
    assert "containment_mix" in qs
    assert "avg_cx_score" in qs

    async with test_client_factory(user) as client:
        fslug = await client.get("/api/v1/analytics/insights?days=30&catalog_slug=dental-booking")
    assert fslug.status_code == 200
    assert fslug.json()["total_calls"] >= 1

    async with test_client_factory(user) as client:
        bad = await client.get(
            "/api/v1/analytics/insights?since=2099-01-01T00:00:00Z&until=2020-01-01T00:00:00Z"
        )
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_analytics_calls_span_table_tool_name_list_and_insights(
    test_client_factory, db_session, org_user_analytics, async_session
):
    """List filter, tool_names column, and insights roll-ups honor analytics_http_tool_spans."""
    from api.db.models import AnalyticsHttpToolSpanModel

    org, user = org_user_analytics
    wf = await db_session.create_workflow(
        name="Span table WF",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )
    await async_session.flush()

    run = await db_session.create_workflow_run(
        "span-run",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.INBOUND,
    )
    await db_session.update_workflow_run(
        run.id,
        gathered_context={"mapped_call_disposition": "completed"},
        logs={"realtime_feedback_events": []},
        is_completed=True,
    )
    async_session.add(
        AnalyticsHttpToolSpanModel(
            organization_id=org.id,
            workflow_id=wf.id,
            workflow_run_id=run.id,
            span_id="cache-hit-span",
            tool_name="span_table_only_tool",
            tool_type="http_api",
            duration_ms=10,
            http_summary={"request_status": 201, "cache_hit": True},
        )
    )
    await async_session.flush()

    async with test_client_factory(user) as client:
        filtered = await client.get(
            f"/api/v1/analytics/calls?tool_name=span_table_only_tool&workflow_id={wf.id}&limit=20"
        )
    assert filtered.status_code == 200
    fitems = filtered.json()["items"]
    assert any(x["call_id"] == f"wr-{run.id}" for x in fitems)

    async with test_client_factory(user) as client:
        listed = await client.get(f"/api/v1/analytics/calls?workflow_id={wf.id}&limit=20")
    assert listed.status_code == 200
    row = next(x for x in listed.json()["items"] if x["call_id"] == f"wr-{run.id}")
    assert "span_table_only_tool" in row["tool_names"]

    async with test_client_factory(user) as client:
        ins = await client.get("/api/v1/analytics/insights?days=30")
    assert ins.status_code == 200
    data = ins.json()
    assert data["calls_with_logged_tools"] >= 1
    assert data.get("calls_with_tool_evidence") == data["calls_with_logged_tools"]
    assert any(
        t["tool_name"] == "span_table_only_tool" and t["count"] >= 1
        for t in data["tool_name_mix"]
    )
    assert data.get("http_tool_invocations", 0) >= 1
    assert data.get("http_tool_cache_hits", 0) >= 1


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
