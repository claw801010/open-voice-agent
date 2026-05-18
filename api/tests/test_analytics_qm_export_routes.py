"""Integration tests: GET/PUT /api/v1/analytics/qm-export-schedule."""

import pytest


@pytest.fixture
async def org_user_qm_export(async_session):
    from api.db.models import OrganizationModel, UserModel

    org = OrganizationModel(provider_id="test-qm-export-schedule-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(provider_id="test-qm-export-schedule-user", selected_organization_id=org.id)
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_qm_export_schedule_requires_org(test_client_factory, async_session):
    from api.db.models import UserModel

    user = UserModel(provider_id="test-qm-export-no-org", selected_organization_id=None)
    async_session.add(user)
    await async_session.flush()

    async with test_client_factory(user) as client:
        res_get = await client.get("/api/v1/analytics/qm-export-schedule")
        res_put = await client.put(
            "/api/v1/analytics/qm-export-schedule",
            json={"enabled": False, "hour_utc": 6, "window_days": 7, "max_rows": 5000},
        )
    assert res_get.status_code == 400
    assert res_put.status_code == 400


@pytest.mark.asyncio
async def test_qm_export_schedule_get_defaults(test_client_factory, org_user_qm_export):
    _, user = org_user_qm_export

    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/analytics/qm-export-schedule")
    assert res.status_code == 200
    data = res.json()
    assert data["schedule"]["enabled"] is False
    assert data["schedule"]["hour_utc"] == 6
    assert "cron_enabled" in data
    assert "next_run_at_utc" in data
    assert data["next_run_at_utc"] is None


@pytest.mark.asyncio
async def test_qm_export_schedule_put_roundtrip(test_client_factory, org_user_qm_export):
    _, user = org_user_qm_export
    body = {
        "enabled": True,
        "hour_utc": 9,
        "window_days": 30,
        "max_rows": 2000,
        "workflow_id": None,
        "catalog_slug": "healthcare-clinic-screening",
        "catalog_variant_id": None,
    }

    async with test_client_factory(user) as client:
        put = await client.put("/api/v1/analytics/qm-export-schedule", json=body)
    assert put.status_code == 200
    got = put.json()
    assert got["schedule"]["enabled"] is True
    assert got["schedule"]["hour_utc"] == 9
    assert got["schedule"]["window_days"] == 30
    assert got["schedule"]["catalog_slug"] == "healthcare-clinic-screening"

    async with test_client_factory(user) as client:
        again = await client.get("/api/v1/analytics/qm-export-schedule")
    assert again.status_code == 200
    assert again.json()["schedule"]["hour_utc"] == 9


@pytest.mark.asyncio
async def test_qm_export_schedule_put_invalid_hour(test_client_factory, org_user_qm_export):
    _, user = org_user_qm_export

    async with test_client_factory(user) as client:
        res = await client.put(
            "/api/v1/analytics/qm-export-schedule",
            json={"enabled": False, "hour_utc": 99, "window_days": 7, "max_rows": 5000},
        )
    assert res.status_code == 422
