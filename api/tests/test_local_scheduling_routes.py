"""Local scheduling HTTP routes (all-in-one booking + calendar invites)."""

from __future__ import annotations

import pytest

from api.routes.local_scheduling import (
    book_slot,
    book_slot_catalog_alias,
    download_appointment_invite,
    get_config,
    lookup_availability,
)
from api.schemas.user_configuration import UserConfiguration  # noqa: F401 — ensure imports load
from api.services.local_scheduling import store


@pytest.fixture(autouse=True)
def _enable_local_scheduling(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_SCHEDULING", "true")


@pytest.fixture(autouse=True)
def _isolated_local_scheduling_store(tmp_path, monkeypatch):
    from api.services.local_scheduling import schedule_config

    monkeypatch.setattr(store, "_PERSIST_DIR", tmp_path)
    monkeypatch.setattr(schedule_config, "_PERSIST_DIR", tmp_path)
    store._STORE.clear()
    schedule_config._CONFIG.clear()


@pytest.mark.asyncio
async def test_local_scheduling_config_includes_base_url():
    cfg = await get_config()
    assert cfg.enabled is True
    assert cfg.scheduling_api_base_url.endswith("/api/v1/local-scheduling")
    assert cfg.open_schedule_url.endswith("/open-schedule")
    assert len(cfg.default_open_slot_times_utc) >= 1
    assert "all-in-one" in cfg.message.lower()


@pytest.mark.asyncio
async def test_book_slot_and_download_ics():
    org = 501
    res = await book_slot(
        type(
            "Body",
            (),
            {
                "slot_start": "2026-09-01T11:30:00Z",
                "patient_name": "Pat",
                "visit_type": "demo",
                "attendee_email": "pat@example.com",
                "duration_minutes": 30,
                "organization_id": org,
            },
        )()
    )
    appt_id = res.appointment["id"]
    assert res.invite_download_url
    response = await download_appointment_invite(appt_id, organization_id=org)
    assert response.media_type.startswith("text/calendar")
    body = response.body.decode("utf-8")
    assert "BEGIN:VEVENT" in body


@pytest.mark.asyncio
async def test_catalog_appointments_alias_matches_book_slot():
    org = 502
    body = type(
        "Body",
        (),
        {
            "slot_start": "2026-09-02T14:00:00Z",
            "patient_name": "Alias",
            "visit_type": "general",
            "attendee_email": None,
            "duration_minutes": 30,
            "organization_id": org,
        },
    )()
    res = await book_slot_catalog_alias(body)
    assert res.confirmation_code
    rows = store.list_appointments(org)
    assert any(r["id"] == res.appointment["id"] for r in rows)


@pytest.mark.asyncio
async def test_lookup_availability_marks_booked_slots():
    org = 503
    await book_slot(
        type(
            "Body",
            (),
            {
                "slot_start": "2026-09-03T09:00:00Z",
                "patient_name": "X",
                "visit_type": "general",
                "attendee_email": None,
                "duration_minutes": 30,
                "organization_id": org,
            },
        )()
    )
    out = await lookup_availability(on="2026-09-03", organization_id=org)
    nine = next(s for s in out["slots"] if s["start"] == "2026-09-03T09:00:00Z")
    assert nine["available"] == "false"
