"""WE-01-FEEDBACK: POST /api/v1/feedback stores product feedback."""

import pytest

from api.db.models import OrganizationModel, UserModel

_MIN_GRAPH = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {"id": "2", "type": "endCall", "data": {"name": "End", "prompt": "Bye"}},
    ],
    "edges": [{"id": "e1", "source": "1", "target": "2", "data": {"label": "End"}}],
}


@pytest.fixture
async def org_user_feedback(async_session):
    org = OrganizationModel(provider_id="test-pf-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-pf-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_submit_feedback_stores_row(test_client_factory, db_session, org_user_feedback):
    org, user = org_user_feedback
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/feedback",
            json={"message": "Great editor", "source": "workflow_editor"},
        )
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    fid = data["id"]
    row = await db_session.get_product_feedback_by_id(fid)
    assert row is not None
    assert row.message == "Great editor"
    assert row.user_id == user.id
    assert row.organization_id == org.id
    assert row.workflow_id is None


@pytest.mark.asyncio
async def test_submit_feedback_with_workflow_id(test_client_factory, db_session, org_user_feedback):
    org, user = org_user_feedback
    wf = await db_session.create_workflow(
        name="PF Test WF",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=org.id,
    )

    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/feedback",
            json={"message": "About this flow", "workflow_id": wf.id},
        )
    assert res.status_code == 200
    fid = res.json()["id"]
    row = await db_session.get_product_feedback_by_id(fid)
    assert row.workflow_id == wf.id


@pytest.mark.asyncio
async def test_submit_feedback_rejects_foreign_workflow(
    test_client_factory, db_session, org_user_feedback, async_session
):
    org, user = org_user_feedback
    other_org = OrganizationModel(provider_id="test-pf-org-other")
    async_session.add(other_org)
    await async_session.flush()
    wf = await db_session.create_workflow(
        name="Other org WF",
        workflow_definition=_MIN_GRAPH,
        user_id=user.id,
        organization_id=other_org.id,
    )

    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/feedback",
            json={"message": "nope", "workflow_id": wf.id},
        )
    assert res.status_code == 403
