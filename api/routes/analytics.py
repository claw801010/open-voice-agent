"""Analytics calls API (MK-01-ANALYTICS-VERTICAL Phase B) — list + detail over workflow_runs."""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from starlette.responses import Response

from api.constants import ENABLE_ANALYTICS_QM_EXPORT_CRON
from api.db import db_client
from api.db.models import UserModel
from api.enums import OrganizationConfigurationKey
from api.services.analytics.analytics_calls_csv import analytics_call_rows_to_csv_bytes
from api.services.analytics.analytics_redact import coerce_detail_redaction_enabled
from api.schemas.analytics_call_review import (
    ApplyWorkflowImprovementBody,
    ApplyWorkflowImprovementResponse,
    CallAiReviewResponse,
    CallReviewRecommendation,
    CreateFollowUpBody,
    FollowUpItemResponse,
    FollowUpListResponse,
    GenerateCallAiReviewBody,
)
from api.services.analytics.apply_workflow_improvement import (
    append_improvement_to_workflow_definition,
)
from api.services.analytics.call_follow_ups import (
    append_follow_up,
    set_cached_ai_review,
)
from api.services.analytics.call_intel import parse_analytics_call_id
from api.services.analytics.call_review_ai import generate_call_ai_review
from api.services.analytics.analytics_qm_export_schedule import (
    merge_put_into_stored_schedule,
    normalize_analytics_qm_export_schedule_document,
    next_analytics_qm_export_dispatch_utc,
)
from api.services.analytics.qm_scorecard import (
    build_qa_criteria_prompt_hint,
    normalize_qm_scorecard_document,
)
from api.services.analytics.dashboard_layout_validate import normalize_analytics_dashboard_layout
from api.services.analytics.redaction_policy_rbac import (
    compute_may_disable_detail_redaction,
    ensure_may_disable_analytics_detail_redaction,
)
from api.services.auth.depends import get_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


class CallListItemResponse(BaseModel):
    call_id: str
    workflow_id: int
    workflow_slug: str | None = None
    catalog_variant_id: str | None = Field(
        default=None,
        description="MK-01 catalog_variant_id from workflow_configurations.mk01 when set at install.",
    )
    started_at: str
    duration_ms: int = Field(ge=0)
    disposition: str | None = None
    outcome_key: str | None = None
    tool_names: list[str] = Field(default_factory=list)
    cx_score: int | None = Field(
        default=None, description="Present when include_qm_summary=true on list."
    )
    containment: str | None = None
    qa_score: float | None = None
    scorecard_pass_rate: float | None = Field(
        default=None, ge=0, le=1, description="Rubric pass rate when QA criteria scored."
    )


class CallListPageResponse(BaseModel):
    items: list[CallListItemResponse]
    next_cursor: str | None = None


class OutcomeMixItemResponse(BaseModel):
    outcome: str
    count: int = Field(ge=0)


class ToolNameMixItemResponse(BaseModel):
    tool_name: str
    count: int = Field(ge=0, description="Distinct workflow runs that invoked this tool at least once.")


class ContainmentMixItemResponse(BaseModel):
    containment: str
    count: int = Field(ge=0)


class ToolHealthItemResponse(BaseModel):
    function_name: str
    invocation_count: int = Field(ge=0)
    success_count: int = Field(ge=0)
    success_rate: float = Field(ge=0, le=1)
    failed_invocations: int = Field(ge=0)


class InsightsQualitySummaryResponse(BaseModel):
    sampled_calls: int = Field(
        ge=0,
        description="Calls included in CX/containment/tool-health roll-up (capped for performance).",
    )
    sample_capped: bool = Field(
        default=False,
        description="True when total_calls exceeds the quality sample cap.",
    )
    avg_cx_score: int | None = Field(
        default=None,
        description="Mean CX score (0–100) across sampled calls.",
    )
    containment_mix: list[ContainmentMixItemResponse] = Field(default_factory=list)
    calls_with_qa: int = Field(ge=0)
    avg_qa_score: float | None = None
    avg_tool_success_rate: float | None = Field(
        default=None,
        description="Mean per-call tool success rate where tools ran.",
    )
    tool_health: list[ToolHealthItemResponse] = Field(
        default_factory=list,
        description="Per-function aggregates sorted by lowest success rate first.",
    )


class InsightsResponse(BaseModel):
    total_calls: int = Field(ge=0, description="Workflow runs in range for this org (after filters).")
    calls_with_outcome: int = Field(
        ge=0, description="Runs with non-empty outcome_key or customer_outcome in gathered_context."
    )
    calls_with_logged_tools: int = Field(
        ge=0,
        description=(
            "Same as calls_with_tool_evidence (backward-compatible field name). "
            "Runs with trace in logs and/or analytics_http_tool_spans."
        ),
    )
    calls_with_tool_evidence: int = Field(
        ge=0,
        description=(
            "Distinct runs with tool invocation evidence: rtf-function-call-end in logs "
            "and/or rows in analytics_http_tool_spans for that run."
        ),
    )
    outcome_mix: list[OutcomeMixItemResponse] = Field(
        default_factory=list,
        description="Top outcome buckets (coalesced key), up to 20 rows.",
    )
    tool_name_mix: list[ToolNameMixItemResponse] = Field(
        default_factory=list,
        description="Top function_name values by distinct run count, up to 15 rows.",
    )
    quality_summary: InsightsQualitySummaryResponse = Field(
        default_factory=InsightsQualitySummaryResponse,
        description="CX, containment, and tool-function health roll-ups from call logs.",
    )
    http_tool_invocations: int = Field(
        ge=0,
        default=0,
        description=(
            "HTTP API tool invocations in range (analytics_http_tool_spans and/or "
            "rtf-function-call-end logs with status_code when spans are absent)."
        ),
    )
    http_tool_cache_hits: int = Field(
        ge=0,
        default=0,
        description="Subset of http_tool_invocations served from org HTTP integration cache.",
    )
    since: str
    until: str


class HttpToolSpanSummaryResponse(BaseModel):
    method: str | None = None
    url_template: str | None = None
    request_status: int | None = None
    mapped_data: dict[str, Any] | None = None
    cache_hit: bool | None = None
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
    catalog_variant_id: str | None = Field(
        default=None,
        description="MK-01 catalog_variant_id from workflow_configurations.mk01 when set at install.",
    )
    started_at: str
    ended_at: str | None = None
    duration_ms: int = Field(ge=0)
    metrics: CallMetricsResponse
    outcomes: dict[str, Any] = Field(default_factory=dict)
    tool_spans: list[ToolSpanResponse]
    transcript: str | None = None
    ai_summary: str | None = None
    qa: QaQmSummaryResponse | None = None
    follow_ups: list[dict[str, Any]] = Field(default_factory=list)
    live_trace: dict[str, Any] | None = Field(
        default=None,
        description="Timeline, tool HTTP send/receive, and LLM inference metrics from logs.",
    )
    quality_report: dict[str, Any] | None = Field(
        default=None,
        description="Containment, CX score, outcomes, and per-function tool ratings.",
    )
    scorecard: dict[str, Any] | None = Field(
        default=None,
        description="QM rubric pass/fail grid from org scorecard + QA node criteria.",
    )
    engineering_links: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional deep links (e.g. langfuse_trace_url) for engineering debug.",
    )


def _require_org(user: UserModel) -> int:
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    return user.selected_organization_id


def _utc_aware_bounds(
    days: int,
    since: datetime | None,
    until: datetime | None,
) -> tuple[datetime, datetime]:
    """
    Return inclusive [since, until] in UTC.

    * If ``until`` is omitted, use now (UTC).
    * If ``since`` is omitted, use ``until - days``.
    * Naive datetimes are treated as UTC.
    """
    now = datetime.now(timezone.utc)
    end = until if until is not None else now
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    else:
        end = end.astimezone(timezone.utc)

    if since is not None:
        start = since
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        else:
            start = start.astimezone(timezone.utc)
    else:
        start = end - timedelta(days=days)

    if start > end:
        raise HTTPException(
            status_code=400,
            detail="Invalid range: 'since' must be before or equal to 'until'",
        )
    return start, end


@router.get("/insights", response_model=InsightsResponse)
async def get_analytics_insights(
    user: UserModel = Depends(get_user),
    days: int = Query(7, ge=1, le=366, description="Lookback days when 'since' is not set"),
    since: Optional[datetime] = Query(
        None, description="UTC inclusive lower bound (overrides 'days' when set)"
    ),
    until: Optional[datetime] = Query(None, description="UTC inclusive upper bound (default: now)"),
    workflow_id: Optional[int] = Query(None, description="Restrict to a single workflow id"),
    catalog_slug: Optional[str] = Query(
        None, description="MK-01 install slug (workflow_configurations.mk01.catalog_slug)",
    ),
    catalog_variant_id: Optional[str] = Query(
        None,
        description="MK-01 graph variant (workflow_configurations.mk01.catalog_variant_id), e.g. simple or booking_complex",
    ),
):
    org_id = _require_org(user)
    start, end = _utc_aware_bounds(days, since, until)
    row = await db_client.get_analytics_insights(
        org_id,
        start,
        end,
        workflow_id=workflow_id,
        catalog_slug=catalog_slug,
        catalog_variant_id=catalog_variant_id,
    )
    tools_ct = int(row["calls_with_logged_tools"])
    qs = row.get("quality_summary") or {}
    return {
        "total_calls": int(row["total_calls"]),
        "calls_with_outcome": int(row["calls_with_outcome"]),
        "calls_with_logged_tools": tools_ct,
        "calls_with_tool_evidence": int(row.get("calls_with_tool_evidence", tools_ct)),
        "outcome_mix": row["outcome_mix"],
        "tool_name_mix": row["tool_name_mix"],
        "quality_summary": qs,
        "http_tool_invocations": int(row.get("http_tool_invocations", 0)),
        "http_tool_cache_hits": int(row.get("http_tool_cache_hits", 0)),
        "since": start.isoformat(),
        "until": end.isoformat(),
    }


@router.get("/calls", response_model=CallListPageResponse)
async def list_analytics_calls(
    user: UserModel = Depends(get_user),
    workflow_id: Optional[int] = Query(
        None, description="Filter by workflow id (integer id in this product)"
    ),
    catalog_slug: Optional[str] = Query(
        None,
        description="MK-01 install slug (workflow_configurations.mk01.catalog_slug), same as GET /analytics/insights",
    ),
    catalog_variant_id: Optional[str] = Query(
        None,
        description="MK-01 catalog_variant_id (same semantics as GET /analytics/insights)",
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
    include_qm_summary: bool = Query(
        False,
        description="Include cx_score, containment, qa_score, scorecard_pass_rate per row (for QM CSV).",
    ),
):
    org_id = _require_org(user)
    items, next_cursor = await db_client.list_analytics_calls(
        org_id,
        workflow_id=workflow_id,
        catalog_slug=catalog_slug,
        catalog_variant_id=catalog_variant_id,
        since=since,
        until=until,
        disposition=disposition,
        outcome_key=outcome_key,
        tool_name=tool_name,
        limit=limit,
        cursor=cursor,
        include_qm_summary=include_qm_summary,
    )
    return {"items": items, "next_cursor": next_cursor}


@router.get("/calls/export")
async def export_analytics_calls_csv(
    user: UserModel = Depends(get_user),
    workflow_id: Optional[int] = Query(
        None, description="Filter by workflow id (integer id in this product)"
    ),
    catalog_slug: Optional[str] = Query(
        None,
        description="MK-01 install slug (workflow_configurations.mk01.catalog_slug)",
    ),
    catalog_variant_id: Optional[str] = Query(
        None,
        description="MK-01 catalog_variant_id filter",
    ),
    since: Optional[datetime] = Query(None, description="UTC inclusive lower bound"),
    until: Optional[datetime] = Query(None, description="UTC inclusive upper bound"),
    disposition: Optional[str] = Query(None),
    outcome_key: Optional[str] = Query(None),
    tool_name: Optional[str] = Query(
        None,
        description="Only calls that logged an rtf-function-call-end for this function name",
    ),
    max_rows: int = Query(
        5000,
        ge=1,
        le=10000,
        description="Hard cap on rows in this export (pagination on the server)",
    ),
    sampling_mode: Optional[str] = Query(
        "smart",
        description="fifo = chronological; smart = prioritize escalations and failed tools",
    ),
):
    """
    Download **text/csv** with the same filter semantics as ``GET /analytics/calls`` (no cursor).

    Registered **before** ``/calls/{call_id}`` so ``export`` is not parsed as a call id.
    """
    org_id = _require_org(user)
    rows, redact_cells = await db_client.export_analytics_calls_flat(
        org_id,
        workflow_id=workflow_id,
        catalog_slug=catalog_slug,
        catalog_variant_id=catalog_variant_id,
        since=since,
        until=until,
        disposition=disposition,
        outcome_key=outcome_key,
        tool_name=tool_name,
        max_rows=max_rows,
        sampling_mode=(sampling_mode or "fifo").strip().lower(),
    )
    body = analytics_call_rows_to_csv_bytes(rows, redact_cells=redact_cells)
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="analytics-calls-export.csv"',
        },
    )


class QmScorecardCriterionResponse(BaseModel):
    id: str
    label: str
    description: str | None = None


class QmScorecardGetResponse(BaseModel):
    scorecard: dict[str, Any]
    qa_prompt_hint: str = Field(
        default="",
        description="Copy-paste snippet for QA node prompts listing criterion ids.",
    )


class QmScorecardPutBody(BaseModel):
    criteria: list[dict[str, Any]] = Field(
        min_length=1,
        description="Rubric rows: { id, label, description? }",
    )


@router.get("/qm-scorecard", response_model=QmScorecardGetResponse)
async def get_analytics_qm_scorecard(user: UserModel = Depends(get_user)):
    """Org QM rubric used to render pass/fail scorecard on call detail."""
    org_id = _require_org(user)
    rubric = await db_client.get_qm_scorecard_rubric(org_id)
    return {
        "scorecard": rubric,
        "qa_prompt_hint": build_qa_criteria_prompt_hint(rubric),
    }


@router.put("/qm-scorecard", response_model=QmScorecardGetResponse)
async def put_analytics_qm_scorecard(
    body: QmScorecardPutBody,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    try:
        doc = normalize_qm_scorecard_document({"v": 1, "criteria": body.criteria})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    await db_client.upsert_configuration(
        org_id,
        OrganizationConfigurationKey.MK01_ANALYTICS_QM_SCORECARD.value,
        doc,
    )
    return {"scorecard": doc, "qa_prompt_hint": build_qa_criteria_prompt_hint(doc)}


class AnalyticsDashboardLayoutPutBody(BaseModel):
    layout: dict[str, Any]


@router.get("/dashboard-layout")
async def get_analytics_dashboard_layout(user: UserModel = Depends(get_user)):
    """Org-scoped custom Overview widget layout (``organization_configurations`` JSON)."""
    org_id = _require_org(user)
    raw = await db_client.get_configuration_value(
        org_id, OrganizationConfigurationKey.MK01_ANALYTICS_DASHBOARD_LAYOUT.value
    )
    return {"layout": raw}


@router.put("/dashboard-layout")
async def put_analytics_dashboard_layout(
    body: AnalyticsDashboardLayoutPutBody,
    user: UserModel = Depends(get_user),
):
    """Replace org Overview dashboard layout (validated; same shape as browser localStorage draft)."""
    org_id = _require_org(user)
    try:
        normalized = normalize_analytics_dashboard_layout(body.layout)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    await db_client.upsert_configuration(
        org_id,
        OrganizationConfigurationKey.MK01_ANALYTICS_DASHBOARD_LAYOUT.value,
        normalized,
    )
    return {"layout": normalized}


class AnalyticsRedactionPolicyPutBody(BaseModel):
    detail_redaction_enabled: bool = Field(
        description="When true (default), server applies PII redaction to call detail and CSV exports.",
    )


class AnalyticsRedactionPolicyResponse(BaseModel):
    detail_redaction_enabled: bool
    may_disable_detail_redaction: bool = Field(
        description="Whether this principal may set detail_redaction_enabled to false.",
    )


@router.get("/redaction-policy", response_model=AnalyticsRedactionPolicyResponse)
async def get_analytics_redaction_policy(
    user: UserModel = Depends(get_user),
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    """Org-level toggle for analytics PII redaction (detail + server CSV). Default: enabled."""
    org_id = _require_org(user)
    raw = await db_client.get_configuration_value(
        org_id,
        OrganizationConfigurationKey.MK01_ANALYTICS_DETAIL_REDACTION_ENABLED.value,
        default=None,
    )
    enabled = coerce_detail_redaction_enabled(raw, default_when_missing=True)
    uses_api_key = bool(x_api_key)
    may_disable = await compute_may_disable_detail_redaction(
        user,
        uses_api_key=uses_api_key,
        authorization=authorization,
    )
    return AnalyticsRedactionPolicyResponse(
        detail_redaction_enabled=enabled,
        may_disable_detail_redaction=may_disable,
    )


@router.put("/redaction-policy", response_model=AnalyticsRedactionPolicyResponse)
async def put_analytics_redaction_policy(
    body: AnalyticsRedactionPolicyPutBody,
    user: UserModel = Depends(get_user),
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    """Replace org analytics redaction policy (enterprise / QM — disabling exposes more raw fields)."""
    org_id = _require_org(user)
    uses_api_key = bool(x_api_key)
    if not body.detail_redaction_enabled:
        await ensure_may_disable_analytics_detail_redaction(
            user,
            uses_api_key=uses_api_key,
            authorization=authorization,
        )
    await db_client.upsert_configuration(
        org_id,
        OrganizationConfigurationKey.MK01_ANALYTICS_DETAIL_REDACTION_ENABLED.value,
        body.detail_redaction_enabled,
    )
    may_disable = await compute_may_disable_detail_redaction(
        user,
        uses_api_key=uses_api_key,
        authorization=authorization,
    )
    return AnalyticsRedactionPolicyResponse(
        detail_redaction_enabled=body.detail_redaction_enabled,
        may_disable_detail_redaction=may_disable,
    )


class QmExportScheduleSettingsResponse(BaseModel):
    enabled: bool
    hour_utc: int = Field(ge=0, le=23)
    window_days: int = Field(ge=1, le=366)
    max_rows: int = Field(ge=1, le=10000)
    sampling_mode: str = Field(
        default="smart",
        description="fifo = newest first; smart = prioritize escalations and failed tools.",
    )
    workflow_id: int | None = None
    catalog_slug: str | None = None
    catalog_variant_id: str | None = None


class QmExportLastRunResponse(BaseModel):
    started_at: str | None = None
    finished_at: str | None = None
    status: str | None = Field(default=None, description="ok, error, or null")
    object_key: str | None = None
    error_message: str | None = None


class QmExportScheduleGetResponse(BaseModel):
    schedule: QmExportScheduleSettingsResponse
    last_run: QmExportLastRunResponse
    cron_enabled: bool = Field(
        description="True when workers run hourly ARQ cron to enqueue exports (ENABLE_ANALYTICS_QM_EXPORT_CRON).",
    )
    next_run_at_utc: str | None = Field(
        default=None,
        description=(
            "ISO-8601 UTC timestamp of the next hourly cron slot that may enqueue this org "
            "(same minute as worker QM cron). Null when schedule disabled or deployment cron off."
        ),
    )


class QmExportSchedulePutBody(BaseModel):
    enabled: bool = False
    hour_utc: int = Field(default=6, ge=0, le=23)
    window_days: int = Field(default=7, ge=1, le=366)
    max_rows: int = Field(default=5000, ge=1, le=10000)
    sampling_mode: str = Field(default="smart", description="fifo or smart")
    workflow_id: Optional[int] = None
    catalog_slug: Optional[str] = None
    catalog_variant_id: Optional[str] = None


def _qm_export_schedule_api_payload(doc: dict[str, Any]) -> QmExportScheduleGetResponse:
    sched = QmExportScheduleSettingsResponse(
        enabled=bool(doc.get("enabled")),
        hour_utc=int(doc.get("hour_utc", 6)),
        window_days=int(doc.get("window_days", 7)),
        max_rows=int(doc.get("max_rows", 5000)),
        sampling_mode=str(doc.get("sampling_mode") or "smart"),
        workflow_id=doc.get("workflow_id"),
        catalog_slug=doc.get("catalog_slug"),
        catalog_variant_id=doc.get("catalog_variant_id"),
    )
    lr = QmExportLastRunResponse(
        started_at=doc.get("last_run_started_at"),
        finished_at=doc.get("last_run_finished_at"),
        status=doc.get("last_run_status"),
        object_key=doc.get("last_object_key"),
        error_message=doc.get("last_error_message"),
    )
    next_at = next_analytics_qm_export_dispatch_utc(
        datetime.now(timezone.utc),
        hour_utc=sched.hour_utc,
        enabled=sched.enabled,
        cron_enabled=ENABLE_ANALYTICS_QM_EXPORT_CRON,
    )
    next_iso = next_at.isoformat().replace("+00:00", "Z") if next_at else None
    return QmExportScheduleGetResponse(
        schedule=sched,
        last_run=lr,
        cron_enabled=ENABLE_ANALYTICS_QM_EXPORT_CRON,
        next_run_at_utc=next_iso,
    )


@router.get("/qm-export-schedule", response_model=QmExportScheduleGetResponse)
async def get_analytics_qm_export_schedule(user: UserModel = Depends(get_user)):
    """Org schedule for automated QM CSV uploads to object storage (same columns as server export)."""
    org_id = _require_org(user)
    raw = await db_client.get_configuration_value(
        org_id,
        OrganizationConfigurationKey.MK01_ANALYTICS_QM_EXPORT_SCHEDULE.value,
        default=None,
    )
    existing = raw if isinstance(raw, dict) else None
    try:
        doc = normalize_analytics_qm_export_schedule_document(existing or {})
    except ValueError:
        doc = normalize_analytics_qm_export_schedule_document({})
    return _qm_export_schedule_api_payload(doc)


@router.put("/qm-export-schedule", response_model=QmExportScheduleGetResponse)
async def put_analytics_qm_export_schedule(
    body: QmExportSchedulePutBody,
    user: UserModel = Depends(get_user),
):
    """Replace QM export schedule (worker must run with ENABLE_ANALYTICS_QM_EXPORT_CRON for hourly runs)."""
    org_id = _require_org(user)
    raw = await db_client.get_configuration_value(
        org_id,
        OrganizationConfigurationKey.MK01_ANALYTICS_QM_EXPORT_SCHEDULE.value,
        default=None,
    )
    existing = raw if isinstance(raw, dict) else None
    slug = (body.catalog_slug or "").strip() or None
    variant = (body.catalog_variant_id or "").strip() or None
    merged = merge_put_into_stored_schedule(
        existing,
        enabled=body.enabled,
        hour_utc=body.hour_utc,
        window_days=body.window_days,
        max_rows=body.max_rows,
        sampling_mode=body.sampling_mode,
        workflow_id=body.workflow_id,
        catalog_slug=slug,
        catalog_variant_id=variant,
    )
    await db_client.upsert_configuration(
        org_id,
        OrganizationConfigurationKey.MK01_ANALYTICS_QM_EXPORT_SCHEDULE.value,
        merged,
    )
    return _qm_export_schedule_api_payload(merged)


async def _load_run_for_call(org_id: int, call_id: str):
    run_id = parse_analytics_call_id(call_id)
    if run_id is None:
        raise HTTPException(status_code=404, detail="Call not found")
    run = await db_client.get_workflow_run_by_id(run_id)
    if not run or not run.workflow or run.workflow.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Call not found")
    return run_id, run


@router.post("/calls/{call_id}/ai-review", response_model=CallAiReviewResponse)
async def generate_call_ai_review_route(
    call_id: str,
    body: GenerateCallAiReviewBody | None = None,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    run_id, run = await _load_run_for_call(org_id, call_id)
    detail = await db_client.get_analytics_call_detail(org_id, run_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Call not found")
    review = await generate_call_ai_review(
        call_id=call_id,
        workflow_run=run,
        detail=detail,
        force_refresh=bool(body and body.force_refresh),
    )
    ann_patch = set_cached_ai_review(run.annotations, review)
    await db_client.update_workflow_run(run_id, annotations=ann_patch)
    recs = [
        CallReviewRecommendation(
            title=str(r.get("title") or "Improvement"),
            detail=str(r.get("detail") or ""),
            prompt_snippet=str(r.get("prompt_snippet") or r.get("detail") or ""),
        )
        for r in (review.get("recommendations") or [])
        if isinstance(r, dict)
    ]
    return CallAiReviewResponse(
        call_id=call_id,
        summary=str(review.get("summary") or ""),
        outcome_analysis=str(review.get("outcome_analysis") or ""),
        recommendations=recs,
        suggested_outcome=review.get("suggested_outcome"),
        transcript_excerpt=review.get("transcript_excerpt"),
        generated_at=str(review.get("generated_at") or ""),
        model=review.get("model"),
        source=review.get("source") or "llm",
    )


@router.get("/calls/{call_id}/follow-ups", response_model=FollowUpListResponse)
async def list_call_follow_ups(
    call_id: str,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    run_id, run = await _load_run_for_call(org_id, call_id)
    items = [
        FollowUpItemResponse(**row)
        for row in (run.annotations or {}).get("analytics_follow_ups") or []
        if isinstance(row, dict)
    ]
    return FollowUpListResponse(items=items)


@router.post("/calls/{call_id}/follow-ups", response_model=FollowUpItemResponse)
async def create_call_follow_up(
    call_id: str,
    body: CreateFollowUpBody,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    run_id, run = await _load_run_for_call(org_id, call_id)
    ann, item = append_follow_up(
        run.annotations,
        action_type=body.action_type,
        notes=body.notes,
        scheduled_at=body.scheduled_at,
        contact_hint=body.contact_hint,
        user_id=user.id,
    )
    await db_client.update_workflow_run(run_id, annotations=ann)
    return FollowUpItemResponse(**item)


@router.post(
    "/calls/{call_id}/apply-workflow-improvement",
    response_model=ApplyWorkflowImprovementResponse,
)
async def apply_workflow_improvement_route(
    call_id: str,
    body: ApplyWorkflowImprovementBody,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    run_id, run = await _load_run_for_call(org_id, call_id)
    improvement = body.improvement.strip()
    if body.recommendation_index is not None:
        cached = (run.annotations or {}).get("analytics_ai_review") or {}
        recs = cached.get("recommendations") or []
        if 0 <= body.recommendation_index < len(recs) and isinstance(recs[body.recommendation_index], dict):
            improvement = str(
                recs[body.recommendation_index].get("prompt_snippet")
                or recs[body.recommendation_index].get("detail")
                or improvement
            )

    workflow = await db_client.get_workflow(run.workflow_id, organization_id=org_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    draft = await db_client.get_draft_version(run.workflow_id)
    base_def = (
        draft.workflow_json
        if draft
        else workflow.released_definition.workflow_json
    )
    new_def, node_id = append_improvement_to_workflow_definition(base_def, improvement)
    await db_client.update_workflow(
        workflow_id=run.workflow_id,
        name=workflow.name,
        workflow_definition=new_def,
        organization_id=org_id,
    )
    return ApplyWorkflowImprovementResponse(
        workflow_id=run.workflow_id,
        node_id=node_id,
        message="Improvement appended to agent prompt. Save/publish from the workflow editor when ready.",
    )


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
