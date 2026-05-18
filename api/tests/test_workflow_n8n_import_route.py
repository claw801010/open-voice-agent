"""Integration tests: POST /api/v1/workflow/import/n8n-packaged-draft (MK-01-IMPORT-OPTIONS)."""

import json
from pathlib import Path

import pytest

from api.db.models import OrganizationModel, UserModel

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE = _REPO_ROOT / "catalog" / "fixtures" / "n8n-two-http-linear.json"
_FIXTURE_IF = _REPO_ROOT / "catalog" / "fixtures" / "n8n-if-two-branches-http.json"


@pytest.fixture
async def org_user_n8n_import(async_session):
    org = OrganizationModel(provider_id="test-n8n-import-org")
    async_session.add(org)
    await async_session.flush()
    user = UserModel(
        provider_id="test-n8n-import-user",
        selected_organization_id=org.id,
    )
    async_session.add(user)
    await async_session.flush()
    return org, user


@pytest.mark.asyncio
async def test_n8n_packaged_draft_happy_path(test_client_factory, org_user_n8n_import):
    _, user = org_user_n8n_import
    export = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/n8n-packaged-draft",
            json={"n8n_export": export},
        )
    assert res.status_code == 200
    body = res.json()
    wf_def = body["workflow_definition"]
    types = {n["type"] for n in wf_def["nodes"]}
    assert types == {"startCall", "agentNode", "endCall"}
    assert "Imported n8n HTTP Request nodes" in wf_def["nodes"][1]["data"]["prompt"]
    assert isinstance(body.get("warnings"), list)


@pytest.mark.asyncio
async def test_n8n_packaged_draft_skips_non_http_nodes_by_default(
    test_client_factory, org_user_n8n_import
):
    _, user = org_user_n8n_import
    export = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    export["nodes"].append(
        {
            "name": "Slack",
            "type": "n8n-nodes-base.slack",
            "typeVersion": 1,
            "position": [0, 0],
            "parameters": {},
        }
    )
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/n8n-packaged-draft",
            json={"n8n_export": export},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["workflow_definition"]["nodes"]
    assert any("Skipped non-HTTP" in w for w in body.get("warnings", []))


@pytest.mark.asyncio
async def test_n8n_packaged_draft_strict_rejects_non_http_nodes(
    test_client_factory, org_user_n8n_import
):
    _, user = org_user_n8n_import
    export = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    export["nodes"].append(
        {
            "name": "Slack",
            "type": "n8n-nodes-base.slack",
            "typeVersion": 1,
            "position": [0, 0],
            "parameters": {},
        }
    )
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/n8n-packaged-draft",
            json={"n8n_export": export, "strict_http_only": True},
        )
    assert res.status_code == 400
    assert "Unsupported" in res.json()["detail"] or "only HTTP" in res.json()["detail"]


@pytest.mark.asyncio
async def test_n8n_import_and_create_workflow(test_client_factory, org_user_n8n_import):
    _, user = org_user_n8n_import
    export = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/n8n-and-create",
            json={"name": "E2E n8n import", "n8n_export": export},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["id"] > 0
    assert body["name"] == "E2E n8n import"
    assert body["workflow_definition"]["nodes"]
    assert isinstance(body.get("warnings"), list)


@pytest.mark.asyncio
async def test_n8n_packaged_draft_if_branches_emit_subflows(
    test_client_factory, org_user_n8n_import
):
    _, user = org_user_n8n_import
    export = json.loads(_FIXTURE_IF.read_text(encoding="utf-8"))
    async with test_client_factory(user) as client:
        res = await client.post(
            "/api/v1/workflow/import/n8n-packaged-draft",
            json={"n8n_export": export},
        )
    assert res.status_code == 200
    body = res.json()
    wf_def = body["workflow_definition"]
    assert len(wf_def.get("subflows", {})) == 2
    assert any(
        e.get("data", {}).get("enter_subflow")
        for e in wf_def.get("edges", [])
    )
