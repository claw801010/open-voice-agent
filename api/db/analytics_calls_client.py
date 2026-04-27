"""Org-scoped analytics queries over workflow_runs (MK-01-ANALYTICS-VERTICAL Phase B)."""

from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, or_, select, text
from sqlalchemy.orm import joinedload

from api.db.base_client import BaseDBClient
from api.db.models import WorkflowModel, WorkflowRunModel
from api.services.analytics.call_intel import (
    build_call_metrics,
    disposition_from_gathered,
    distinct_tool_names_from_spans,
    extract_tool_spans_from_logs,
    gather_outcome_dict,
    outcome_key_from_gathered,
    qa_summary_from_annotations,
    workflow_run_to_analytics_call_id,
)


def _decode_cursor(cursor: str | None) -> tuple[datetime | None, int | None]:
    if not cursor:
        return None, None
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        data = json.loads(raw)
        ts_s = data.get("created_at")
        rid = data.get("id")
        if not ts_s or rid is None:
            return None, None
        dt = datetime.fromisoformat(ts_s.replace("Z", "+00:00"))
        return dt, int(rid)
    except (ValueError, json.JSONDecodeError, KeyError, TypeError):
        return None, None


def _encode_cursor(created_at: datetime, run_id: int) -> str:
    payload = json.dumps(
        {"created_at": created_at.isoformat(), "id": run_id},
        separators=(",", ":"),
    )
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")


class AnalyticsCallsClient(BaseDBClient):
    async def list_analytics_calls(
        self,
        organization_id: int,
        *,
        workflow_id: int | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        disposition: str | None = None,
        outcome_key: str | None = None,
        tool_name: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None]:
        """
        Keyset-paginated list of calls for the org (workflow_runs joined to workflows).

        ``call_id`` is ``wr-{workflow_run.id}``. Cursor is opaque (base64 JSON).
        """
        limit = max(1, min(limit, 200))
        cur_ts, cur_id = _decode_cursor(cursor)

        base = (
            select(WorkflowRunModel)
            .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
            .where(WorkflowModel.organization_id == organization_id)
            .options(joinedload(WorkflowRunModel.workflow))
        )

        if workflow_id is not None:
            base = base.where(WorkflowRunModel.workflow_id == workflow_id)
        if since is not None:
            base = base.where(WorkflowRunModel.created_at >= since)
        if until is not None:
            base = base.where(WorkflowRunModel.created_at <= until)
        if disposition:
            base = base.where(
                WorkflowRunModel.gathered_context["mapped_call_disposition"].as_string()
                == disposition
            )
        if outcome_key:
            gc = WorkflowRunModel.gathered_context
            base = base.where(
                or_(
                    gc["outcome_key"].as_string() == outcome_key,
                    gc["customer_outcome"].as_string() == outcome_key,
                )
            )
        if tool_name:
            base = base.where(
                text(
                    """
                    EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements(
                        COALESCE(workflow_runs.logs::jsonb -> 'realtime_feedback_events', '[]'::jsonb)
                      ) AS elem
                      WHERE elem->>'type' = 'rtf-function-call-end'
                        AND elem->'payload'->>'function_name' = :tool_fn
                    )
                    """
                ).bindparams(tool_fn=tool_name)
            )

        if cur_ts is not None and cur_id is not None:
            base = base.where(
                or_(
                    WorkflowRunModel.created_at < cur_ts,
                    and_(
                        WorkflowRunModel.created_at == cur_ts,
                        WorkflowRunModel.id < cur_id,
                    ),
                )
            )

        base = base.order_by(
            WorkflowRunModel.created_at.desc(),
            WorkflowRunModel.id.desc(),
        ).limit(limit + 1)

        async with self.async_session() as session:
            result = await session.execute(base)
            rows = list(result.scalars().all())

        has_more = len(rows) > limit
        page = rows[:limit]

        items: list[dict[str, Any]] = []
        for run in page:
            wf = run.workflow
            cost = run.cost_info or {}
            dur_sec = cost.get("call_duration_seconds") or 0
            try:
                duration_ms = max(0, int(round(float(dur_sec) * 1000)))
            except (TypeError, ValueError):
                duration_ms = 0
            gc = run.gathered_context or {}
            spans = extract_tool_spans_from_logs(run.logs or {})
            mk01 = (wf.workflow_configurations or {}).get("mk01") if wf else None
            catalog_slug = None
            if isinstance(mk01, dict):
                catalog_slug = mk01.get("catalog_slug")
            items.append(
                {
                    "call_id": workflow_run_to_analytics_call_id(run.id),
                    "workflow_id": run.workflow_id,
                    "workflow_slug": str(catalog_slug)
                    if catalog_slug is not None
                    else None,
                    "started_at": run.created_at.isoformat(),
                    "duration_ms": duration_ms,
                    "disposition": disposition_from_gathered(gc),
                    "outcome_key": outcome_key_from_gathered(gc),
                    "tool_names": distinct_tool_names_from_spans(spans),
                }
            )

        next_cursor: str | None = None
        if has_more and page:
            last = page[-1]
            next_cursor = _encode_cursor(last.created_at, last.id)

        return items, next_cursor

    async def get_analytics_call_detail(
        self,
        organization_id: int,
        workflow_run_id: int,
    ) -> dict[str, Any] | None:
        async with self.async_session() as session:
            result = await session.execute(
                select(WorkflowRunModel)
                .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
                .where(
                    WorkflowModel.organization_id == organization_id,
                    WorkflowRunModel.id == workflow_run_id,
                )
                .options(joinedload(WorkflowRunModel.workflow))
            )
            run = result.scalars().first()

        if not run:
            return None

        wf = run.workflow
        logs = run.logs or {}
        gc = run.gathered_context or {}
        cost = run.cost_info or {}
        dur_sec = cost.get("call_duration_seconds") or 0
        try:
            duration_ms = max(0, int(round(float(dur_sec) * 1000)))
        except (TypeError, ValueError):
            duration_ms = 0

        spans = extract_tool_spans_from_logs(logs)
        for s in spans:
            if not s.get("started_at"):
                s["started_at"] = run.created_at.isoformat()
        metrics = build_call_metrics(spans, logs, cost)
        ended_at = None
        if run.is_completed and duration_ms > 0 and run.created_at:
            ended_at = (
                run.created_at + timedelta(milliseconds=duration_ms)
            ).isoformat()

        mk01 = (wf.workflow_configurations or {}).get("mk01") if wf else None
        catalog_slug = None
        if isinstance(mk01, dict):
            catalog_slug = mk01.get("catalog_slug")

        return {
            "call_id": workflow_run_to_analytics_call_id(run.id),
            "workflow_id": run.workflow_id,
            "workflow_slug": str(catalog_slug) if catalog_slug is not None else None,
            "started_at": run.created_at.isoformat(),
            "ended_at": ended_at,
            "duration_ms": duration_ms,
            "metrics": metrics,
            "outcomes": gather_outcome_dict(gc),
            "tool_spans": spans,
            "ai_summary": None,
            "qa": qa_summary_from_annotations(run.annotations or {}),
        }
