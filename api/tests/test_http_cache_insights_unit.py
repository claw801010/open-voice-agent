"""Unit tests for HTTP cache insight rollups."""

import json

import pytest

from api.services.analytics.http_cache_insights import fetch_http_cache_rollups


@pytest.mark.asyncio
async def test_fetch_http_cache_rollups_from_spans(async_session, org_user_analytics, db_session):
    from api.db.models import AnalyticsHttpToolSpanModel
    from api.enums import CallType

    org, user = org_user_analytics
    wf = await db_session.create_workflow(
        name="Cache insights WF",
        workflow_definition={
            "nodes": [
                {"id": "s", "type": "startCall", "data": {"prompt": "hi"}, "position": {"x": 0, "y": 0}},
                {"id": "e", "type": "endCall", "data": {"prompt": "bye"}, "position": {"x": 0, "y": 1}},
            ],
            "edges": [{"id": "se", "source": "s", "target": "e"}],
        },
        user_id=user.id,
        organization_id=org.id,
    )
    run = await db_session.create_workflow_run(
        "cache-run",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.INBOUND,
    )
    await db_session.update_workflow_run(
        run.id,
        logs={"realtime_feedback_events": []},
        is_completed=True,
    )
    async_session.add(
        AnalyticsHttpToolSpanModel(
            organization_id=org.id,
            workflow_id=wf.id,
            workflow_run_id=run.id,
            span_id="hit-1",
            tool_name="book_slot",
            tool_type="http_api",
            duration_ms=5,
            http_summary={"request_status": 201, "cache_hit": True, "mapped_data": {"x": 1}},
        )
    )
    async_session.add(
        AnalyticsHttpToolSpanModel(
            organization_id=org.id,
            workflow_id=wf.id,
            workflow_run_id=run.id,
            span_id="miss-1",
            tool_name="book_slot",
            tool_type="http_api",
            duration_ms=8,
            http_summary={"request_status": 201, "cache_hit": False},
        )
    )
    await async_session.flush()

    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    mix_params = {
        "oid": org.id,
        "since": now - timedelta(days=1),
        "until": now + timedelta(minutes=1),
    }
    row = await fetch_http_cache_rollups(async_session, mix_params=mix_params, mix_sql_extra="")
    assert row["http_tool_invocations"] == 2
    assert row["http_tool_cache_hits"] == 1


@pytest.mark.asyncio
async def test_fetch_http_cache_rollups_from_logs_when_no_spans(
    async_session, org_user_analytics, db_session
):
    from api.enums import CallType

    org, user = org_user_analytics
    wf = await db_session.create_workflow(
        name="Log cache WF",
        workflow_definition={
            "nodes": [
                {"id": "s", "type": "startCall", "data": {"prompt": "hi"}, "position": {"x": 0, "y": 0}},
                {"id": "e", "type": "endCall", "data": {"prompt": "bye"}, "position": {"x": 0, "y": 1}},
            ],
            "edges": [{"id": "se", "source": "s", "target": "e"}],
        },
        user_id=user.id,
        organization_id=org.id,
    )
    http_result = json.dumps(
        {"status": "success", "status_code": 200, "cache_hit": True, "mapped_data": {"a": 1}}
    )
    run = await db_session.create_workflow_run(
        "log-cache-run",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.INBOUND,
    )
    await db_session.update_workflow_run(
        run.id,
        logs={
            "realtime_feedback_events": [
                {
                    "type": "rtf-function-call-end",
                    "payload": {
                        "function_name": "book_slot",
                        "tool_call_id": "tc1",
                        "result": http_result,
                    },
                }
            ]
        },
        is_completed=True,
    )
    await async_session.flush()

    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    mix_params = {
        "oid": org.id,
        "since": now - timedelta(days=1),
        "until": now + timedelta(minutes=1),
    }
    row = await fetch_http_cache_rollups(async_session, mix_params=mix_params, mix_sql_extra="")
    assert row["http_tool_invocations"] == 1
    assert row["http_tool_cache_hits"] == 1
