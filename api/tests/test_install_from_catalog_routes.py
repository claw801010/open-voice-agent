"""Integration tests: POST /api/v1/workflow/install-from-catalog (MK-01-INSTALL)."""

import json

import pytest

from api.db.models import OrganizationModel, UserModel

_HEALTHCARE_SLUG = "healthcare-clinic-screening"


@pytest.fixture
async def org_user_catalog_install(async_session):
    org = OrganizationModel(provider_id="test-catalog-install-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(
        provider_id="test-catalog-install-user",
        selected_organization_id=org.id,
    )
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_install_from_catalog_unknown_slug_404(
    test_client_factory, org_user_catalog_install
):
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={"slug": "no-such-vertical-pack", "workflow_name": "Should fail"},
        )
    assert res.status_code == 404
    assert "Unknown catalog slug" in res.json()["detail"]


@pytest.mark.asyncio
async def test_install_from_catalog_unknown_variant_400(
    test_client_factory, org_user_catalog_install
):
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": _HEALTHCARE_SLUG,
                "workflow_name": "Bad variant",
                "variant_id": "not-a-real-variant",
            },
        )
    assert res.status_code == 400
    assert "variant" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_install_from_catalog_default_happy_path(
    test_client_factory, db_session, org_user_catalog_install
):
    """MK-01-RUBRIC (2): documented API happy path for default catalog install."""
    org, user = org_user_catalog_install
    workflow_name = "E2E healthcare install"
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={"slug": _HEALTHCARE_SLUG, "workflow_name": workflow_name},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == workflow_name
    assert isinstance(data["id"], int)

    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("installation_locked") is True
    assert mk01.get("catalog_slug") == _HEALTHCARE_SLUG
    assert mk01.get("source") == "packaged_definition"
    assert mk01.get("catalog_variant_id") in (None, "")

    dtv = data.get("template_context_variables") or {}
    assert dtv.get("clinic_name")

    wdef = data.get("workflow_definition") or {}
    node_types = {n.get("type") for n in wdef.get("nodes", [])}
    assert {"startCall", "agentNode", "endCall"} <= node_types

    stored = await db_session.get_workflow_by_id(data["id"])
    assert stored is not None
    assert stored.organization_id == org.id
    assert stored.user_id == user.id


@pytest.mark.asyncio
async def test_install_from_catalog_complex_variant(
    test_client_factory, org_user_catalog_install
):
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": _HEALTHCARE_SLUG,
                "workflow_name": "Healthcare booking complex",
                "variant_id": "booking_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "booking_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "scheduling_api_base_url" in blob or "book_slot" in blob.lower()


@pytest.mark.asyncio
async def test_install_from_catalog_confirm_remind_variant(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: confirm_remind variant installs reschedule-ready prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": _HEALTHCARE_SLUG,
                "workflow_name": "Healthcare confirm remind",
                "variant_id": "confirm_remind",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "confirm_remind"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "reschedule_appointment" in blob
    assert "scheduling_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_cross_org_fetch_404(
    test_client_factory, org_user_catalog_install, async_session
):
    org1, user1 = org_user_catalog_install
    async with test_client_factory(user1) as client:
        installed = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={"slug": _HEALTHCARE_SLUG, "workflow_name": "Org1 only"},
        )
    assert installed.status_code == 200
    workflow_id = installed.json()["id"]

    org2 = OrganizationModel(provider_id="test-catalog-install-org-b")
    async_session.add(org2)
    await async_session.flush()
    user2 = UserModel(
        provider_id="test-catalog-install-user-b",
        selected_organization_id=org2.id,
    )
    async_session.add(user2)
    await async_session.flush()

    async with test_client_factory(user2) as client:
        fetch = await client.get(f"/api/v1/workflow/fetch/{workflow_id}")
    assert fetch.status_code == 404
    assert org1.id != org2.id
