"""Integration tests: Zapier + skill import routes (MK-01-IMPORT-OPTIONS)."""

import json
from pathlib import Path

import pytest

from api.db.models import OrganizationModel, UserModel

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ZAPIER = _REPO_ROOT / "catalog" / "fixtures" / "zapier-paths-two-http.json"
_SKILL = _REPO_ROOT / "catalog" / "fixtures" / "skill-booking-draft.sample.md"


@pytest.fixture
async def org_user_import(async_session):
    org = OrganizationModel(provider_id="test-zap-skill-import-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(
        provider_id="test-zap-skill-import-user",
        selected_organization_id=org.id,
    )
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_zapier_packaged_draft(test_client_factory, org_user_import):
    _, user = org_user_import
    export = json.loads(_ZAPIER.read_text(encoding="utf-8"))
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/zapier-packaged-draft",
            json={"zapier_export": export},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["workflow_definition"]["nodes"]
    assert len(body["workflow_definition"].get("subflows", {})) == 2


@pytest.mark.asyncio
async def test_skill_packaged_draft(test_client_factory, org_user_import):
    _, user = org_user_import
    md = _SKILL.read_text(encoding="utf-8")
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/skill-packaged-draft",
            json={"skill_markdown": md, "skill_title": "Booking skill"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["workflow_definition"]["nodes"]
    assert "patient_name" in body.get("suggested_template_variables", [])


@pytest.mark.asyncio
async def test_skill_import_and_create(test_client_factory, org_user_import):
    _, user = org_user_import
    md = _SKILL.read_text(encoding="utf-8")
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/skill-and-create",
            json={"name": "From skill", "skill_markdown": md},
        )
    assert res.status_code == 200
    assert res.json()["name"] == "From skill"
