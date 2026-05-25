"""Unit tests for local open schedule configuration."""

from pathlib import Path

import pytest

from api.services.local_scheduling import schedule_config


@pytest.fixture(autouse=True)
def _isolated_schedule_config(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(schedule_config, "_PERSIST_DIR", tmp_path)
    schedule_config._CONFIG.clear()


def test_default_open_schedule():
    cfg = schedule_config.get_open_schedule(42)
    assert cfg["slot_times_utc"] == list(schedule_config.DEFAULT_OPEN_SLOT_TIMES_UTC)


def test_set_open_schedule_persists():
    org = 43
    saved = schedule_config.set_open_schedule(org, ["10:00", "15:00", "10:00"])
    assert saved["slot_times_utc"] == ["10:00", "15:00"]
    assert schedule_config.get_open_schedule(org)["slot_times_utc"] == ["10:00", "15:00"]


def test_invalid_slot_time_raises():
    with pytest.raises(ValueError, match="Invalid slot time"):
        schedule_config.normalize_slot_times(["25:99"])


def test_open_slots_for_day_uses_custom_times():
    org = 44
    schedule_config.set_open_schedule(org, ["08:00", "12:00"])
    slots = schedule_config.open_slots_for_day(org, "2026-07-01")
    assert [s["start"] for s in slots] == ["2026-07-01T08:00:00Z", "2026-07-01T12:00:00Z"]
