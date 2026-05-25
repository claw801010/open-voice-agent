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
async def test_install_from_catalog_upsell_complex_variant(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: retail upsell_complex variant installs offer-ready prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "retail-wismo-faq",
                "workflow_name": "Retail WISMO upsell",
                "variant_id": "upsell_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "upsell_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "offer_warranty_addon" in blob
    assert "product_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_collections_complex_variant(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: retail collections_complex variant installs promise capture prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "retail-wismo-faq",
                "workflow_name": "Retail collections",
                "variant_id": "collections_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "collections_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "capture_payment_promise" in blob
    assert "collections_api_base_url" in blob
    assert "payment_plan_policy_id" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_renewal_complex_variant(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: b2b renewal_complex variant installs QBR-ready prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "b2b-saas-trial-nurture",
                "workflow_name": "B2B renewal QBR",
                "variant_id": "renewal_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "renewal_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "book_qbr" in blob
    assert "scheduling_api_base_url" in blob
    assert "crm_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_conversion_complex_variant(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: b2b conversion_complex variant installs CRM stage handoff prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "b2b-saas-trial-nurture",
                "workflow_name": "B2B trial conversion",
                "variant_id": "conversion_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "conversion_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "update_crm_deal_stage" in blob
    assert "crm_api_base_url" in blob
    assert "target_deal_stage" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_concierge_complex_variant(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: healthcare concierge_complex variant installs billing enroll prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "healthcare-clinic-screening",
                "workflow_name": "Healthcare concierge",
                "variant_id": "concierge_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "concierge_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "enroll_concierge_visit" in blob
    assert "billing_api_base_url" in blob
    assert "concierge_visit_type" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_insurance_default(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: insurance-fnol-faq default install loads FNOL prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "insurance-fnol-faq",
                "workflow_name": "Insurance FNOL FAQ",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_slug") == "insurance-fnol-faq"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "carrier_name" in blob
    assert "claims_portal_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_insurance_booking_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: insurance booking_complex variant installs adjuster callback prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "insurance-fnol-faq",
                "workflow_name": "Insurance FNOL callback",
                "variant_id": "booking_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "booking_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "schedule_adjuster_callback" in blob
    assert "scheduling_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_insurance_quote_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: insurance quote_complex variant installs quote intent prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "insurance-fnol-faq",
                "workflow_name": "Insurance quote intent",
                "variant_id": "quote_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "quote_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "capture_quote_intent" in blob
    assert "quoting_api_base_url" in blob
    assert "quote_product_code" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_insurance_claims_lookup_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: insurance claims_lookup_complex variant installs status lookup prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "insurance-fnol-faq",
                "workflow_name": "Insurance claims lookup",
                "variant_id": "claims_lookup_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "claims_lookup_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "lookup_claim_status" in blob
    assert "claims_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_hospitality_default(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: hospitality-travel-concierge default install loads concierge prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "hospitality-travel-concierge",
                "workflow_name": "Hospitality concierge FAQ",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_slug") == "hospitality-travel-concierge"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "property_name" in blob
    assert "cancellation_policy_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_hospitality_booking_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: hospitality booking_complex variant installs PMS modify prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "hospitality-travel-concierge",
                "workflow_name": "Hospitality booking modify",
                "variant_id": "booking_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "booking_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "modify_reservation" in blob
    assert "pms_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_hospitality_waiver_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: hospitality waiver_complex variant installs cancellation waiver prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "hospitality-travel-concierge",
                "workflow_name": "Hospitality waiver",
                "variant_id": "waiver_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "waiver_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "apply_cancellation_waiver" in blob
    assert "policy_api_base_url" in blob
    assert "waiver_policy_code" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_hospitality_upsell_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: hospitality upsell_complex variant installs room upgrade prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "hospitality-travel-concierge",
                "workflow_name": "Hospitality room upgrade",
                "variant_id": "upsell_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "upsell_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "offer_room_upgrade" in blob
    assert "crs_api_base_url" in blob
    assert "upgrade_room_type" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_financial_default(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: financial-services-banking-faq default install loads banking FAQ prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "financial-services-banking-faq",
                "workflow_name": "Banking card FAQ",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_slug") == "financial-services-banking-faq"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "institution_name" in blob
    assert "card_block_portal_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_financial_booking_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: financial booking_complex variant installs branch appointment prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "financial-services-banking-faq",
                "workflow_name": "Banking branch booking",
                "variant_id": "booking_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "booking_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "schedule_branch_appointment" in blob
    assert "scheduling_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_financial_balance_lookup_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: financial balance_lookup_complex variant installs balance lookup prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "financial-services-banking-faq",
                "workflow_name": "Banking balance lookup",
                "variant_id": "balance_lookup_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "balance_lookup_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "lookup_account_balance" in blob
    assert "banking_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_financial_card_block_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: financial card_block_complex variant installs card block prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "financial-services-banking-faq",
                "workflow_name": "Banking card block",
                "variant_id": "card_block_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "card_block_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "report_card_lost_stolen" in blob
    assert "cards_api_base_url" in blob
    assert "card_block_reason_code" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_smb_default(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: smb-franchise-location-faq default install loads multi-location FAQ prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "smb-franchise-location-faq",
                "workflow_name": "SMB location FAQ",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_slug") == "smb-franchise-location-faq"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "brand_name" in blob
    assert "location_directory_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_smb_booking_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-CATALOG: smb booking_complex variant installs lead callback prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "smb-franchise-location-faq",
                "workflow_name": "SMB lead callback",
                "variant_id": "booking_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "booking_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "schedule_lead_callback" in blob
    assert "scheduling_api_base_url" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_smb_location_router_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: smb location_router_complex variant installs talk-to-location prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "smb-franchise-location-faq",
                "workflow_name": "SMB location router",
                "variant_id": "location_router_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "location_router_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "route_call_to_location" in blob
    assert "locations_api_base_url" in blob
    assert "routing_policy_code" in blob


@pytest.mark.asyncio
async def test_install_from_catalog_smb_lead_capture_complex(
    test_client_factory, org_user_catalog_install
):
    """MK-01-PREBUILD: smb lead_capture_complex variant installs CRM lead capture prompts."""
    _, user = org_user_catalog_install
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/install-from-catalog",
            json={
                "slug": "smb-franchise-location-faq",
                "workflow_name": "SMB lead capture",
                "variant_id": "lead_capture_complex",
            },
        )
    assert res.status_code == 200
    data = res.json()
    mk01 = (data.get("workflow_configurations") or {}).get("mk01") or {}
    assert mk01.get("catalog_variant_id") == "lead_capture_complex"
    blob = json.dumps(data.get("workflow_definition") or {})
    assert "capture_lead_intent" in blob
    assert "crm_api_base_url" in blob
    assert "crm_lead_source_code" in blob


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
