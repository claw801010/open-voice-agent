"""Integration tests: GET/PUT /api/v1/analytics/dashboard-layout."""

import pytest


@pytest.fixture
async def org_user_analytics(async_session):
    from api.db.models import OrganizationModel, UserModel

    org = OrganizationModel(provider_id="test-dashboard-layout-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-dashboard-layout-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


_MIN_VALID_LAYOUT = {
    "v": 1,
    "widgets": [
        {"id": "a1", "type": "kpi_row"},
        {"id": "b2", "type": "outcome_top"},
    ],
}


@pytest.mark.asyncio
async def test_dashboard_layout_requires_org(test_client_factory, async_session):
    from api.db.models import UserModel

    user = UserModel(provider_id="test-dash-layout-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()

    async with test_client_factory(user) as client:
        res_get = await client.get("/api/v1/analytics/dashboard-layout")
        res_put = await client.put("/api/v1/analytics/dashboard-layout", json={"layout": _MIN_VALID_LAYOUT})
    assert res_get.status_code == 400
    assert res_put.status_code == 400


@pytest.mark.asyncio
async def test_dashboard_layout_get_null_put_roundtrip(test_client_factory, org_user_analytics):
    _, user = org_user_analytics

    async with test_client_factory(user) as client:
        empty = await client.get("/api/v1/analytics/dashboard-layout")
    assert empty.status_code == 200
    assert empty.json() == {"layout": None}

    async with test_client_factory(user) as client:
        put = await client.put("/api/v1/analytics/dashboard-layout", json={"layout": _MIN_VALID_LAYOUT})
    assert put.status_code == 200
    got = put.json()
    assert got["layout"]["v"] == 1
    assert len(got["layout"]["widgets"]) == 2

    async with test_client_factory(user) as client:
        again = await client.get("/api/v1/analytics/dashboard-layout")
    assert again.status_code == 200
    assert again.json()["layout"]["widgets"][0]["type"] == "kpi_row"


@pytest.mark.asyncio
async def test_dashboard_layout_put_invalid_422(test_client_factory, org_user_analytics):
    _, user = org_user_analytics

    async with test_client_factory(user) as client:
        res = await client.put(
            "/api/v1/analytics/dashboard-layout",
            json={"layout": {"v": 2, "widgets": [{"id": "x", "type": "kpi_row"}]}},
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_dashboard_layout_is_org_scoped(test_client_factory, async_session):
    from api.db.models import OrganizationModel, UserModel

    org_a = OrganizationModel(provider_id="test-dash-org-a")
    org_b = OrganizationModel(provider_id="test-dash-org-b")
    async_session.add_all([org_a, org_b])
    await async_session.flush()

    user_a = UserModel(provider_id="test-dash-user-a", selected_organization_id=org_a.id)
    user_b = UserModel(provider_id="test-dash-user-b", selected_organization_id=org_b.id)
    async_session.add_all([user_a, user_b])
    await async_session.flush()

    async with test_client_factory(user_a) as client:
        await client.put("/api/v1/analytics/dashboard-layout", json={"layout": _MIN_VALID_LAYOUT})

    async with test_client_factory(user_b) as client:
        res_b = await client.get("/api/v1/analytics/dashboard-layout")
    assert res_b.status_code == 200
    assert res_b.json()["layout"] is None


@pytest.mark.asyncio
async def test_dashboard_layout_normalize_drops_bad_widgets(test_client_factory, org_user_analytics):
    """Server keeps valid widgets when some entries are malformed."""
    _, user = org_user_analytics
    raw = {
        "v": 1,
        "widgets": [
            {"id": "ok", "type": "kpi_row"},
            {"id": "", "type": "outcome_top"},
            {"oops": True},
        ],
    }

    async with test_client_factory(user) as client:
        put = await client.put("/api/v1/analytics/dashboard-layout", json={"layout": raw})
    assert put.status_code == 200
    normalized = put.json()["layout"]
    assert len(normalized["widgets"]) == 1
    assert normalized["widgets"][0]["id"] == "ok"
