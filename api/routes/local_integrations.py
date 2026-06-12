"""Local demo integrations API for vertical HTTP tools (no external buyer systems)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from api.constants import BACKEND_API_ENDPOINT, ENABLE_LOCAL_INTEGRATIONS
from api.db.models import UserModel
from api.services.auth.depends import get_user
from api.services.local_integrations import store

router = APIRouter(prefix="/local-integrations", tags=["local-integrations"])


def _require_enabled() -> None:
    if not ENABLE_LOCAL_INTEGRATIONS:
        raise HTTPException(status_code=404, detail="Local integrations is not enabled")


def _org_id(user: UserModel) -> int:
    if user.selected_organization_id is None:
        raise HTTPException(status_code=400, detail="No organization selected")
    return int(user.selected_organization_id)


def local_integrations_base_url() -> str:
    return f"{BACKEND_API_ENDPOINT.rstrip('/')}/api/v1/local-integrations"


class LocalIntegrationsConfigResponse(BaseModel):
    enabled: bool
    local_integrations_base_url: str
    message: str
    endpoints: dict[str, str]


class IntegrationRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    organization_id: Optional[int] = Field(default=None, ge=1)


def _action(org: int, action_type: str, path: str, body: IntegrationRequest) -> dict[str, Any]:
    payload = body.model_dump(exclude={"organization_id"}, exclude_none=True)
    return store.record_action(org, action_type, path=path, body=payload)


async def _post(action_type: str, path: str, body: IntegrationRequest) -> dict[str, Any]:
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return _action(org, action_type, path, body)


@router.get("/config", response_model=LocalIntegrationsConfigResponse)
async def get_config() -> LocalIntegrationsConfigResponse:
    base = local_integrations_base_url()
    endpoints = {
        "reservations_modify": f"{base}/api/v1/reservations/modify",
        "cancellations_waiver": f"{base}/api/v1/cancellations/waiver",
        "offers_attach": f"{base}/api/v1/offers/attach",
        "quotes_intent": f"{base}/api/v1/quotes/intent",
        "claims_status": f"{base}/api/v1/claims/status",
        "accounts_balance": f"{base}/api/v1/accounts/balance",
        "accounts_health": f"{base}/api/v1/accounts/health",
        "deals_stage": f"{base}/api/v1/deals/stage",
        "leads_intent": f"{base}/api/v1/leads/intent",
        "locations_route": f"{base}/api/v1/locations/route",
        "outages_status": f"{base}/api/v1/outages/status",
        "permits_status": f"{base}/api/v1/permits/status",
        "calls_route_by_language": f"{base}/api/v1/calls/route-by-language",
        "applications_status": f"{base}/api/v1/applications/status",
        "cards_block": f"{base}/api/v1/cards/block",
    }
    return LocalIntegrationsConfigResponse(
        enabled=ENABLE_LOCAL_INTEGRATIONS,
        local_integrations_base_url=base,
        endpoints=endpoints,
        message=(
            "All-in-one local integrations: CRM, OSS, ATS, banking, and civic lookup actions "
            "persist under run/local_integrations/ — no buyer API keys required."
        ),
    )


@router.get("/records")
async def list_records(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    return {"records": store.list_records(org)}


@router.post("/api/v1/reservations/modify")
async def reservations_modify(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("reservation_modify", "/api/v1/reservations/modify", body)


@router.post("/api/v1/cancellations/waiver")
async def cancellations_waiver(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("cancellation_waiver", "/api/v1/cancellations/waiver", body)


@router.post("/api/v1/offers/attach")
async def offers_attach(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("offer_attach", "/api/v1/offers/attach", body)


@router.post("/api/v1/quotes/intent")
async def quotes_intent(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("quote_intent", "/api/v1/quotes/intent", body)


@router.post("/api/v1/claims/status")
async def claims_status(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("claim_status", "/api/v1/claims/status", body)


@router.post("/api/v1/accounts/balance")
async def accounts_balance(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("account_balance", "/api/v1/accounts/balance", body)


@router.post("/api/v1/accounts/health")
async def accounts_health(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("account_health", "/api/v1/accounts/health", body)


@router.post("/api/v1/deals/stage")
async def deals_stage(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("deal_stage", "/api/v1/deals/stage", body)


@router.post("/api/v1/leads/intent")
async def leads_intent(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("lead_intent", "/api/v1/leads/intent", body)


@router.post("/api/v1/locations/route")
async def locations_route(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("location_route", "/api/v1/locations/route", body)


@router.post("/api/v1/outages/status")
async def outages_status(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("outage_status", "/api/v1/outages/status", body)


@router.post("/api/v1/permits/status")
async def permits_status(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("permit_status", "/api/v1/permits/status", body)


@router.post("/api/v1/calls/route-by-language")
async def calls_route_by_language(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("language_route", "/api/v1/calls/route-by-language", body)


@router.post("/api/v1/applications/status")
async def applications_status(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("application_status", "/api/v1/applications/status", body)


@router.post("/api/v1/cards/block")
async def cards_block(body: IntegrationRequest) -> dict[str, Any]:
    return await _post("card_block", "/api/v1/cards/block", body)
