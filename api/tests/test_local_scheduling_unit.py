"""Unit tests for local scheduling store and ICS generation."""

from pathlib import Path

import pytest

from api.services.local_scheduling import store
from api.services.local_scheduling.ics import build_appointment_ics


@pytest.fixture(autouse=True)
def _enable_local_scheduling(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_SCHEDULING", "true")


@pytest.fixture(autouse=True)
def _isolated_local_scheduling_store(tmp_path: Path, monkeypatch):
    """Use a fresh JSON store per test (avoid cross-run slot conflicts)."""
    monkeypatch.setattr(store, "_PERSIST_DIR", tmp_path)
    store._STORE.clear()


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
    assert payload["invite_download_url"]
    assert "/invite.ics" in payload["invite_ics_path"]


def test_list_and_cancel_appointment():
    org = 100
    payload = store.book_appointment(org, slot_start="2026-05-01T10:00:00Z")
    appt_id = payload["appointment"]["id"]
    rows = store.list_appointments(org)
    assert any(r["id"] == appt_id for r in rows)
    assert store.cancel_appointment(org, appt_id)
    assert store.get_appointment(org, appt_id) is None


def test_default_open_slots():
    slots = store.default_open_slots("2026-06-01")
    assert len(slots) >= 3
    assert slots[0]["start"].startswith("2026-06-01")


def test_available_open_slots_excludes_booked():
    org = 101
    store.book_appointment(org, slot_start="2026-06-01T09:00:00Z")
    slots = store.available_open_slots(org, "2026-06-01")
    nine = next(s for s in slots if s["start"] == "2026-06-01T09:00:00Z")
    assert nine["available"] == "false"
    open_slot = next(s for s in slots if s["start"] == "2026-06-01T11:30:00Z")
    assert open_slot["available"] == "true"


def test_double_book_same_slot_raises():
    org = 102
    store.book_appointment(org, slot_start="2026-07-01T14:00:00Z")
    with pytest.raises(ValueError, match="already booked"):
        store.book_appointment(org, slot_start="2026-07-01T14:00:00Z")


def test_reschedule_appointment_updates_slot():
    org = 103
    booked = store.book_appointment(org, slot_start="2026-09-01T09:00:00Z")
    appt_id = booked["appointment"]["id"]
    rescheduled = store.reschedule_appointment(
        org,
        appointment_id=appt_id,
        slot_start="2026-09-01T11:30:00Z",
    )
    assert rescheduled["appointment"]["id"] == appt_id
    assert rescheduled["appointment"]["slot"]["start"] == "2026-09-01T11:30:00Z"


def test_reschedule_to_booked_slot_raises():
    org = 104
    first = store.book_appointment(org, slot_start="2026-09-02T09:00:00Z")
    store.book_appointment(org, slot_start="2026-09-02T11:30:00Z")
    with pytest.raises(ValueError, match="already booked"):
        store.reschedule_appointment(
            org,
            appointment_id=first["appointment"]["id"],
            slot_start="2026-09-02T11:30:00Z",
        )


def test_build_appointment_ics_contains_vevent():
    row = {
        "id": "local-appt-demo",
        "slot_start": "2026-08-01T10:00:00Z",
        "patient_name": "Alex",
        "visit_type": "consultation",
        "confirmation_code": "ABC123",
        "attendee_email": "alex@example.com",
        "duration_minutes": 30,
    }
    ics = build_appointment_ics(row).decode("utf-8")
    assert "BEGIN:VCALENDAR" in ics
    assert "BEGIN:VEVENT" in ics
    assert "alex@example.com" in ics
