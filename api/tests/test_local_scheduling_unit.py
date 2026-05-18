"""Local demo calendar store + booking JSON shape (MK-01 GTM)."""

import os

import pytest

from api.services.local_scheduling import store


@pytest.fixture(autouse=True)
def _enable_local_scheduling(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_SCHEDULING", "true")


def test_book_appointment_returns_catalog_sample_shape():
    payload = store.book_appointment(
        99,
        slot_start="2026-04-25T15:00:00Z",
        patient_name="Test Patient",
        visit_type="general",
    )
    assert payload["appointment"]["id"]
    assert payload["appointment"]["status"] == "confirmed"
    assert payload["appointment"]["slot"]["start"] == "2026-04-25T15:00:00Z"
    assert payload["confirmation_code"]


def test_list_and_cancel_appointment():
    org = 100
    payload = store.book_appointment(org, slot_start="2026-05-01T10:00:00Z")
    appt_id = payload["appointment"]["id"]
    rows = store.list_appointments(org)
    assert any(r["id"] == appt_id for r in rows)
    assert store.cancel_appointment(org, appt_id)
    assert not any(r["id"] == appt_id for r in store.list_appointments(org))


def test_default_open_slots():
    slots = store.default_open_slots("2026-06-01")
    assert len(slots) >= 3
    assert slots[0]["start"].startswith("2026-06-01")
