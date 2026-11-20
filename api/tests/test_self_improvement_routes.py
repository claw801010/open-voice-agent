"""Integration tests: agent self-improvement queue routes."""

import pytest

from api.enums import CallType, OrganizationConfigurationKey
from api.services.analytics.self_improvement_queue import reset_self_improvement_store


_GRAPH_WITH_AGENT = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {
            "id": "2",
            "type": "agentNode",
            "data": {"name": "Agent", "prompt": "Be helpful."},
        },
    ],
    "edges": [{"id": "e1", "source": "1", "target": "2", "data": {"label": "Go"}}],
}


@pytest.fixture
async def si_org_user(async_session):
    from api.db.models import OrganizationModel, UserModel

    org = OrganizationModel(provider_id="test-si-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-si-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.fixture
async def si_run(test_client_factory, db_session, si_org_user):
    org, user = si_org_user
    wf = await db_session.create_workflow(
        name="SI WF",
        workflow_definition=_GRAPH_WITH_AGENT,
        user_id=user.id,
        organization_id=org.id,
    )
    run = await db_session.create_workflow_run(
        "si-run",
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
                    "type": "rtf-user-transcription",
                    "payload": {"final": True, "text": "Book me tomorrow."},
                }
            ]
        },
        is_completed=True,
    )
    await reset_self_improvement_store(org.id)
    return org, user, wf, run


@pytest.mark.asyncio
async def test_self_improvement_policy_defaults(test_client_factory, si_org_user):
    _org, user = si_org_user
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/analytics/self-improvement/policy")
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "suggest"
    assert body["evidence_gates"]["min_supporting_calls"] == 3


@pytest.mark.asyncio
async def test_ai_review_enqueues_improvements(test_client_factory, si_run, db_session):
    _org, user, _wf, run = si_run
    call_id = f"wr-{run.id}"

    async with test_client_factory(user) as client:
        review = await client.post(f"/api/v1/analytics/calls/{call_id}/ai-review")
        assert review.status_code == 200
        queue = await client.get("/api/v1/analytics/self-improvement/queue")
    assert queue.status_code == 200
    qbody = queue.json()
    assert qbody["pending_count"] >= 1
    assert len(qbody["items"]) >= 1
    assert qbody["items"][0]["status"] == "pending"


@pytest.mark.asyncio
async def test_approve_proposal_applies_prompt(test_client_factory, si_run, db_session):
    _org, user, wf, run = si_run
    call_id = f"wr-{run.id}"

    async with test_client_factory(user) as client:
        await client.post(f"/api/v1/analytics/calls/{call_id}/ai-review")
        queue = await client.get("/api/v1/analytics/self-improvement/queue")
        proposal_id = queue.json()["items"][0]["id"]
        approve = await client.post(
            f"/api/v1/analytics/self-improvement/queue/{proposal_id}/approve"
        )
    assert approve.status_code == 200
    assert approve.json()["applied_node_id"] == "2"

    updated = await db_session.get_workflow(wf.id)
    draft = await db_session.get_draft_version(wf.id)
    graph = draft.workflow_json if draft else updated.released_definition.workflow_json
    prompt = graph["nodes"][1]["data"]["prompt"]
    assert "Call review improvements" in prompt


@pytest.mark.asyncio
async def test_put_policy_mode(test_client_factory, si_org_user):
    _org, user = si_org_user
    async with test_client_factory(user) as client:
        res = await client.put(
            "/api/v1/analytics/self-improvement/policy",
            json={"mode": "auto_with_queue"},
        )
    assert res.status_code == 200
    assert res.json()["mode"] == "auto_with_queue"
