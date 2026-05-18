"""GET/PUT /api/v1/organizations/http-integration-cache-policy (WE-01-DATASTORE-INTEG)."""

import pytest

from api.db.models import OrganizationModel, UserModel
from api.enums import OrganizationConfigurationKey


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
    assert body["policy_schema_version"] == 4
    assert body["policy_audit"] == []
    assert body["stored_preferences"]["cache_enabled_when_shipped"] is False
    assert body["stored_preferences"]["ttl_seconds"] is None
    assert body["stored_preferences"]["integration_overrides"] == []


@pytest.mark.asyncio
async def test_http_integration_cache_policy_get_merges_stored_row(
    test_client_factory, org_user_cache_policy, db_session
):
    org, user = org_user_cache_policy
    await db_session.upsert_configuration(
        org.id,
        OrganizationConfigurationKey.HTTP_INTEGRATION_CACHE_POLICY.value,
        {
            "v": 1,
            "cache_enabled_when_shipped": True,
            "ttl_seconds": 3600,
        },
    )
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/organizations/http-integration-cache-policy")
    assert res.status_code == 200
    body = res.json()
    assert body["cache_enabled"] is False
    prefs = body["stored_preferences"]
    assert prefs["cache_enabled_when_shipped"] is True
    assert prefs["ttl_seconds"] == 3600
    assert prefs["integration_overrides"] == []
    assert body["policy_audit"] == []


@pytest.mark.asyncio
async def test_http_integration_cache_policy_put_persists(
    test_client_factory, org_user_cache_policy, db_session
):
    org, user = org_user_cache_policy
    async with test_client_factory(user) as client:
        res = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json={
                "cache_enabled_when_shipped": True,
                "ttl_seconds": 120,
                "integration_overrides": [],
            },
        )
    assert res.status_code == 200
    body = res.json()
    assert body["stored_preferences"]["cache_enabled_when_shipped"] is True
    assert body["stored_preferences"]["ttl_seconds"] == 120

    cfg = await db_session.get_configuration(
        org.id,
        OrganizationConfigurationKey.HTTP_INTEGRATION_CACHE_POLICY.value,
    )
    assert cfg is not None
    assert cfg.value["cache_enabled_when_shipped"] is True
    assert cfg.value["ttl_seconds"] == 120
    assert cfg.value.get("integration_overrides") == []
    assert isinstance(cfg.value.get("policy_audit"), list)
    assert len(cfg.value["policy_audit"]) == 1
    entry = cfg.value["policy_audit"][0]
    assert entry["cache_enabled_when_shipped"] is True
    assert entry["ttl_seconds"] == 120
    assert entry["actor_provider_id"] == user.provider_id
    assert entry.get("integration_overrides_count") == 0


@pytest.mark.asyncio
async def test_http_integration_cache_policy_put_appends_audit_on_change(
    test_client_factory, org_user_cache_policy, db_session
):
    org, user = org_user_cache_policy
    async with test_client_factory(user) as client:
        res1 = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json={
                "cache_enabled_when_shipped": True,
                "ttl_seconds": 120,
                "integration_overrides": [],
            },
        )
        assert res1.status_code == 200
        assert len(res1.json()["policy_audit"]) == 1
        res2 = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json={
                "cache_enabled_when_shipped": False,
                "ttl_seconds": 120,
                "integration_overrides": [],
            },
        )
    assert res2.status_code == 200
    body = res2.json()
    assert len(body["policy_audit"]) == 2
    assert body["policy_audit"][-1]["cache_enabled_when_shipped"] is False


@pytest.mark.asyncio
async def test_http_integration_cache_policy_put_no_audit_when_unchanged(
    test_client_factory, org_user_cache_policy
):
    _, user = org_user_cache_policy
    payload = {
        "cache_enabled_when_shipped": True,
        "ttl_seconds": 3600,
        "integration_overrides": [],
    }
    async with test_client_factory(user) as client:
        res1 = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json=payload,
        )
        assert res1.status_code == 200
        assert len(res1.json()["policy_audit"]) == 1
        res2 = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json=payload,
        )
    assert res2.status_code == 200
    assert len(res2.json()["policy_audit"]) == 1


@pytest.mark.asyncio
async def test_http_integration_cache_policy_put_ttl_too_small_422(
    test_client_factory, org_user_cache_policy
):
    _, user = org_user_cache_policy
    async with test_client_factory(user) as client:
        res = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json={
                "cache_enabled_when_shipped": False,
                "ttl_seconds": 59,
                "integration_overrides": [],
            },
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_http_integration_cache_policy_put_requires_org(
    test_client_factory, user_no_org_cache_policy
):
    async with test_client_factory(user_no_org_cache_policy) as client:
        res = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json={"cache_enabled_when_shipped": False, "integration_overrides": []},
        )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_http_integration_cache_policy_put_integration_overrides(
    test_client_factory, org_user_cache_policy, db_session
):
    org, user = org_user_cache_policy
    async with test_client_factory(user) as client:
        res = await client.put(
            "/api/v1/organizations/http-integration-cache-policy",
            json={
                "cache_enabled_when_shipped": False,
                "ttl_seconds": None,
                "integration_overrides": [
                    {
                        "integration_id": "nango-conn-abc",
                        "cache_enabled_when_shipped": True,
                        "ttl_seconds": 7200,
                        "pii_handling": "block_cached_store",
                    }
                ],
            },
        )
    assert res.status_code == 200
    body = res.json()
    assert len(body["stored_preferences"]["integration_overrides"]) == 1
    row = body["stored_preferences"]["integration_overrides"][0]
    assert row["integration_id"] == "nango-conn-abc"
    assert row["cache_enabled_when_shipped"] is True
    assert row["ttl_seconds"] == 7200
    assert row["pii_handling"] == "block_cached_store"
    assert body["policy_audit"][-1].get("integration_overrides_count") == 1

    cfg = await db_session.get_configuration(
        org.id,
        OrganizationConfigurationKey.HTTP_INTEGRATION_CACHE_POLICY.value,
    )
    assert cfg is not None
    assert len(cfg.value["integration_overrides"]) == 1
