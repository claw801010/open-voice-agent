"""Local demo EHR API — compliant local records + optional connector sync."""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from api.constants import BACKEND_API_ENDPOINT, ENABLE_LOCAL_EHR
from api.db.models import UserModel
from api.services.auth.depends import get_user
from api.services.local_ehr import records, store

router = APIRouter(prefix="/local-ehr", tags=["local-ehr"])

EhrVendor = Literal["none", "athenahealth", "epic", "cerner", "ecw"]
RecordKeepingMode = Literal["local_only", "local_with_connector"]


def _require_enabled() -> None:
    if not ENABLE_LOCAL_EHR:
        raise HTTPException(status_code=404, detail="Local EHR is not enabled")


def _org_id(user: UserModel) -> int:
    if user.selected_organization_id is None:
        raise HTTPException(status_code=400, detail="No organization selected")
    return int(user.selected_organization_id)


def local_ehr_base_url() -> str:
    return f"{BACKEND_API_ENDPOINT.rstrip('/')}/api/v1/local-ehr"


class LocalEhrConfigResponse(BaseModel):
    enabled: bool
    local_ehr_base_url: str
    message: str
    connector: dict[str, Any]
    supported_vendors: list[str]
    record_keeping_modes: list[str]
    endpoints: dict[str, str]
    compliance: dict[str, Any]


class EhrConnectorUpdate(BaseModel):
    vendor: EhrVendor | None = None
    record_keeping_mode: RecordKeepingMode | None = None
    connector_sync_enabled: bool | None = None


class EhrRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    organization_id: Optional[int] = Field(default=None, ge=1)
    patient_token: Optional[str] = None
    patient_name: Optional[str] = None
    procedure_code: Optional[str] = None
    summary: Optional[str] = None
    appointment_id: Optional[str] = None


class PatientUpsertBody(BaseModel):
    model_config = ConfigDict(extra="allow")

    organization_id: Optional[int] = Field(default=None, ge=1)
    patient_token: Optional[str] = None
    display_name: str = Field(min_length=1, max_length=200)
    mrn_token: Optional[str] = None
    date_of_birth: Optional[str] = None
    primary_insurance: Optional[str] = None
    active_medications: Optional[list[str]] = None
    care_gaps: Optional[list[dict[str, Any]]] = None
    prior_auth: Optional[dict[str, Any]] = None
    connector_external_id: Optional[str] = None


@router.get("/config", response_model=LocalEhrConfigResponse)
async def get_config(user: UserModel = Depends(get_user)) -> LocalEhrConfigResponse:
    _require_enabled()
    base = local_ehr_base_url()
    org = _org_id(user)
    connector = store.get_config(org)
    endpoints = {
        "patients_context": f"{base}/api/v1/patients/context",
        "patients_upsert": f"{base}/api/v1/patients/upsert",
        "prior_auth_status": f"{base}/api/v1/prior-auth/status",
        "chart_sync": f"{base}/api/v1/chart/sync",
    }
    return LocalEhrConfigResponse(
        enabled=ENABLE_LOCAL_EHR,
        local_ehr_base_url=base,
        connector=connector,
        supported_vendors=["none", "athenahealth", "epic", "cerner", "ecw"],
        record_keeping_modes=["local_only", "local_with_connector"],
        endpoints=endpoints,
        compliance={
            "phi_minimization": True,
            "audit_trail": True,
            "local_record_authoritative": True,
            "connector_optional": True,
        },
        message=(
            "Compliant local EHR record keeping: charts always stored under run/local_ehr/ per org. "
            "Use local_only with no connector, or local_with_connector to mirror chart notes to "
            "athenaHealth / Epic / Cerner / eCW stubs."
        ),
    )


@router.put("/connector")
async def update_connector(body: EhrConnectorUpdate, user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    vendor = body.vendor
    return store.update_config(
        org,
        vendor=vendor,
        record_keeping_mode=body.record_keeping_mode,
        connector_sync_enabled=body.connector_sync_enabled,
    )


@router.get("/patients")
async def list_patients(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    store.get_config(org)
    items = [records.public_patient_view(p) for p in records.list_patients(org)]
    return {"patients": items}


@router.post("/patients/upsert")
async def upsert_patient(body: PatientUpsertBody, user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    row = records.upsert_patient(org, body.model_dump(exclude_none=True))
    return records.public_patient_view(row)


@router.post("/api/v1/patients/upsert")
async def upsert_patient_tool(body: PatientUpsertBody) -> dict[str, Any]:
    """Voice HTTP tool alias — uses organization_id from body when unauthenticated."""
    _require_enabled()
    org_id = body.organization_id if body.organization_id is not None else 1
    row = records.upsert_patient(org_id, body.model_dump(exclude_none=True))
    return {
        **records.public_patient_view(row),
        "confirmation_code": str(row.get("patient_token", ""))[-8:].upper(),
        "status_code": "stored",
    }


@router.get("/sync-records")
async def list_sync_records(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    return {"records": store.list_sync_records(org)}


@router.get("/audit-log")
async def list_audit_log(user: UserModel = Depends(get_user), limit: int = 30) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    return {"entries": records.list_audit(org, limit=min(limit, 100))}


@router.post("/connector/push-pending")
async def push_pending_syncs(user: UserModel = Depends(get_user)) -> dict[str, Any]:
    _require_enabled()
    org = _org_id(user)
    return store.push_pending_connector_syncs(org)


@router.post("/api/v1/patients/context")
async def patients_context(body: EhrRequest) -> dict[str, Any]:
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.lookup_patient_context(
        org,
        patient_token=body.patient_token,
        patient_name=body.patient_name,
    )


@router.post("/api/v1/prior-auth/status")
async def prior_auth_status(body: EhrRequest) -> dict[str, Any]:
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.verify_prior_auth(
        org,
        patient_token=body.patient_token,
        procedure_code=body.procedure_code,
    )


@router.post("/api/v1/chart/sync")
async def chart_sync(body: EhrRequest) -> dict[str, Any]:
    _require_enabled()
    org = body.organization_id if body.organization_id is not None else 1
    return store.sync_chart_note(
        org,
        patient_token=body.patient_token,
        summary=body.summary,
        appointment_id=body.appointment_id,
    )
