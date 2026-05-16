"""Integration tests: post-call AI review, follow-ups, apply-workflow-improvement."""

import pytest

from api.enums import CallType
from api.services.analytics.call_follow_ups import ANNOT_KEY_AI_REVIEW, ANNOT_KEY_FOLLOW_UPS


_GRAPH_WITH_AGENT = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {
            "id": "2",
            "type": "agentNode",
            "data": {"name": "Agent", "prompt": "Be helpful and confirm bookings."},
        },
        {"id": "3", "type": "endCall", "data": {"name": "End", "prompt": "Bye"}},
    ],
    "edges": [
        {"id": "e1", "source": "1", "target": "2", "data": {"label": "Go"}},
        {"id": "e2", "source": "2", "target": "3", "data": {"label": "End"}},
    ],
}


def _transcript_log_events():
    return [
        {
            "type": "rtf-user-transcription",
            "payload": {
                "final": True,
                "text": "I need an appointment tomorrow.",
                "timestamp": "2026-04-20T12:00:00+00:00",
            },
            "timestamp": "2026-04-20T12:00:00+00:00",
        },
        {
            "type": "rtf-bot-text",
            "payload": {
                "text": "I can help schedule that for you.",
                "timestamp": "2026-04-20T12:00:01+00:00",
            },
            "timestamp": "2026-04-20T12:00:01+00:00",
        },
    ]


@pytest.fixture
async def org_user_call_review(async_session):
    from api.db.models import OrganizationModel, UserModel

    org = OrganizationModel(provider_id="test-call-review-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-call-review-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.fixture
async def review_run(test_client_factory, db_session, org_user_call_review):
    """Workflow + completed run with transcript for review routes."""
    org, user = org_user_call_review
    wf = await db_session.create_workflow(
        name="Review WF",
        workflow_definition=_GRAPH_WITH_AGENT,
        user_id=user.id,
        organization_id=org.id,
    )
    run = await db_session.create_workflow_run(
        "review-run",
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
        cost_info={"call_duration_seconds": 30.0},
        logs={"realtime_feedback_events": _transcript_log_events()},
        is_completed=True,
    )
    return org, user, wf, run


@pytest.mark.asyncio
async def test_call_review_routes_require_org(test_client_factory, async_session):
    from api.db.models import UserModel

    user = UserModel(provider_id="test-call-review-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()

    async with test_client_factory(user) as client:
        res = await client.post("/api/v1/analytics/calls/wr-1/ai-review")
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_ai_review_generates_heuristic_and_caches(
    test_client_factory, review_run, db_session
):
    _org, user, _wf, run = review_run
    call_id = f"wr-{run.id}"

    async with test_client_factory(user) as client:
        first = await client.post(f"/api/v1/analytics/calls/{call_id}/ai-review")
    assert first.status_code == 200
    body = first.json()
    assert body["call_id"] == call_id
    assert body["summary"]
    assert body["source"] == "heuristic"
    assert len(body["recommendations"]) >= 1
    generated_at = body["generated_at"]

    async with test_client_factory(user) as client:
        second = await client.post(f"/api/v1/analytics/calls/{call_id}/ai-review")
    assert second.status_code == 200
    cached = second.json()
    assert cached["generated_at"] == generated_at
    assert cached["summary"] == body["summary"]

    stored = await db_session.get_workflow_run_by_id(run.id)
    assert isinstance((stored.annotations or {}).get(ANNOT_KEY_AI_REVIEW), dict)


@pytest.mark.asyncio
async def test_ai_review_force_refresh(test_client_factory, review_run):
    _org, user, _wf, run = review_run
    call_id = f"wr-{run.id}"

    async with test_client_factory(user) as client:
        await client.post(f"/api/v1/analytics/calls/{call_id}/ai-review")
        refreshed = await client.post(
            f"/api/v1/analytics/calls/{call_id}/ai-review",
            json={"force_refresh": True},
        )
    assert refreshed.status_code == 200
    assert refreshed.json()["summary"]


@pytest.mark.asyncio
async def test_call_review_routes_404_wrong_org(
    test_client_factory, review_run, async_session
):
    _org, _user, _wf, run = review_run
    call_id = f"wr-{run.id}"

    from api.db.models import OrganizationModel, UserModel

    org2 = OrganizationModel(provider_id="test-call-review-org-2")
    async_session.add(org2)
    await async_session.flush()
    user2 = UserModel(provider_id="test-call-review-user-2", selected_organization_id=org2.id)
    async_session.add(user2)
    await async_session.flush()

    async with test_client_factory(user2) as client:
        review = await client.post(f"/api/v1/analytics/calls/{call_id}/ai-review")
        follow = await client.get(f"/api/v1/analytics/calls/{call_id}/follow-ups")
        apply = await client.post(
            f"/api/v1/analytics/calls/{call_id}/apply-workflow-improvement",
            json={"improvement": "Always confirm the booking reference."},
        )
    assert review.status_code == 404
    assert follow.status_code == 404
    assert apply.status_code == 404


@pytest.mark.asyncio
async def test_follow_ups_list_and_create(test_client_factory, review_run, db_session):
    _org, user, _wf, run = review_run
    call_id = f"wr-{run.id}"

    async with test_client_factory(user) as client:
        empty = await client.get(f"/api/v1/analytics/calls/{call_id}/follow-ups")
    assert empty.status_code == 200
    assert empty.json()["items"] == []

    async with test_client_factory(user) as client:
        created = await client.post(
            f"/api/v1/analytics/calls/{call_id}/follow-ups",
            json={
                "action_type": "call",
                "notes": "Call back to confirm slot",
                "contact_hint": "+15551234567",
            },
        )
    assert created.status_code == 200
    item = created.json()
    assert item["action_type"] == "call"
    assert item["status"] == "pending"
    assert item["notes"] == "Call back to confirm slot"
    assert item["contact_hint"] == "+15551234567"
    assert item["id"].startswith("fu-")

    async with test_client_factory(user) as client:
        listed = await client.get(f"/api/v1/analytics/calls/{call_id}/follow-ups")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1
    assert listed.json()["items"][0]["id"] == item["id"]

    stored = await db_session.get_workflow_run_by_id(run.id)
    ann_items = (stored.annotations or {}).get(ANNOT_KEY_FOLLOW_UPS) or []
    assert len(ann_items) == 1


@pytest.mark.asyncio
async def test_apply_workflow_improvement_appends_prompt(
    test_client_factory, review_run, db_session
):
    org, user, wf, run = review_run
    call_id = f"wr-{run.id}"

    async with test_client_factory(user) as client:
        res = await client.post(
            f"/api/v1/analytics/calls/{call_id}/apply-workflow-improvement",
            json={"improvement": "Always read back the confirmation code aloud."},
        )
    assert res.status_code == 200
    payload = res.json()
    assert payload["workflow_id"] == wf.id
    assert payload["node_id"] == "2"

    workflow = await db_session.get_workflow(wf.id, organization_id=org.id)
    draft = await db_session.get_draft_version(wf.id)
    definition = draft.workflow_json if draft else workflow.released_definition.workflow_json
    agent_prompt = next(n for n in definition["nodes"] if n["id"] == "2")["data"]["prompt"]
    assert "Call review improvements" in agent_prompt
    assert "confirmation code" in agent_prompt


@pytest.mark.asyncio
async def test_apply_workflow_improvement_from_recommendation_index(
    test_client_factory, review_run, db_session
):
    org, user, wf, run = review_run
    call_id = f"wr-{run.id}"

    async with test_client_factory(user) as client:
        review = await client.post(f"/api/v1/analytics/calls/{call_id}/ai-review")
    assert review.status_code == 200
    snippet = review.json()["recommendations"][0]["prompt_snippet"]
    assert snippet

    async with test_client_factory(user) as client:
        applied = await client.post(
            f"/api/v1/analytics/calls/{call_id}/apply-workflow-improvement",
            json={"improvement": "unused fallback", "recommendation_index": 0},
        )
    assert applied.status_code == 200

    workflow = await db_session.get_workflow(wf.id, organization_id=org.id)
    draft = await db_session.get_draft_version(wf.id)
    definition = draft.workflow_json if draft else workflow.released_definition.workflow_json
    agent_prompt = next(n for n in definition["nodes"] if n["id"] == "2")["data"]["prompt"]
    assert snippet in agent_prompt
