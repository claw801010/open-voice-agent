"""Generate iCalendar (.ics) invites for local demo appointments (stdlib only)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


def _parse_iso_utc(iso: str) -> datetime:
    raw = iso.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _ics_datetime(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _escape_ics(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def build_appointment_ics(
    appointment: dict[str, Any],
    *,
    organizer_name: str = "Dograh Local Calendar",
    organizer_email: str = "calendar@local.dograh.demo",
    duration_minutes: int = 30,
) -> bytes:
    """Return UTF-8 ICS bytes for a booked local appointment row."""
    slot_start = str(appointment.get("slot_start") or "")
    start = _parse_iso_utc(slot_start)
    end = start + timedelta(minutes=max(5, duration_minutes))
    uid = f"{appointment.get('id', 'local')}@dograh.local"
    summary = appointment.get("visit_type") or "Appointment"
    patient = appointment.get("patient_name") or "Guest"
    description = f"Confirmation: {appointment.get('confirmation_code', '')}"
    attendee = appointment.get("attendee_email")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Dograh//Local Scheduling//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{_ics_datetime(datetime.now(timezone.utc))}",
        f"DTSTART:{_ics_datetime(start)}",
        f"DTEND:{_ics_datetime(end)}",
        f"SUMMARY:{_escape_ics(str(summary))} — {_escape_ics(str(patient))}",
        f"DESCRIPTION:{_escape_ics(description)}",
        f"ORGANIZER;CN={_escape_ics(organizer_name)}:mailto:{organizer_email}",
    ]
    if attendee:
        lines.append(f"ATTENDEE;CN={_escape_ics(str(patient))};RSVP=TRUE:mailto:{attendee}")
    lines.extend(["END:VEVENT", "END:VCALENDAR", ""])
    return "\r\n".join(lines).encode("utf-8")
