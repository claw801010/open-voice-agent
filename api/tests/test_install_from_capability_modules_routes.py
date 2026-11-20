"""Integration tests: POST /api/v1/workflow/install-from-capability-modules (MK-01 slice 3)."""

from __future__ import annotations

import pytest

from api.db.models import OrganizationModel, UserModel


@pytest.fixture
async def org_user_capability_install(async_session):
    org = OrganizationModel(provider_id="test-capability-install-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(
        provider_id="test-capability-install-user",
        selected_organization_id=org.id,
    )
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_resolve_capability_modules_catalog_route(test_client_factory, org_user_capability_install):
    _, user = org_user_capability_install
    async with test_client_factory(user) as client:
        res = await client.get(
            "/api/v1/catalog/capability-modules/resolve",
            params={"module_ids": "salon_appointment_booking,stylist_routing"},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["slug"] == "barber-beauty-salon-faq"
    assert data["variant_id"] in ("booking_complex", "location_router_complex")


@pytest.mark.asyncio
async def test_install_from_capability_modules_happy_path(
    test_client_factory, db_session, org_user_capability_install
):
    org, user = org_user_capability_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-capability-modules",
            json={
                "module_ids": ["site_visit_scheduling"],
                "workflow_name": "Capability construction install",
            },
        )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Capability construction install"
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_slug") == "construction-trades-faq"
    assert mk01.get("catalog_variant_id") == "booking_complex"
    assert "site_visit_scheduling" in (mk01.get("capability_module_ids") or [])

    resolution = data.get("capability_resolution") or {}
    assert resolution.get("slug") == "construction-trades-faq"

    stored = await db_session.get_workflow_by_id(data["id"])
    assert stored is not None
    assert stored.organization_id == org.id
    stored_mk01 = (stored.workflow_configurations or {}).get("mk01") or {}
    assert "site_visit_scheduling" in (stored_mk01.get("capability_module_ids") or [])


@pytest.mark.asyncio
async def test_compose_plan_catalog_route(test_client_factory, org_user_capability_install):
    _, user = org_user_capability_install
    async with test_client_factory(user) as client:
        res = await client.get(
            "/api/v1/catalog/capability-modules/compose-plan",
            params={"module_ids": "salon_appointment_booking,site_visit_scheduling"},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["single_pack_sufficient"] is False
    assert len(data["installs"]) >= 2


@pytest.mark.asyncio
async def test_install_capability_plan_multi_pack(
    test_client_factory, db_session, org_user_capability_install
):
    org, user = org_user_capability_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-capability-modules/plan",
            json={
                "module_ids": ["salon_appointment_booking", "site_visit_scheduling"],
                "workflow_name_prefix": "Capability plan",
            },
        )
    assert res.status_code == 200
    data = res.json()
    assert data["workflow_count"] >= 2
    assert len(data["workflows"]) >= 2
    for wf in data["workflows"]:
        stored = await db_session.get_workflow_by_id(wf["id"])
        assert stored is not None
        assert stored.organization_id == org.id
        stored_mk01 = (stored.workflow_configurations or {}).get("mk01") or {}
        assert stored_mk01.get("capability_install_plan") is True
        assert stored_mk01.get("capability_module_ids")
