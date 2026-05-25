"""Local demo calendar API for booking GTM / vertical packs (no external scheduler)."""

from __future__ import annotations

from datetime import date as date_type
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from api.constants import BACKEND_API_ENDPOINT, ENABLE_LOCAL_SCHEDULING
from api.db.models import UserModel
from api.services.auth.depends import get_user
from api.services.local_scheduling import schedule_config, store
from api.services.local_scheduling.ics import build_appointment_ics

router = APIRouter(prefix="/local-scheduling", tags=["local-scheduling"])


def _require_enabled() -> None:
    if not ENABLE_LOCAL_SCHEDULING:
        raise HTTPException(status_code=404, detail="Local scheduling is not enabled")


def _org_id(user: UserModel) -> int:
    if user.selected_organization_id is None:
        raise HTTPException(status_code=400, detail="No organization selected")
    return int(user.selected_organization_id)


def local_scheduling_base_url() -> str:
    return f"{BACKEND_API_ENDPOINT.rstrip('/')}/api/v1/local-scheduling"


class LocalSchedulingConfigResponse(BaseModel):
    enabled: bool
    book_slot_url: str
    lookup_availability_url: str
    appointments_url: str
    scheduling_api_base_url: str
    open_schedule_url: str
    default_open_slot_times_utc: list[str]
    message: str


class OpenScheduleResponse(BaseModel):
    slot_times_utc: list[str]


class OpenScheduleUpdateRequest(BaseModel):
    slot_times_utc: list[str] = Field(..., min_length=1, max_length=12)


class BookSlotRequest(BaseModel):
    slot_start: str = Field(..., description="ISO-8601 slot start (UTC recommended)")
    patient_name: Optional[str] = Field(default="Demo patient")
    visit_type: Optional[str] = Field(default="general")
    attendee_email: Optional[str] = Field(
        default=None,
        description="Optional email for calendar invite ATTENDEE line",
    )
    duration_minutes: Optional[int] = Field(default=30, ge=5, le=240)
    organization_id: Optional[int] = Field(
        default=None,
        description="Optional org scope for unauthenticated voice HTTP tools in local dev",
    )


class BookSlotResponse(BaseModel):
    appointment: dict[str, Any]
    confirmation_code: str
    invite_download_url: Optional[str] = None
    invite_ics_path: Optional[str] = None


@router.get("/config", response_model=LocalSchedulingConfigResponse)
async def get_config() -> LocalSchedulingConfigResponse:
    base = local_scheduling_base_url()
    api = BACKEND_API_ENDPOINT.rstrip("/")
    return LocalSchedulingConfigResponse(
        enabled=ENABLE_LOCAL_SCHEDULING,
        book_slot_url=f"{base}/book_slot",
        lookup_availability_url=f"{base}/lookup_availability",
        appointments_url=f"{base}/api/v1/appointments",
        scheduling_api_base_url=base,
        open_schedule_url=f"{base}/open-schedule",
        default_open_slot_times_utc=list(schedule_config.DEFAULT_OPEN_SLOT_TIMES_UTC),
        message=(
            "All-in-one local calendar: bookings persist under run/local_scheduling/ "
            "and each appointment includes a downloadable .ics invite — no external CRM required."
        ),
    )


@router.get("/open-schedule", response_model=OpenScheduleResponse)
async def get_open_schedule(user: UserModel = Depends(get_user)) -> OpenScheduleResponse:
    _require_enabled()
    org = _org_id(user)
    cfg = schedule_config.get_open_schedule(org)
    return OpenScheduleResponse(slot_times_utc=list(cfg.get("slot_times_utc") or []))


@router.put("/open-schedule", response_model=OpenScheduleResponse)
async def update_open_schedule(
    body: OpenScheduleUpdateRequest,
    user: UserModel = Depends(get_user),
) -> OpenScheduleResponse:
    _require_enabled()
    org = _org_id(user)
    try:
        cfg = schedule_config.set_open_schedule(org, body.slot_times_utc)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return OpenScheduleResponse(slot_times_utc=list(cfg.get("slot_times_utc") or []))


class CreateAppointmentRequest(BaseModel):
    slot_start: str
    patient_name: str = "Demo patient"
    visit_type: str = "general"
    attendee_email: Optional[str] = None
    duration_minutes: int = Field(default=30, ge=5, le=240)


def _book_payload(org: int, body: BookSlotRequest | CreateAppointmentRequest) -> BookSlotResponse:
    try:
        payload = store.book_appointment(
            org,
            slot_start=body.slot_start,
            patient_name=getattr(body, "patient_name", None) or "Demo patient",
            visit_type=getattr(body, "visit_type", None) or "general",
            attendee_email=getattr(body, "attendee_email", None),
            duration_minutes=getattr(body, "duration_minutes", None) or 30,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    return BookSlotResponse(**payload)


@router.post("/appointments")
async def create_appointment(
    body: CreateAppointmentRequest,
    user: UserModel = Depends(get_user),
) -> BookSlotResponse:
    """Authenticated UI path to book into the org calendar."""
    _require_enabled()
    org = _org_id(user)
    return _book_payload(org, body)


@router.get("/appointments")
async def list_appointments(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    base = BACKEND_API_ENDPOINT.rstrip("/")
    rows: list[dict[str, Any]] = []
    for row in store.list_appointments(org):
        if row.get("status") == "cancelled":
            continue
        enriched = dict(row)
        appt_id = row.get("id")
        if appt_id:
            path = f"/api/v1/local-scheduling/appointments/{appt_id}/invite.ics"
            enriched["invite_download_url"] = f"{base}{path}?organization_id={org}"
        rows.append(enriched)
    return {"appointments": rows}


@router.get("/appointments/{appointment_id}/invite.ics")
async def download_appointment_invite(
    appointment_id: str,
    organization_id: int = Query(default=1, ge=1),
) -> Response:
    """Download calendar invite (.ics) for a locally booked appointment."""
    _require_enabled()
    row = store.get_appointment(organization_id, appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    ics_bytes = build_appointment_ics(
        row,
        duration_minutes=int(row.get("duration_minutes") or 30),
    )
    filename = f"appointment-{appointment_id}.ics"
    return Response(
        content=ics_bytes,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/appointments/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    user: UserModel = Depends(get_user),
) -> dict[str, str]:
    _require_enabled()
    org = _org_id(user)
    if not store.cancel_appointment(org, appointment_id):
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"status": "cancelled"}


@router.get("/lookup_availability")
async def lookup_availability(
    on: str = Query(..., alias="date", description="UTC calendar day YYYY-MM-DD"),
    organization_id: int = Query(default=1, ge=1),
) -> dict[str, Any]:
    """Open slots for a UTC calendar day (voice HTTP tools; no auth in local dev)."""
    _require_enabled()
    try:
        date_type.fromisoformat(on[:10])
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Invalid date; use YYYY-MM-DD") from e
    day = on[:10]
    return {
        "date": day,
        "slots": store.available_open_slots(organization_id, day),
    }


@router.post("/book_slot", response_model=BookSlotResponse)
async def book_slot(body: BookSlotRequest) -> BookSlotResponse:
    """
    Booking endpoint for HTTP tools (book_slot). Matches catalog sample JSON shape
    for response_mapping → analytics mapped_data, plus invite_download_url.
    """
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return _book_payload(org, body)


@router.post("/api/v1/appointments", response_model=BookSlotResponse)
async def book_slot_catalog_alias(body: BookSlotRequest) -> BookSlotResponse:
    """
    Runbook-compatible alias when scheduling_api_base_url points at /api/v1/local-scheduling.
    Voice HTTP tools can POST here without external CRM/calendar systems.
    """
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return _book_payload(org, body)
