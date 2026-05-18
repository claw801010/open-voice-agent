"""Integration tests: POST /api/v1/workflow/import/make-packaged-draft (MK-01-IMPORT-OPTIONS)."""

import json
from pathlib import Path

import pytest

from api.db.models import OrganizationModel, UserModel

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE = _REPO_ROOT / "catalog" / "fixtures" / "make-router-two-http.json"


@pytest.fixture
async def org_user_make_import(async_session):
    org = OrganizationModel(provider_id="test-make-import-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(
        provider_id="test-make-import-user",
        selected_organization_id=org.id,
    )
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_make_packaged_draft_happy_path(test_client_factory, org_user_make_import):
    _, user = org_user_make_import
    export = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/make-packaged-draft",
            json={"make_blueprint": export},
        )
    assert res.status_code == 200
    body = res.json()
    wf_def = body["workflow_definition"]
    assert wf_def["nodes"]
    assert len(wf_def.get("subflows", {})) == 2
    assert isinstance(body.get("warnings"), list)


@pytest.mark.asyncio
async def test_make_import_and_create_workflow(test_client_factory, org_user_make_import):
    _, user = org_user_make_import
    export = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/make-and-create",
            json={"name": "E2E Make import", "make_blueprint": export},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["id"] > 0
    assert body["name"] == "E2E Make import"
    assert body["workflow_definition"]["nodes"]
