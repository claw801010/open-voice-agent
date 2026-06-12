"""Local payments HTTP routes."""

from __future__ import annotations

import pytest

from api.routes.local_payments import (
    capture_payment_promise,
    confirm_payment_redirect,
    enroll_concierge_visit,
    get_config,
)
from api.services.local_payments import store


@pytest.fixture(autouse=True)
def _enable_local_payments(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_PAYMENTS", "true")


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "_PERSIST_DIR", tmp_path)
    store._STORE.clear()


@pytest.mark.asyncio
async def test_local_payments_config():
    cfg = await get_config()
    assert cfg.enabled is True
    assert "/api/v1/local-payments" in cfg.local_payments_base_url
    assert "/api/v1/visits/enroll" in cfg.visits_enroll_url


@pytest.mark.asyncio
async def test_concierge_enroll_route():
    res = await enroll_concierge_visit(
        type(
            "Body",
            (),
            {
                "visit_type": "priority",
                "slot_start": "2026-11-01T14:00:00Z",
                "patient_name": "Alex",
                "organization_id": 503,
            },
        )()
    )
    assert res["appointment"]["id"].startswith("local-enroll-")
    assert res["confirmation_code"]
    rows = store.list_records(503)
    assert any(r["type"] == "concierge_enroll" for r in rows)


@pytest.mark.asyncio
async def test_payment_promise_creates_persist_dir_when_missing(tmp_path, monkeypatch):
    """Regression: first write must mkdir _PERSIST_DIR (GTM demo / fresh dev)."""
    fresh = tmp_path / "nested" / "local_payments"
    assert not fresh.is_dir()
    monkeypatch.setattr(store, "_PERSIST_DIR", fresh)
    store._STORE.clear()

    res = await capture_payment_promise(
        type(
            "Body",
            (),
            {
                "account_reference": "A0",
                "promised_amount": "10",
                "promised_date": None,
                "notes": None,
                "organization_id": 500,
            },
        )()
    )
    assert res["confirmation_code"]
    assert fresh.is_dir()
    assert (fresh / "org_500.json").is_file()


@pytest.mark.asyncio
async def test_payment_promise_route():
    res = await capture_payment_promise(
        type(
            "Body",
            (),
            {
                "account_reference": "A1",
                "promised_amount": "25",
                "promised_date": "2026-10-01T00:00:00Z",
                "notes": None,
                "organization_id": 501,
            },
        )()
    )
    assert res["confirmation_code"]
    assert store.list_records(501)


@pytest.mark.asyncio
async def test_payment_redirect_route():
    res = await confirm_payment_redirect(
        type(
            "Body",
            (),
            {
                "account_reference": "A2",
                "redirect_url": "https://pay.test/r",
                "reason_code": "X",
                "organization_id": 502,
            },
        )()
    )
    assert res["redirect_id"]
    assert res["portal_url"] == "https://pay.test/r"
