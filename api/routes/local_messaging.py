"""Local demo SMS / email API for healthcare outreach (log-only, no provider keys)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from api.constants import BACKEND_API_ENDPOINT, ENABLE_LOCAL_MESSAGING
from api.db.models import UserModel
from api.services.auth.depends import get_user
from api.services.local_messaging import store

router = APIRouter(prefix="/local-messaging", tags=["local-messaging"])


def _require_enabled() -> None:
    if not ENABLE_LOCAL_MESSAGING:
        raise HTTPException(status_code=404, detail="Local messaging is not enabled")


def _org_id(user: UserModel) -> int:
    if user.selected_organization_id is None:
        raise HTTPException(status_code=400, detail="No organization selected")
    return int(user.selected_organization_id)


def local_messaging_base_url() -> str:
    return f"{BACKEND_API_ENDPOINT.rstrip('/')}/api/v1/local-messaging"


class LocalMessagingConfigResponse(BaseModel):
    enabled: bool
    local_messaging_base_url: str
    message: str
    channels: list[str]
    endpoints: dict[str, str]


class MessagingRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    organization_id: Optional[int] = Field(default=None, ge=1)
    to: str = Field(..., min_length=3)
    body: str = Field(..., min_length=1)
    subject: Optional[str] = None
    patient_name: Optional[str] = None


@router.get("/config", response_model=LocalMessagingConfigResponse)
async def get_config() -> LocalMessagingConfigResponse:
    _require_enabled()
    base = local_messaging_base_url()
    endpoints = {
        "send_sms": f"{base}/api/v1/messages/sms",
        "send_email": f"{base}/api/v1/messages/email",
    }
    return LocalMessagingConfigResponse(
        enabled=ENABLE_LOCAL_MESSAGING,
        local_messaging_base_url=base,
        channels=["sms", "email", "voice"],
        endpoints=endpoints,
        message=(
            "Local messaging demo: SMS and email sends are logged under run/local_messaging/. "
            "Production: wire HTTP tools to Twilio, SendGrid, or buyer secure messaging."
        ),
    )


@router.get("/messages")
async def list_messages(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    return {"messages": store.list_messages(org)}


@router.post("/api/v1/messages/sms")
async def send_sms(body: MessagingRequest) -> dict[str, Any]:
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.send_message(
        org,
        channel="sms",
        to_address=body.to,
        body=body.body,
        patient_name=body.patient_name,
    )


@router.post("/api/v1/messages/email")
async def send_email(body: MessagingRequest) -> dict[str, Any]:
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.send_message(
        org,
        channel="email",
        to_address=body.to,
        body=body.body,
        subject=body.subject,
        patient_name=body.patient_name,
    )
