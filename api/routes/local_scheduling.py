"""Local demo calendar API for booking GTM / vertical packs (no external scheduler)."""

from __future__ import annotations

from datetime import date as date_type
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.constants import BACKEND_API_ENDPOINT, ENABLE_LOCAL_SCHEDULING
from api.db.models import UserModel
from api.services.auth.depends import get_user
from api.services.local_scheduling import store

router = APIRouter(prefix="/local-scheduling", tags=["local-scheduling"])


def _require_enabled() -> None:
    if not ENABLE_LOCAL_SCHEDULING:
        raise HTTPException(status_code=404, detail="Local scheduling is not enabled")


def _org_id(user: UserModel) -> int:
    if user.selected_organization_id is None:
        raise HTTPException(status_code=400, detail="No organization selected")
    return int(user.selected_organization_id)


class LocalSchedulingConfigResponse(BaseModel):
    enabled: bool
    book_slot_url: str
    lookup_availability_url: str


class BookSlotRequest(BaseModel):
    slot_start: str = Field(..., description="ISO-8601 slot start (UTC recommended)")
    patient_name: Optional[str] = Field(default="Demo patient")
    visit_type: Optional[str] = Field(default="general")
    organization_id: Optional[int] = Field(
        default=None,
        description="Optional org scope for unauthenticated voice HTTP tools in local dev",
    )


class BookSlotResponse(BaseModel):
    appointment: dict[str, Any]
    confirmation_code: str


@router.get("/config", response_model=LocalSchedulingConfigResponse)
async def get_config() -> LocalSchedulingConfigResponse:
    base = BACKEND_API_ENDPOINT.rstrip("/")
    return LocalSchedulingConfigResponse(
        enabled=ENABLE_LOCAL_SCHEDULING,
        book_slot_url=f"{base}/api/v1/local-scheduling/book_slot",
        lookup_availability_url=f"{base}/api/v1/local-scheduling/lookup_availability",
    )


class CreateAppointmentRequest(BaseModel):
    slot_start: str
    patient_name: str = "Demo patient"
    visit_type: str = "general"


@router.post("/appointments")
async def create_appointment(
    body: CreateAppointmentRequest,
    user: UserModel = Depends(get_user),
) -> BookSlotResponse:
    """Authenticated UI path to book into the org calendar."""
    _require_enabled()
    org = _org_id(user)
    payload = store.book_appointment(
        org,
        slot_start=body.slot_start,
        patient_name=body.patient_name,
        visit_type=body.visit_type,
    )
    return BookSlotResponse(**payload)


@router.get("/appointments")
async def list_appointments(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    return {"appointments": store.list_appointments(org)}


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
) -> dict[str, Any]:
    """Open slots for a UTC calendar day (voice HTTP tools; no auth in local dev)."""
    _require_enabled()
    try:
        date_type.fromisoformat(on[:10])
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Invalid date; use YYYY-MM-DD") from e
    day = on[:10]
    return {"date": day, "slots": store.default_open_slots(day)}


@router.post("/book_slot", response_model=BookSlotResponse)
async def book_slot(body: BookSlotRequest) -> BookSlotResponse:
    """
    Booking endpoint for HTTP tools (book_slot). Matches catalog sample JSON shape
    for response_mapping → analytics mapped_data.
    """
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    payload = store.book_appointment(
        org,
        slot_start=body.slot_start,
        patient_name=body.patient_name or "Demo patient",
        visit_type=body.visit_type or "general",
    )
    return BookSlotResponse(**payload)
