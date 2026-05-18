"""Integration tests: GET/PUT /api/v1/analytics/redaction-policy."""

import pytest


@pytest.fixture
async def org_user_analytics_redact(async_session):
    from api.db.models import OrganizationModel, UserModel

    org = OrganizationModel(provider_id="test-redaction-policy-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-redaction-policy-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_redaction_policy_requires_org(test_client_factory, async_session):
    from api.db.models import UserModel

    user = UserModel(provider_id="test-redaction-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()

    async with test_client_factory(user) as client:
        res_get = await client.get("/api/v1/analytics/redaction-policy")
        res_put = await client.put(
            "/api/v1/analytics/redaction-policy",
            json={"detail_redaction_enabled": False},
        )
    assert res_get.status_code == 400
    assert res_put.status_code == 400


@pytest.mark.asyncio
async def test_redaction_policy_get_defaults_true(test_client_factory, org_user_analytics_redact):
    _, user = org_user_analytics_redact

    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/analytics/redaction-policy")
    assert res.status_code == 200
    assert res.json() == {
        "detail_redaction_enabled": True,
        "may_disable_detail_redaction": True,
    }


@pytest.mark.asyncio
async def test_redaction_policy_put_roundtrip(test_client_factory, org_user_analytics_redact):
    _, user = org_user_analytics_redact

    async with test_client_factory(user) as client:
        put = await client.put(
            "/api/v1/analytics/redaction-policy",
            json={"detail_redaction_enabled": False},
        )
    assert put.status_code == 200
    body = put.json()
    assert body["detail_redaction_enabled"] is False
    assert body["may_disable_detail_redaction"] is True

    async with test_client_factory(user) as client:
        get = await client.get("/api/v1/analytics/redaction-policy")
    assert get.status_code == 200
    got = get.json()
    assert got["detail_redaction_enabled"] is False
    assert got["may_disable_detail_redaction"] is True

    async with test_client_factory(user) as client:
        restore = await client.put(
            "/api/v1/analytics/redaction-policy",
            json={"detail_redaction_enabled": True},
        )
    assert restore.status_code == 200
    assert restore.json()["may_disable_detail_redaction"] is True
