"""Per-org open slot schedule for local demo calendar (MK-01 all-in-one)."""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any

from api.constants import APP_ROOT_DIR

_LOCK = threading.Lock()
_CONFIG: dict[int, dict[str, Any]] = {}
_PERSIST_DIR = APP_ROOT_DIR.parent / "run" / "local_scheduling"

DEFAULT_OPEN_SLOT_TIMES_UTC = ("09:00", "11:30", "14:00", "16:30")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def normalize_slot_times(times: list[str]) -> list[str]:
    """Validate and normalize HH:MM UTC slot starts (1–12 unique times)."""
    if not times:
        raise ValueError("At least one open slot time is required")
    if len(times) > 12:
        raise ValueError("At most 12 open slot times allowed")
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in times:
        token = str(raw).strip()
        if not _TIME_RE.match(token):
            raise ValueError(f"Invalid slot time (use HH:MM UTC): {raw!r}")
        if token in seen:
            continue
        seen.add(token)
        normalized.append(token)
    normalized.sort()
    return normalized


def _config_path(org_id: int) -> Path:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    return _PERSIST_DIR / f"org_{org_id}_open_schedule.json"


def _load_org(org_id: int) -> dict[str, Any]:
    path = _config_path(org_id)
    if not path.is_file():
        return {"slot_times_utc": list(DEFAULT_OPEN_SLOT_TIMES_UTC)}
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        times = data.get("slot_times_utc") if isinstance(data, dict) else None
        if isinstance(times, list) and times:
            return {"slot_times_utc": normalize_slot_times([str(t) for t in times])}
    except (json.JSONDecodeError, OSError, ValueError):
        pass
    return {"slot_times_utc": list(DEFAULT_OPEN_SLOT_TIMES_UTC)}


def _save_org(org_id: int, config: dict[str, Any]) -> None:
    path = _config_path(org_id)
    with path.open("w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def get_open_schedule(org_id: int) -> dict[str, Any]:
    with _LOCK:
        if org_id not in _CONFIG:
            _CONFIG[org_id] = _load_org(org_id)
        return dict(_CONFIG[org_id])


def set_open_schedule(org_id: int, slot_times_utc: list[str]) -> dict[str, Any]:
    times = normalize_slot_times(slot_times_utc)
    payload = {"slot_times_utc": times}
    with _LOCK:
        _CONFIG[org_id] = payload
        _save_org(org_id, payload)
    return dict(payload)


def open_slots_for_day(org_id: int, date_yyyy_mm_dd: str) -> list[dict[str, str]]:
    times = get_open_schedule(org_id).get("slot_times_utc") or list(DEFAULT_OPEN_SLOT_TIMES_UTC)
    return [
        {"start": f"{date_yyyy_mm_dd}T{time}:00Z", "available": "true"}
        for time in times
    ]
