"""Integration tests: /api/v1/voice-profiles CRUD and org default."""

import pytest

from api.db.models import OrganizationModel, UserModel
from api.services.voice.presets import DEFAULT_BUILTIN_PROFILE_ID


@pytest.fixture
async def org_user_voice_profiles(async_session):
    org = OrganizationModel(provider_id="test-voice-profiles-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(
        provider_id="test-voice-profiles-user",
        selected_organization_id=org.id,
    )
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_list_voice_profiles_includes_builtins(
    test_client_factory, org_user_voice_profiles
):
    _, user = org_user_voice_profiles
    async with test_client_factory(user) as client:
        res = await client.get("/api/v1/voice-profiles")
    assert res.status_code == 200
    data = res.json()
    assert data["default_profile_id"] == DEFAULT_BUILTIN_PROFILE_ID
    ids = {p["id"] for p in data["profiles"]}
    assert DEFAULT_BUILTIN_PROFILE_ID in ids
    assert any(p["is_builtin"] for p in data["profiles"])


@pytest.mark.asyncio
async def test_create_clone_and_set_org_default(
    test_client_factory, org_user_voice_profiles
):
    _, user = org_user_voice_profiles
    async with test_client_factory(user) as client:
        create = await client.post(
            "/api/v1/voice-profiles",
            json={
                "name": "E2E warm clone",
                "clone_from_profile_id": "builtin:warm_conversational",
            },
        )
        assert create.status_code == 201
        custom_id = create.json()["id"]
        assert create.json()["cloned_from_id"] == "builtin:warm_conversational"

        put_default = await client.put(
            "/api/v1/voice-profiles/org-default",
            json={"profile_id": custom_id},
        )
        assert put_default.status_code == 200
        assert put_default.json()["default_profile_id"] == custom_id

        get_one = await client.get(f"/api/v1/voice-profiles/{custom_id}")
        assert get_one.status_code == 200
        assert get_one.json()["name"] == "E2E warm clone"

        delete = await client.delete(f"/api/v1/voice-profiles/{custom_id}")
        assert delete.status_code == 204

        listed = await client.get("/api/v1/voice-profiles")
        assert listed.status_code == 200
        assert all(p["id"] != custom_id for p in listed.json()["profiles"])


@pytest.mark.asyncio
async def test_cannot_delete_builtin_preset(
    test_client_factory, org_user_voice_profiles
):
    _, user = org_user_voice_profiles
    async with test_client_factory(user) as client:
        res = await client.delete(f"/api/v1/voice-profiles/{DEFAULT_BUILTIN_PROFILE_ID}")
    assert res.status_code == 422
