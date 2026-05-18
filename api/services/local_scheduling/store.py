"""In-memory + optional file-backed local demo calendar (LOCAL / GTM only)."""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from api.constants import APP_ROOT_DIR

_LOCK = threading.Lock()
_STORE: dict[int, list[dict[str, Any]]] = {}
_PERSIST_DIR = APP_ROOT_DIR.parent / "run" / "local_scheduling"


@dataclass
class LocalAppointment:
    id: str
    slot_start: str
    patient_name: str
    visit_type: str
    status: str = "confirmed"
    resource_id: str = "local-demo-1"
    confirmation_code: str = field(default_factory=lambda: uuid.uuid4().hex[:6].upper())
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )

    def to_booking_response(self) -> dict[str, Any]:
        return {
            "appointment": {
                "id": self.id,
                "status": self.status,
                "slot": {
                    "start": self.slot_start,
                    "resource_id": self.resource_id,
                },
            },
            "confirmation_code": self.confirmation_code,
        }

    def to_row(self) -> dict[str, Any]:
        return asdict(self)


def _persist_path(org_id: int) -> Path:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    return _PERSIST_DIR / f"org_{org_id}.json"


def _load_org(org_id: int) -> list[dict[str, Any]]:
    path = _persist_path(org_id)
    if not path.is_file():
        return []
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_org(org_id: int, rows: list[dict[str, Any]]) -> None:
    path = _persist_path(org_id)
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)


def list_appointments(org_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        if org_id not in _STORE:
            _STORE[org_id] = _load_org(org_id)
        return list(_STORE[org_id])


def book_appointment(
    org_id: int,
    *,
    slot_start: str,
    patient_name: str = "Demo patient",
    visit_type: str = "general",
) -> dict[str, Any]:
    appt = LocalAppointment(
        id=f"local-appt-{uuid.uuid4().hex[:12]}",
        slot_start=slot_start,
        patient_name=patient_name,
        visit_type=visit_type,
    )
    row = appt.to_row()
    with _LOCK:
        if org_id not in _STORE:
            _STORE[org_id] = _load_org(org_id)
        rows = list(_STORE[org_id])
        rows.append(row)
        _STORE[org_id] = rows
        _save_org(org_id, rows)
    return appt.to_booking_response()


def cancel_appointment(org_id: int, appointment_id: str) -> bool:
    with _LOCK:
        rows = list_appointments(org_id)
        next_rows = [r for r in rows if r.get("id") != appointment_id]
        if len(next_rows) == len(rows):
            return False
        _STORE[org_id] = next_rows
        _save_org(org_id, next_rows)
    return True


def default_open_slots(date_yyyy_mm_dd: str) -> list[dict[str, str]]:
    """Return a small set of demo slots for a calendar day (UTC ISO start)."""
    return [
        {"start": f"{date_yyyy_mm_dd}T09:00:00Z", "available": "true"},
        {"start": f"{date_yyyy_mm_dd}T11:30:00Z", "available": "true"},
        {"start": f"{date_yyyy_mm_dd}T14:00:00Z", "available": "true"},
        {"start": f"{date_yyyy_mm_dd}T16:30:00Z", "available": "true"},
    ]
