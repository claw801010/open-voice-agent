"""Local demo payments API for collections / payment redirect (no external processor)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.constants import BACKEND_API_ENDPOINT, ENABLE_LOCAL_PAYMENTS
from api.db.models import UserModel
from api.services.auth.depends import get_user
from api.services.local_payments import store

router = APIRouter(prefix="/local-payments", tags=["local-payments"])


def _require_enabled() -> None:
    if not ENABLE_LOCAL_PAYMENTS:
        raise HTTPException(status_code=404, detail="Local payments is not enabled")


def _org_id(user: UserModel) -> int:
    if user.selected_organization_id is None:
        raise HTTPException(status_code=400, detail="No organization selected")
    return int(user.selected_organization_id)


def local_payments_base_url() -> str:
    return f"{BACKEND_API_ENDPOINT.rstrip('/')}/api/v1/local-payments"


class LocalPaymentsConfigResponse(BaseModel):
    enabled: bool
    payment_promises_url: str
    payment_redirect_confirm_url: str
    visits_enroll_url: str
    local_payments_base_url: str
    message: str


class PaymentPromiseRequest(BaseModel):
    account_reference: Optional[str] = None
    promised_amount: Optional[str] = None
    promised_date: Optional[str] = None
    notes: Optional[str] = None
    organization_id: Optional[int] = Field(default=None, ge=1)


class PaymentRedirectConfirmRequest(BaseModel):
    account_reference: Optional[str] = None
    redirect_url: Optional[str] = None
    reason_code: Optional[str] = None
    organization_id: Optional[int] = Field(default=None, ge=1)


class ConciergeEnrollRequest(BaseModel):
    visit_type: Optional[str] = None
    slot_start: Optional[str] = None
    patient_name: Optional[str] = None
    organization_id: Optional[int] = Field(default=None, ge=1)


@router.get("/config", response_model=LocalPaymentsConfigResponse)
async def get_config() -> LocalPaymentsConfigResponse:
    base = local_payments_base_url()
    return LocalPaymentsConfigResponse(
        enabled=ENABLE_LOCAL_PAYMENTS,
        payment_promises_url=f"{base}/api/v1/payment-promises",
        payment_redirect_confirm_url=f"{base}/api/v1/payments/redirect/confirm",
        visits_enroll_url=f"{base}/api/v1/visits/enroll",
        local_payments_base_url=base,
        message=(
            "All-in-one local payments: payment promises, redirect confirms, and concierge enroll "
            "persist under run/local_payments/ — no Stripe or billing processor required."
        ),
    )


@router.get("/records")
async def list_records(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    return {"records": store.list_records(org)}


@router.post("/api/v1/payment-promises")
async def capture_payment_promise(body: PaymentPromiseRequest) -> dict[str, Any]:
    """Runbook-compatible alias for capture_payment_promise HTTP tools."""
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.capture_payment_promise(
        org,
        account_reference=body.account_reference,
        promised_amount=body.promised_amount,
        promised_date=body.promised_date,
        notes=body.notes,
    )


@router.post("/api/v1/payments/redirect/confirm")
async def confirm_payment_redirect(body: PaymentRedirectConfirmRequest) -> dict[str, Any]:
    """Runbook-compatible alias for confirm_payment_redirect HTTP tools."""
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.confirm_payment_redirect(
        org,
        account_reference=body.account_reference,
        redirect_url=body.redirect_url,
        reason_code=body.reason_code,
    )


@router.post("/api/v1/visits/enroll")
async def enroll_concierge_visit(body: ConciergeEnrollRequest) -> dict[str, Any]:
    """Runbook-compatible alias for enroll_concierge_visit HTTP tools."""
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.enroll_concierge_visit(
        org,
        visit_type=body.visit_type,
        slot_start=body.slot_start,
        patient_name=body.patient_name,
    )
