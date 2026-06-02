"""Local demo calendar store + booking JSON shape (MK-01 GTM)."""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from api.constants import APP_ROOT_DIR, BACKEND_API_ENDPOINT

from api.services.local_scheduling import schedule_config

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
    attendee_email: str | None = None
    duration_minutes: int = 30

    def to_booking_response(self) -> dict[str, Any]:
        invite_path = f"/api/v1/local-scheduling/appointments/{self.id}/invite.ics"
        base = BACKEND_API_ENDPOINT.rstrip("/")
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
            "invite_download_url": f"{base}{invite_path}",
            "invite_ics_path": invite_path,
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


def _rows_for_org(org_id: int) -> list[dict[str, Any]]:
    if org_id not in _STORE:
        _STORE[org_id] = _load_org(org_id)
    return list(_STORE[org_id])


def list_appointments(org_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        return _rows_for_org(org_id)


def get_appointment(org_id: int, appointment_id: str) -> dict[str, Any] | None:
    for row in list_appointments(org_id):
        if row.get("id") == appointment_id and row.get("status") != "cancelled":
            return row
    return None


def _booked_slot_starts(org_id: int, date_yyyy_mm_dd: str) -> set[str]:
    prefix = f"{date_yyyy_mm_dd}T"
    booked: set[str] = set()
    for row in list_appointments(org_id):
        if row.get("status") == "cancelled":
            continue
        slot = str(row.get("slot_start") or "")
        if slot.startswith(prefix):
            booked.add(slot)
    return booked


def book_appointment(
    org_id: int,
    *,
    slot_start: str,
    patient_name: str = "Demo patient",
    visit_type: str = "general",
    attendee_email: str | None = None,
    duration_minutes: int = 30,
) -> dict[str, Any]:
    if slot_start in _booked_slot_starts(org_id, slot_start[:10]):
        raise ValueError(f"Slot already booked: {slot_start}")
    appt = LocalAppointment(
        id=f"local-appt-{uuid.uuid4().hex[:12]}",
        slot_start=slot_start,
        patient_name=patient_name,
        visit_type=visit_type,
        attendee_email=attendee_email,
        duration_minutes=max(5, min(duration_minutes, 240)),
    )
    row = appt.to_row()
    with _LOCK:
        if org_id not in _STORE:
            _STORE[org_id] = _load_org(org_id)
        rows = _rows_for_org(org_id)
        rows.append(row)
        _STORE[org_id] = rows
        _save_org(org_id, rows)
    return appt.to_booking_response()


def cancel_appointment(org_id: int, appointment_id: str) -> bool:
    with _LOCK:
        rows = _rows_for_org(org_id)
        found = False
        next_rows: list[dict[str, Any]] = []
        for r in rows:
            if r.get("id") == appointment_id:
                found = True
                updated = dict(r)
                updated["status"] = "cancelled"
                next_rows.append(updated)
            else:
                next_rows.append(r)
        if not found:
            return False
        _STORE[org_id] = next_rows
        _save_org(org_id, next_rows)
    return True


def _booked_slot_starts_excluding(
    org_id: int,
    date_yyyy_mm_dd: str,
    *,
    exclude_appointment_id: str | None = None,
) -> set[str]:
    prefix = f"{date_yyyy_mm_dd}T"
    booked: set[str] = set()
    for row in _rows_for_org(org_id):
        if row.get("status") == "cancelled":
            continue
        if exclude_appointment_id and row.get("id") == exclude_appointment_id:
            continue
        slot = str(row.get("slot_start") or "")
        if slot.startswith(prefix):
            booked.add(slot)
    return booked


def reschedule_appointment(
    org_id: int,
    *,
    slot_start: str,
    appointment_id: str | None = None,
    patient_name: str | None = None,
) -> dict[str, Any]:
    with _LOCK:
        rows = _rows_for_org(org_id)
        target_idx: int | None = None
        if appointment_id:
            for i, row in enumerate(rows):
                if row.get("id") == appointment_id and row.get("status") != "cancelled":
                    target_idx = i
                    break
            if target_idx is None:
                raise ValueError(f"Appointment not found: {appointment_id}")
        else:
            active = [i for i, r in enumerate(rows) if r.get("status") != "cancelled"]
            if not active:
                raise ValueError("No active appointment to reschedule")
            target_idx = active[-1]

        exclude_id = rows[target_idx].get("id")
        prefix = f"{slot_start[:10]}T"
        booked: set[str] = set()
        for row in rows:
            if row.get("status") == "cancelled":
                continue
            if exclude_id and row.get("id") == exclude_id:
                continue
            slot = str(row.get("slot_start") or "")
            if slot.startswith(prefix):
                booked.add(slot)
        if slot_start in booked:
            raise ValueError(f"Slot already booked: {slot_start}")

        updated = dict(rows[target_idx])
        updated["slot_start"] = slot_start
        if patient_name:
            updated["patient_name"] = patient_name
        updated["rescheduled_at"] = datetime.now(timezone.utc).isoformat()
        next_rows = list(rows)
        next_rows[target_idx] = updated
        _STORE[org_id] = next_rows
        _save_org(org_id, next_rows)

    appt = LocalAppointment(**{k: updated[k] for k in LocalAppointment.__dataclass_fields__ if k in updated})
    return appt.to_booking_response()


def default_open_slots(date_yyyy_mm_dd: str, org_id: int = 1) -> list[dict[str, str]]:
    """Return open slots for a calendar day (UTC ISO start), using org schedule when set."""
    return schedule_config.open_slots_for_day(org_id, date_yyyy_mm_dd)


def available_open_slots(org_id: int, date_yyyy_mm_dd: str) -> list[dict[str, str]]:
    """Open slots minus already-booked times for this org/day."""
    booked = _booked_slot_starts(org_id, date_yyyy_mm_dd)
    out: list[dict[str, str]] = []
    for slot in default_open_slots(date_yyyy_mm_dd, org_id):
        start = slot["start"]
        if start in booked:
            out.append({"start": start, "available": "false"})
        else:
            out.append({"start": start, "available": "true"})
    return out
