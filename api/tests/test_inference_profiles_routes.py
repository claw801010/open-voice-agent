"""Integration tests: /api/v1/inference-profiles list, apply, capabilities, setup."""

from unittest.mock import AsyncMock, patch

import pytest

from api.db.models import OrganizationModel, UserModel
from api.services.configuration.inference_profiles import DEFAULT_INFERENCE_PROFILE_ID


@pytest.fixture
async def org_user_inference_profiles(async_session):
    org = OrganizationModel(provider_id="test-inference-profiles-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(
        provider_id="test-inference-profiles-user",
        selected_organization_id=org.id,
    )
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_list_inference_profiles_includes_catalog(
    test_client_factory, org_user_inference_profiles
):
    _, user = org_user_inference_profiles
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/inference-profiles")
    assert res.status_code == 200
    data = res.json()
    ids = {p["id"] for p in data["profiles"]}
    assert "cloud_balanced" in ids
    assert "local_edge_lean" in ids
    assert "hybrid_edge" in ids
    assert data["default_profile_id"] == DEFAULT_INFERENCE_PROFILE_ID
    assert data["capabilities"] is not None
    assert isinstance(data["capabilities"]["components"], list)


@pytest.mark.asyncio
async def test_apply_local_edge_profile_persists_config(
    test_client_factory, org_user_inference_profiles
):
    _, user = org_user_inference_profiles
    async with test_client_factory(user) as client:
        res = await client.post("/api/v1/inference-profiles/local_edge_lean/apply")
    assert res.status_code == 200
    body = res.json()
    assert body["profile_id"] == "local_edge_lean"
    assert body["tier"] == "local"
    assert body["configuration"]["stt"]["base_url"] == "http://localhost:8100/v1"


@pytest.mark.asyncio
async def test_apply_cloud_profile_persists_config(
    test_client_factory, org_user_inference_profiles
):
    _, user = org_user_inference_profiles
    async with test_client_factory(user) as client:
        res = await client.post("/api/v1/inference-profiles/cloud_balanced/apply")
    assert res.status_code == 200
    body = res.json()
    assert body["profile_id"] == "cloud_balanced"
    assert body["tier"] == "cloud"
    assert body["configuration"]["llm"]["provider"] == "openai"


@pytest.mark.asyncio
async def test_apply_unknown_profile_returns_404(
    test_client_factory, org_user_inference_profiles
):
    _, user = org_user_inference_profiles
    async with test_client_factory(user) as client:
        res = await client.post("/api/v1/inference-profiles/does-not-exist/apply")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_capabilities_scan(test_client_factory, org_user_inference_profiles):
    _, user = org_user_inference_profiles
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/inference-profiles/capabilities")
    assert res.status_code == 200
    data = res.json()
    assert data["default_profile_id"] == DEFAULT_INFERENCE_PROFILE_ID
    assert {c["id"] for c in data["components"]} == {"ollama", "speaches"}


@pytest.mark.asyncio
async def test_setup_local_inference_mocked(
    test_client_factory, org_user_inference_profiles, monkeypatch
):
    _, user = org_user_inference_profiles
    monkeypatch.setenv("ENVIRONMENT", "local")

    fake_caps = {
        "version": 1,
        "default_profile_id": DEFAULT_INFERENCE_PROFILE_ID,
        "local_stack_ready": False,
        "docker_available": False,
        "components": [],
    }

    with patch(
        "api.routes.inference_profiles.run_local_inference_setup",
        new=AsyncMock(
            return_value={
                "steps": [{"id": "pull_ollama", "status": "skipped", "message": "ok"}],
                "capabilities": fake_caps,
            }
        ),
    ):
        async with test_client_factory(user) as client:
            res = await client.post(
                "/api/v1/inference-profiles/setup",
                json={
                    "start_speaches": False,
                    "pull_ollama": False,
                    "apply_profile_id": "local_edge_lean",
                },
            )
    assert res.status_code == 200
    body = res.json()
    assert body["applied_profile_id"] == "local_edge_lean"
    assert body["configuration"] is not None
    assert body["configuration"]["stt"]["base_url"] == "http://localhost:8100/v1"
