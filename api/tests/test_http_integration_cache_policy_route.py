"""GET /api/v1/organizations/http-integration-cache-policy (WE-01-DATASTORE-INTEG read stub)."""

import pytest

from api.db.models import OrganizationModel, UserModel


@pytest.fixture
async def org_user_cache_policy(async_session):
    org = OrganizationModel(provider_id="test-http-cache-policy-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-http-cache-policy-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.fixture
async def user_no_org_cache_policy(async_session):
    user = UserModel(provider_id="test-http-cache-policy-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()
    return user


@pytest.mark.asyncio
async def test_http_integration_cache_policy_requires_organization(
    test_client_factory, user_no_org_cache_policy
):
    async with test_client_factory(user_no_org_cache_policy) as client:
        res = await client.get("/api/v1/organizations/http-integration-cache-policy")
    assert res.status_code == 400
    assert "organization" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_http_integration_cache_policy_returns_stub(test_client_factory, org_user_cache_policy):
    org, user = org_user_cache_policy
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/http-integration-cache-policy")
    assert res.status_code == 200
    body = res.json()
    assert body["organization_id"] == org.id
    assert body["cache_enabled"] is False
    assert body["implementation_status"] == "not_implemented"
    assert body["deferral_not_before"] == "2026-07-01"
