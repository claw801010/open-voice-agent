"""Analytics calls API (MK-01-ANALYTICS-VERTICAL Phase B) — list + detail over workflow_runs."""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.db import db_client
from api.db.models import UserModel
from api.services.analytics.call_intel import parse_analytics_call_id
from api.services.auth.depends import get_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


class CallListItemResponse(BaseModel):
    call_id: str
    workflow_id: int
    workflow_slug: str | None = None
    started_at: str
    duration_ms: int = Field(ge=0)
    disposition: str | None = None
    outcome_key: str | None = None
    tool_names: list[str] = Field(default_factory=list)


class CallListPageResponse(BaseModel):
    items: list[CallListItemResponse]
    next_cursor: str | None = None


class HttpToolSpanSummaryResponse(BaseModel):
    method: str | None = None
    url_template: str | None = None
    request_status: int | None = None
    mapped_data: dict[str, Any] | None = None
    error_message: str | None = None


class ToolSpanResponse(BaseModel):
    span_id: str
    tool_name: str
    tool_type: str
    started_at: str
    duration_ms: int = Field(ge=0)
    http: HttpToolSpanSummaryResponse | None = None


class CallMetricsResponse(BaseModel):
    llm_rounds: int = Field(ge=0)
    tool_invocation_count: int = Field(ge=0)
    stt_seconds: float | None = None
    tts_seconds: float | None = None


class QaQmSummaryResponse(BaseModel):
    score: float | None = None
    flags: list[str] = Field(default_factory=list)
    reviewer_notes: str | None = None


class CallDetailResponse(BaseModel):
    call_id: str
    workflow_id: int
    workflow_slug: str | None = None
    started_at: str
    ended_at: str | None = None
    duration_ms: int = Field(ge=0)
    metrics: CallMetricsResponse
    outcomes: dict[str, Any] = Field(default_factory=dict)
    tool_spans: list[ToolSpanResponse]
    ai_summary: str | None = None
    qa: QaQmSummaryResponse | None = None


def _require_org(user: UserModel) -> int:
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    return user.selected_organization_id


@router.get("/calls", response_model=CallListPageResponse)
async def list_analytics_calls(
    user: UserModel = Depends(get_user),
    workflow_id: Optional[int] = Query(
        None, description="Filter by workflow id (integer id in this product)"
    ),
    since: Optional[datetime] = Query(None, description="UTC inclusive lower bound"),
    until: Optional[datetime] = Query(None, description="UTC inclusive upper bound"),
    disposition: Optional[str] = Query(None),
    outcome_key: Optional[str] = Query(None),
    tool_name: Optional[str] = Query(
        None,
        description="Only calls that logged an rtf-function-call-end for this function name",
    ),
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[str] = Query(None, description="Opaque pagination cursor from prior response"),
):
    org_id = _require_org(user)
    items, next_cursor = await db_client.list_analytics_calls(
        org_id,
        workflow_id=workflow_id,
        since=since,
        until=until,
        disposition=disposition,
        outcome_key=outcome_key,
        tool_name=tool_name,
        limit=limit,
        cursor=cursor,
    )
    return {"items": items, "next_cursor": next_cursor}


@router.get("/calls/{call_id}", response_model=CallDetailResponse)
async def get_analytics_call(
    call_id: str,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    run_id = parse_analytics_call_id(call_id)
    if run_id is None:
        raise HTTPException(status_code=404, detail="Call not found")
    detail = await db_client.get_analytics_call_detail(org_id, run_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Call not found")
    return detail
