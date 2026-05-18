"""Unit tests: analytics redaction disable RBAC."""

import pytest

from api.db.models import UserModel
from api.services.analytics import redaction_policy_rbac as rbac


@pytest.mark.asyncio
async def test_local_auth_always_may_disable(monkeypatch):
    monkeypatch.setattr(rbac, "AUTH_PROVIDER", "local")
    monkeypatch.delenv("MK01_ANALYTICS_LOCAL_E2E_STRICT_REDACTION_RBAC", raising=False)
    u = UserModel(provider_id="x", is_superuser=False)
    ok = await rbac.compute_may_disable_detail_redaction(
        u, uses_api_key=False, authorization="Bearer t"
    )
    assert ok is True


@pytest.mark.asyncio
async def test_local_strict_rbac_blocks_non_superuser(monkeypatch):
    monkeypatch.setattr(rbac, "AUTH_PROVIDER", "local")
    monkeypatch.setenv("MK01_ANALYTICS_LOCAL_E2E_STRICT_REDACTION_RBAC", "1")
    monkeypatch.setenv("MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER", "true")
    monkeypatch.delenv("MK01_ANALYTICS_REDACTION_DISABLE_PERMISSION_ID", raising=False)
    u = UserModel(provider_id="x", is_superuser=False)
    ok = await rbac.compute_may_disable_detail_redaction(
        u, uses_api_key=False, authorization="Bearer t"
    )
    assert ok is False


@pytest.mark.asyncio
async def test_local_strict_rbac_allows_superuser(monkeypatch):
    monkeypatch.setattr(rbac, "AUTH_PROVIDER", "local")
    monkeypatch.setenv("MK01_ANALYTICS_LOCAL_E2E_STRICT_REDACTION_RBAC", "1")
    monkeypatch.setenv("MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER", "true")
    u = UserModel(provider_id="x", is_superuser=True)
    ok = await rbac.compute_may_disable_detail_redaction(
        u, uses_api_key=False, authorization="Bearer t"
    )
    assert ok is True


@pytest.mark.asyncio
async def test_api_key_never_may_disable(monkeypatch):
    monkeypatch.setattr(rbac, "AUTH_PROVIDER", "stack")
    u = UserModel(provider_id="x", is_superuser=True)
    ok = await rbac.compute_may_disable_detail_redaction(
        u, uses_api_key=True, authorization=None
    )
    assert ok is False


@pytest.mark.asyncio
async def test_superuser_stack_may_disable(monkeypatch):
    monkeypatch.setattr(rbac, "AUTH_PROVIDER", "stack")
    monkeypatch.delenv("MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER", raising=False)
    monkeypatch.delenv("MK01_ANALYTICS_REDACTION_DISABLE_PERMISSION_ID", raising=False)
    u = UserModel(provider_id="x", is_superuser=True)
    ok = await rbac.compute_may_disable_detail_redaction(
        u, uses_api_key=False, authorization="Bearer t"
    )
    assert ok is True


@pytest.mark.asyncio
async def test_requires_superuser_env_blocks_member(monkeypatch):
    monkeypatch.setattr(rbac, "AUTH_PROVIDER", "stack")
    monkeypatch.setenv("MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER", "true")
    monkeypatch.delenv("MK01_ANALYTICS_REDACTION_DISABLE_PERMISSION_ID", raising=False)
    u = UserModel(provider_id="x", is_superuser=False)
    ok = await rbac.compute_may_disable_detail_redaction(
        u, uses_api_key=False, authorization="Bearer t"
    )
    assert ok is False


@pytest.mark.asyncio
async def test_permission_id_requires_match(monkeypatch):
    monkeypatch.setattr(rbac, "AUTH_PROVIDER", "stack")
    monkeypatch.delenv("MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER", raising=False)
    monkeypatch.setenv("MK01_ANALYTICS_REDACTION_DISABLE_PERMISSION_ID", "perm_a")

    async def fake_stack_user(token):
        return {"id": "su1", "selected_team_id": "team1"}

    async def fake_list(_tok, _tid):
        return ["perm_b"]

    monkeypatch.setattr(rbac.stackauth, "get_user", fake_stack_user)

    u = UserModel(provider_id="x", is_superuser=False)
    ok = await rbac.compute_may_disable_detail_redaction(
        u,
        uses_api_key=False,
        authorization="Bearer t",
        list_team_permissions=fake_list,
    )
    assert ok is False

    async def fake_list_ok(_tok, _tid):
        return ["perm_a", "other"]

    ok2 = await rbac.compute_may_disable_detail_redaction(
        u,
        uses_api_key=False,
        authorization="Bearer t",
        list_team_permissions=fake_list_ok,
    )
    assert ok2 is True
