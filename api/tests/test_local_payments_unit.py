"""Unit tests for local payments store."""

from pathlib import Path

import pytest

from api.services.local_payments import store


@pytest.fixture(autouse=True)
def _enable_local_payments(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_PAYMENTS", "true")


@pytest.fixture(autouse=True)
def _isolated_local_payments_store(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(store, "_PERSIST_DIR", tmp_path)
    store._STORE.clear()


def test_capture_payment_promise_booking_shape():
    payload = store.capture_payment_promise(
        10,
        account_reference="ACCT-1",
        promised_amount="50.00",
        promised_date="2026-08-15T00:00:00Z",
    )
    assert payload["appointment"]["id"].startswith("local-promise-")
    assert payload["confirmation_code"]
    assert payload["appointment"]["slot"]["start"] == "2026-08-15T00:00:00Z"


def test_confirm_payment_redirect_includes_redirect_fields():
    payload = store.confirm_payment_redirect(
        11,
        account_reference="ACCT-2",
        redirect_url="https://pay.example.com/x",
        reason_code="VOICE-PAY",
    )
    assert payload["redirect_id"]
    assert payload["portal_url"] == "https://pay.example.com/x"
    assert payload["appointment"]["id"].startswith("local-redirect-")


def test_enroll_concierge_visit_booking_shape():
    payload = store.enroll_concierge_visit(
        13,
        visit_type="priority",
        slot_start="2026-11-15T10:00:00Z",
        patient_name="Jordan",
    )
    assert payload["appointment"]["id"].startswith("local-enroll-")
    assert payload["confirmation_code"]
    assert payload["appointment"]["slot"]["start"] == "2026-11-15T10:00:00Z"
    rows = store.list_records(13)
    assert rows[0]["type"] == "concierge_enroll"


def test_list_records():
    store.capture_payment_promise(12, promised_date="2026-09-01T00:00:00Z")
    rows = store.list_records(12)
    assert len(rows) == 1
    assert rows[0]["type"] == "payment_promise"
