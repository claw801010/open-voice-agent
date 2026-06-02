"""Unit tests for local integrations store."""

from pathlib import Path

import pytest

from api.services.local_integrations import store


@pytest.fixture(autouse=True)
def _enable_local_integrations(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_INTEGRATIONS", "true")


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(store, "_PERSIST_DIR", tmp_path)
    store._STORE.clear()


def test_record_action_booking_shape():
    payload = store.record_action(
        20,
        "outage_status",
        path="/api/v1/outages/status",
        body={"status_code": "ACTIVE", "service_area_code": "90210"},
    )
    assert payload["appointment"]["id"].startswith("local-outage_status-")
    assert payload["confirmation_code"] == "ACTIVE"
    rows = store.list_records(20)
    assert rows[0]["type"] == "outage_status"


def test_list_records():
    store.record_action(21, "deal_stage", path="/api/v1/deals/stage", body={})
    assert len(store.list_records(21)) == 1
