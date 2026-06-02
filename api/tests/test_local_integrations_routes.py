"""Local integrations HTTP routes."""

from __future__ import annotations

import pytest

from api.routes.local_integrations import IntegrationRequest, get_config, outages_status
from api.services.local_integrations import store


@pytest.fixture(autouse=True)
def _enable_local_integrations(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_INTEGRATIONS", "true")


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "_PERSIST_DIR", tmp_path)
    store._STORE.clear()


@pytest.mark.asyncio
async def test_local_integrations_config():
    cfg = await get_config()
    assert cfg.enabled is True
    assert "/api/v1/local-integrations" in cfg.local_integrations_base_url
    assert "outages_status" in cfg.endpoints


@pytest.mark.asyncio
async def test_outage_status_route():
    res = await outages_status(
        IntegrationRequest(
            utility_name="Demo Utility",
            service_area_code="12345",
            organization_id=601,
        )
    )
    assert res["appointment"]["id"]
    assert store.list_records(601)
