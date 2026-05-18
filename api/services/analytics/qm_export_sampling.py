"""Smart QM export row selection — prioritize escalations and tool failures."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_, or_, select, text
from sqlalchemy.orm import joinedload

from api.db.models import WorkflowModel, WorkflowRunModel

# Max runs considered for tier scoring before taking top N (keeps export fast).
SMART_EXPORT_CANDIDATE_CAP = 5000

_TIER_ESCALATION = 0
_TIER_TOOL_FAILURE = 1
_TIER_NORMAL = 2


def _base_filter_conds(
    organization_id: int,
    *,
    workflow_id: int | None,
    catalog_slug: str | None,
    catalog_variant_id: str | None,
    since: datetime,
    until: datetime,
) -> list:
    conds = [
        WorkflowModel.organization_id == organization_id,
        WorkflowRunModel.created_at >= since,
        WorkflowRunModel.created_at <= until,
    ]
    if workflow_id is not None:
        conds.append(WorkflowRunModel.workflow_id == workflow_id)
    if catalog_slug is not None:
        conds.append(
            text("workflows.workflow_configurations->'mk01'->>'catalog_slug' = :cslug").bindparams(
                cslug=catalog_slug
            )
        )
    if catalog_variant_id is not None:
        conds.append(
            text(
                "workflows.workflow_configurations->'mk01'->>'catalog_variant_id' = :cvid"
            ).bindparams(cvid=catalog_variant_id)
        )
    return conds


def _priority_tier_sql() -> str:
    """SQL expression: 0=escalation/fatal, 1=tool failure, 2=normal."""
    return """
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          COALESCE(workflow_runs.logs::jsonb -> 'realtime_feedback_events', '[]'::jsonb)
        ) AS elem
        WHERE elem->>'type' = 'rtf-pipeline-error'
          AND COALESCE((elem->'payload'->>'fatal')::boolean, false) = true
      ) THEN 0
      WHEN (
        lower(
          coalesce(workflow_runs.gathered_context->>'outcome_key', '') || ' ' ||
          coalesce(workflow_runs.gathered_context->>'customer_outcome', '') || ' ' ||
          coalesce(workflow_runs.gathered_context->>'mapped_call_disposition', '')
        ) LIKE '%escalat%'
        OR lower(
          coalesce(workflow_runs.gathered_context->>'outcome_key', '') || ' ' ||
          coalesce(workflow_runs.gathered_context->>'customer_outcome', '')
        ) LIKE '%transfer%'
        OR lower(
          coalesce(workflow_runs.gathered_context->>'outcome_key', '') || ' ' ||
          coalesce(workflow_runs.gathered_context->>'customer_outcome', '')
        ) LIKE '%human%'
        OR lower(
          coalesce(workflow_runs.gathered_context->>'outcome_key', '') || ' ' ||
          coalesce(workflow_runs.gathered_context->>'customer_outcome', '')
        ) LIKE '%supervisor%'
      ) THEN 0
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          COALESCE(workflow_runs.logs::jsonb -> 'realtime_feedback_events', '[]'::jsonb)
        ) AS elem
        WHERE elem->>'type' = 'rtf-function-call-end'
          AND (
            lower(coalesce(elem->'payload'->>'result', '')) LIKE '%"status":"error"%'
            OR lower(coalesce(elem->'payload'->>'result', '')) LIKE '%"status": "error"%'
            OR lower(coalesce(elem->'payload'->>'result', '')) LIKE '%"status_code": 4%'
            OR lower(coalesce(elem->'payload'->>'result', '')) LIKE '%"status_code": 5%'
            OR lower(coalesce(elem->'payload'->>'result', '')) LIKE '%"request_status": 4%'
            OR lower(coalesce(elem->'payload'->>'result', '')) LIKE '%"request_status": 5%'
          )
      ) THEN 1
      ELSE 2
    END
    """


async def select_run_ids_smart_export(
    session,
    organization_id: int,
    *,
    workflow_id: int | None,
    catalog_slug: str | None,
    catalog_variant_id: str | None,
    since: datetime,
    until: datetime,
    max_rows: int,
) -> list[int]:
    """
    Return workflow_run ids for QM export, highest priority first.

    Tier 0: fatal pipeline errors or escalation-like outcomes.
    Tier 1: tool calls with error status or HTTP >= 400 in result JSON.
    Tier 2: remaining calls (newest first within tier).
    """
    cap = min(SMART_EXPORT_CANDIDATE_CAP, max(max_rows * 3, max_rows))
    conds = _base_filter_conds(
        organization_id,
        workflow_id=workflow_id,
        catalog_slug=catalog_slug,
        catalog_variant_id=catalog_variant_id,
        since=since,
        until=until,
    )
    tier_sql = _priority_tier_sql()
    q = (
        select(WorkflowRunModel.id)
        .select_from(WorkflowRunModel)
        .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
        .where(and_(*conds))
        .order_by(
            text(f"({tier_sql}) ASC"),
            WorkflowRunModel.created_at.desc(),
            WorkflowRunModel.id.desc(),
        )
        .limit(cap)
    )
    result = await session.execute(q)
    ids = [int(r[0]) for r in result.all()]
    return ids[:max_rows]
