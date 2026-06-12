"""Org-scoped analytics queries over workflow_runs (MK-01-ANALYTICS-VERTICAL Phase B)."""

from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.orm import joinedload

from api.db.analytics_http_tool_span_rls import set_analytics_http_tool_span_rls_org
from api.db.base_client import BaseDBClient
from api.db.models import WorkflowModel, WorkflowRunModel
from api.enums import OrganizationConfigurationKey
from api.services.analytics.analytics_redact import (
    coerce_detail_redaction_enabled,
    redact_analytics_call_detail,
)
from api.services.analytics.call_live_trace import (
    build_live_trace_timeline,
    build_llm_inference_insights,
    build_tool_invocation_details,
)
from api.services.analytics.call_quality_report import build_call_quality_report
from api.services.analytics.call_engineering_links import build_engineering_links
from api.services.analytics.call_intel import parse_analytics_call_id
from api.services.analytics.http_cache_insights import fetch_http_cache_rollups
from api.services.analytics.insights_quality_rollup import (
    QUALITY_ROLLUP_MAX_RUNS,
    rollup_quality_insights,
)
from api.services.analytics.qm_export_sampling import select_run_ids_smart_export
from api.services.analytics.qm_scorecard import (
    DEFAULT_QM_SCORECARD,
    build_call_scorecard,
    normalize_qm_scorecard_document,
)
from api.services.analytics.call_transcript import transcript_from_logs
from api.services.analytics.call_follow_ups import (
    get_cached_ai_review,
    is_inbox_pending,
    list_follow_ups,
)
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
    async def analytics_detail_redaction_enabled(self, organization_id: int) -> bool:
        """Whether call detail + CSV exports should apply PII redaction for this org."""
        raw = await self.get_configuration_value(
            organization_id,
            OrganizationConfigurationKey.MK01_ANALYTICS_DETAIL_REDACTION_ENABLED.value,
            default=None,
        )
        return coerce_detail_redaction_enabled(raw, default_when_missing=True)

    async def get_analytics_insights(
        self,
        organization_id: int,
        since: datetime,
        until: datetime,
        workflow_id: int | None = None,
        catalog_slug: str | None = None,
        catalog_variant_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Roll-up counts for default dashboard (vertical / booking GTM).

        * ``calls_with_outcome`` — run has non-empty ``outcome_key`` or ``customer_outcome`` in
          ``gathered_context``.
        * ``outcome_mix`` — top buckets by coalesced outcome (``outcome_key`` then
          ``customer_outcome``), else ``(no outcome key)``.
        * ``calls_with_tool_evidence`` / ``calls_with_logged_tools`` — same count: runs with tool
          trace in ``logs.realtime_feedback_events`` **or** rows in ``analytics_http_tool_spans``.
        * ``tool_name_mix`` — top tool ``function_name`` values by **distinct run** count (a run
          with multiple invocations of the same tool counts once).
        * ``http_tool_invocations`` / ``http_tool_cache_hits`` — HTTP tool end events from span
          rows (preferred) or run logs when no spans exist; ``cache_hit`` from stored summaries.
        """
        base_conds: list = [
            WorkflowModel.organization_id == organization_id,
            WorkflowRunModel.created_at >= since,
            WorkflowRunModel.created_at <= until,
        ]
        if workflow_id is not None:
            base_conds.append(WorkflowRunModel.workflow_id == workflow_id)
        if catalog_slug is not None:
            base_conds.append(
                text("workflows.workflow_configurations->'mk01'->>'catalog_slug' = :cslug").bindparams(
                    cslug=catalog_slug
                )
            )
        if catalog_variant_id is not None:
            base_conds.append(
                text(
                    "workflows.workflow_configurations->'mk01'->>'catalog_variant_id' = :cvid"
                ).bindparams(cvid=catalog_variant_id)
            )

        with_outcome_extra = text(
            """
            (
                (nullif(btrim(workflow_runs.gathered_context->>'outcome_key'), '') IS NOT NULL)
                OR (nullif(btrim(workflow_runs.gathered_context->>'customer_outcome'), '') IS NOT NULL)
            )
            """
        )

        mix_sql_extra = ""
        mix_params: dict[str, Any] = {
            "oid": organization_id,
            "since": since,
            "until": until,
        }
        if workflow_id is not None:
            mix_sql_extra += " AND workflow_runs.workflow_id = :wf"
            mix_params["wf"] = workflow_id
        if catalog_slug is not None:
            mix_sql_extra += " AND workflows.workflow_configurations->'mk01'->>'catalog_slug' = :cslug"
            mix_params["cslug"] = catalog_slug
        if catalog_variant_id is not None:
            mix_sql_extra += (
                " AND workflows.workflow_configurations->'mk01'->>'catalog_variant_id' = :cvid"
            )
            mix_params["cvid"] = catalog_variant_id

        mix_q = text(
            f"""
            SELECT COALESCE(
                NULLIF(TRIM(workflow_runs.gathered_context->>'outcome_key'), ''),
                NULLIF(TRIM(workflow_runs.gathered_context->>'customer_outcome'), ''),
                '(no outcome key)'
            ) AS k,
            COUNT(*)::int AS n
            FROM workflow_runs
            INNER JOIN workflows ON workflow_runs.workflow_id = workflows.id
            WHERE workflows.organization_id = :oid
              AND workflow_runs.created_at >= :since
              AND workflow_runs.created_at <= :until
            {mix_sql_extra}
            GROUP BY 1
            ORDER BY n DESC
            LIMIT 20
            """
        )

        has_logged_tool_logs = text(
            """
            EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                    COALESCE(workflow_runs.logs::jsonb -> 'realtime_feedback_events', '[]'::jsonb)
                ) AS elem
                WHERE elem->>'type' = 'rtf-function-call-end'
            )
            """
        )
        has_logged_tool_spans = text(
            """
            EXISTS (
                SELECT 1
                FROM analytics_http_tool_spans s
                WHERE s.workflow_run_id = workflow_runs.id
                  AND s.organization_id = workflows.organization_id
            )
            """
        )
        has_logged_tool = or_(has_logged_tool_logs, has_logged_tool_spans)

        tools_mix_q = text(
            f"""
            SELECT tool_name, COUNT(DISTINCT rid)::int AS n
            FROM (
              SELECT TRIM(elem->'payload'->>'function_name') AS tool_name,
                     workflow_runs.id AS rid
              FROM workflow_runs
              INNER JOIN workflows ON workflow_runs.workflow_id = workflows.id
              CROSS JOIN LATERAL jsonb_array_elements(
                  COALESCE(workflow_runs.logs::jsonb -> 'realtime_feedback_events', '[]'::jsonb)
              ) AS elem
              WHERE workflows.organization_id = :oid
                AND workflow_runs.created_at >= :since
                AND workflow_runs.created_at <= :until
                AND elem->>'type' = 'rtf-function-call-end'
                AND NULLIF(TRIM(elem->'payload'->>'function_name'), '') IS NOT NULL
              {mix_sql_extra}
              UNION
              SELECT TRIM(s.tool_name) AS tool_name,
                     workflow_runs.id AS rid
              FROM workflow_runs
              INNER JOIN workflows ON workflow_runs.workflow_id = workflows.id
              INNER JOIN analytics_http_tool_spans s
                ON s.workflow_run_id = workflow_runs.id
               AND s.organization_id = workflows.organization_id
              WHERE workflows.organization_id = :oid
                AND workflow_runs.created_at >= :since
                AND workflow_runs.created_at <= :until
                AND NULLIF(TRIM(s.tool_name), '') IS NOT NULL
              {mix_sql_extra}
            ) AS tool_rows
            GROUP BY tool_name
            ORDER BY n DESC
            LIMIT 15
            """
        )

        async with self.async_session() as session:
            await set_analytics_http_tool_span_rls_org(session, organization_id)
            q_total = (
                select(func.count(WorkflowRunModel.id))
                .select_from(WorkflowRunModel)
                .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
                .where(and_(*base_conds))
            )
            total = int((await session.execute(q_total)).scalar() or 0)

            q_wo = (
                select(func.count(WorkflowRunModel.id))
                .select_from(WorkflowRunModel)
                .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
                .where(and_(*base_conds, with_outcome_extra))
            )
            with_out = int((await session.execute(q_wo)).scalar() or 0)

            q_tools = (
                select(func.count(WorkflowRunModel.id))
                .select_from(WorkflowRunModel)
                .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
                .where(and_(*base_conds, has_logged_tool))
            )
            with_tools = int((await session.execute(q_tools)).scalar() or 0)

            mix_result = await session.execute(mix_q, mix_params)
            outcome_mix: list[dict[str, Any]] = []
            for row in mix_result:
                outcome_mix.append({"outcome": str(row[0]), "count": int(row[1])})

            tools_mix_result = await session.execute(tools_mix_q, mix_params)
            tool_name_mix: list[dict[str, Any]] = []
            for row in tools_mix_result:
                tool_name_mix.append({"tool_name": str(row[0]), "count": int(row[1])})

            q_quality_runs = (
                select(
                    WorkflowRunModel.logs,
                    WorkflowRunModel.gathered_context,
                    WorkflowRunModel.annotations,
                    WorkflowRunModel.cost_info,
                )
                .select_from(WorkflowRunModel)
                .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
                .where(and_(*base_conds))
                .order_by(WorkflowRunModel.created_at.desc())
                .limit(QUALITY_ROLLUP_MAX_RUNS)
            )
            quality_rows = (await session.execute(q_quality_runs)).all()
            snapshots = [
                {
                    "logs": row[0] or {},
                    "gathered_context": row[1] or {},
                    "annotations": row[2] or {},
                    "cost_info": row[3] or {},
                }
                for row in quality_rows
            ]
            quality_summary = rollup_quality_insights(
                snapshots, total_calls_in_range=total
            )

            cache_rollups = await fetch_http_cache_rollups(
                session,
                mix_params=mix_params,
                mix_sql_extra=mix_sql_extra,
            )

        return {
            "total_calls": total,
            "calls_with_outcome": with_out,
            "calls_with_logged_tools": with_tools,
            "calls_with_tool_evidence": with_tools,
            "outcome_mix": outcome_mix,
            "tool_name_mix": tool_name_mix,
            "quality_summary": quality_summary,
            "http_tool_invocations": cache_rollups["http_tool_invocations"],
            "http_tool_cache_hits": cache_rollups["http_tool_cache_hits"],
        }

    async def list_analytics_calls(
        self,
        organization_id: int,
        *,
        workflow_id: int | None = None,
        catalog_slug: str | None = None,
        catalog_variant_id: str | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        disposition: str | None = None,
        outcome_key: str | None = None,
        tool_name: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
        include_qm_summary: bool = False,
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
        if catalog_slug is not None:
            base = base.where(
                text("workflows.workflow_configurations->'mk01'->>'catalog_slug' = :cslug").bindparams(
                    cslug=catalog_slug
                )
            )
        if catalog_variant_id is not None:
            base = base.where(
                text(
                    "workflows.workflow_configurations->'mk01'->>'catalog_variant_id' = :cvid"
                ).bindparams(cvid=catalog_variant_id)
            )
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
                    (
                      EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(
                          COALESCE(workflow_runs.logs::jsonb -> 'realtime_feedback_events', '[]'::jsonb)
                        ) AS elem
                        WHERE elem->>'type' = 'rtf-function-call-end'
                          AND elem->'payload'->>'function_name' = :tool_fn
                      )
                      OR EXISTS (
                        SELECT 1
                        FROM analytics_http_tool_spans s
                        WHERE s.workflow_run_id = workflow_runs.id
                          AND s.organization_id = workflows.organization_id
                          AND s.tool_name = :tool_fn
                      )
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
            await set_analytics_http_tool_span_rls_org(session, organization_id)
            result = await session.execute(base)
            rows = list(result.scalars().all())

        has_more = len(rows) > limit
        page = rows[:limit]

        run_ids = [r.id for r in page]
        rubric = (
            await self.get_qm_scorecard_rubric(organization_id)
            if include_qm_summary and run_ids
            else None
        )
        items = await self._list_items_for_run_ids(
            organization_id, run_ids, rubric=rubric
        )

        next_cursor: str | None = None
        if has_more and page:
            last = page[-1]
            next_cursor = _encode_cursor(last.created_at, last.id)

        return items, next_cursor

    async def get_qm_scorecard_rubric(self, organization_id: int) -> dict[str, Any]:
        from api.enums import OrganizationConfigurationKey

        raw = await self.get_configuration_value(
            organization_id,
            OrganizationConfigurationKey.MK01_ANALYTICS_QM_SCORECARD.value,
            default=None,
        )
        try:
            return normalize_qm_scorecard_document(raw or DEFAULT_QM_SCORECARD)
        except ValueError:
            return normalize_qm_scorecard_document(DEFAULT_QM_SCORECARD)

    async def _list_items_for_run_ids(
        self,
        organization_id: int,
        run_ids: list[int],
        *,
        rubric: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        if not run_ids:
            return []
        async with self.async_session() as session:
            await set_analytics_http_tool_span_rls_org(session, organization_id)
            result = await session.execute(
                select(WorkflowRunModel)
                .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
                .where(
                    WorkflowModel.organization_id == organization_id,
                    WorkflowRunModel.id.in_(run_ids),
                )
                .options(joinedload(WorkflowRunModel.workflow))
            )
            runs = {r.id: r for r in result.scalars().all()}
        span_by_run = await self.map_analytics_http_tool_spans_for_run_ids(
            organization_id, run_ids
        )
        items: list[dict[str, Any]] = []
        for rid in run_ids:
            run = runs.get(rid)
            if not run:
                continue
            wf = run.workflow
            cost = run.cost_info or {}
            dur_sec = cost.get("call_duration_seconds") or 0
            try:
                duration_ms = max(0, int(round(float(dur_sec) * 1000)))
            except (TypeError, ValueError):
                duration_ms = 0
            gc = run.gathered_context or {}
            spans = span_by_run.get(run.id)
            if spans is None:
                spans = extract_tool_spans_from_logs(run.logs or {})
            mk01 = (wf.workflow_configurations or {}).get("mk01") if wf else None
            catalog_slug = None
            catalog_variant_id_val = None
            if isinstance(mk01, dict):
                catalog_slug = mk01.get("catalog_slug")
                catalog_variant_id_val = mk01.get("catalog_variant_id")
            row: dict[str, Any] = {
                "call_id": workflow_run_to_analytics_call_id(run.id),
                "workflow_id": run.workflow_id,
                "workflow_slug": str(catalog_slug)
                if catalog_slug is not None
                else None,
                "catalog_variant_id": str(catalog_variant_id_val)
                if catalog_variant_id_val is not None
                else None,
                "started_at": run.created_at.isoformat(),
                "duration_ms": duration_ms,
                "disposition": disposition_from_gathered(gc),
                "outcome_key": outcome_key_from_gathered(gc),
                "tool_names": distinct_tool_names_from_spans(spans),
            }
            if rubric is not None:
                quality = build_call_quality_report(
                    logs=run.logs,
                    gathered_context=gc,
                    annotations=run.annotations or {},
                    duration_ms=duration_ms,
                )
                scorecard = build_call_scorecard(
                    rubric=rubric,
                    annotations=run.annotations or {},
                )
                row["cx_score"] = quality.get("cx_score")
                row["containment"] = quality.get("containment")
                row["qa_score"] = quality.get("qa_score")
                summary = scorecard.get("summary") or {}
                row["scorecard_pass_rate"] = summary.get("pass_rate")
            items.append(row)
        return items

    async def export_analytics_calls_flat(
        self,
        organization_id: int,
        *,
        workflow_id: int | None = None,
        catalog_slug: str | None = None,
        catalog_variant_id: str | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        disposition: str | None = None,
        outcome_key: str | None = None,
        tool_name: str | None = None,
        max_rows: int = 5000,
        sampling_mode: str = "fifo",
    ) -> tuple[list[dict[str, Any]], bool]:
        """
        Same filters as ``list_analytics_calls``, paginating until ``max_rows`` or no more pages.

        Used for server-side CSV export (QM); cap avoids unbounded memory use.

        Returns ``(rows, redact_csv_cells)`` — second value follows org redaction policy.
        """
        redact_cells = await self.analytics_detail_redaction_enabled(organization_id)
        max_rows = max(1, min(int(max_rows), 10_000))
        mode = (sampling_mode or "fifo").strip().lower()
        if (
            mode == "smart"
            and since is not None
            and until is not None
            and not disposition
            and not outcome_key
            and not tool_name
        ):
            async with self.async_session() as session:
                await set_analytics_http_tool_span_rls_org(session, organization_id)
                run_ids = await select_run_ids_smart_export(
                    session,
                    organization_id,
                    workflow_id=workflow_id,
                    catalog_slug=catalog_slug,
                    catalog_variant_id=catalog_variant_id,
                    since=since,
                    until=until,
                    max_rows=max_rows,
                )
            rubric = await self.get_qm_scorecard_rubric(organization_id)
            return (
                await self._list_items_for_run_ids(
                    organization_id, run_ids, rubric=rubric
                ),
                redact_cells,
            )

        out: list[dict[str, Any]] = []
        cursor: str | None = None
        batch = min(200, max_rows)
        while len(out) < max_rows:
            take = min(batch, max_rows - len(out))
            items, next_cursor = await self.list_analytics_calls(
                organization_id,
                workflow_id=workflow_id,
                catalog_slug=catalog_slug,
                catalog_variant_id=catalog_variant_id,
                since=since,
                until=until,
                disposition=disposition,
                outcome_key=outcome_key,
                tool_name=tool_name,
                limit=take,
                cursor=cursor,
            )
            if not items:
                break
            out.extend(items)
            if next_cursor is None:
                break
            cursor = next_cursor
        page = out[:max_rows]
        ordered_ids: list[int] = []
        for item in page:
            rid = parse_analytics_call_id(str(item.get("call_id") or ""))
            if rid is not None:
                ordered_ids.append(rid)
        if ordered_ids:
            rubric = await self.get_qm_scorecard_rubric(organization_id)
            return (
                await self._list_items_for_run_ids(
                    organization_id, ordered_ids, rubric=rubric
                ),
                redact_cells,
            )
        return page, redact_cells

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

        stored = await self.list_analytics_http_tool_spans_for_run(
            organization_id, workflow_run_id
        )
        if stored:
            spans = stored
        else:
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
        catalog_variant_id_val = None
        if isinstance(mk01, dict):
            catalog_slug = mk01.get("catalog_slug")
            catalog_variant_id_val = mk01.get("catalog_variant_id")

        cached_review = get_cached_ai_review(run.annotations or {})
        transcript = transcript_from_logs(run.logs)
        rubric = await self.get_qm_scorecard_rubric(organization_id)

        raw = {
            "call_id": workflow_run_to_analytics_call_id(run.id),
            "workflow_id": run.workflow_id,
            "workflow_slug": str(catalog_slug) if catalog_slug is not None else None,
            "catalog_variant_id": str(catalog_variant_id_val)
            if catalog_variant_id_val is not None
            else None,
            "started_at": run.created_at.isoformat(),
            "ended_at": ended_at,
            "duration_ms": duration_ms,
            "metrics": metrics,
            "outcomes": gather_outcome_dict(gc),
            "tool_spans": spans,
            "transcript": transcript or None,
            "ai_summary": (cached_review.get("summary") if cached_review else None),
            "qa": qa_summary_from_annotations(run.annotations or {}),
            "follow_ups": list_follow_ups(run.annotations or {}),
            "live_trace": {
                "timeline": build_live_trace_timeline(run.logs),
                "tool_invocations": build_tool_invocation_details(run.logs),
                "llm_inference": build_llm_inference_insights(run.logs),
            },
            "quality_report": build_call_quality_report(
                logs=run.logs,
                gathered_context=gc,
                annotations=run.annotations or {},
                duration_ms=duration_ms,
            ),
            "scorecard": build_call_scorecard(
                rubric=rubric,
                annotations=run.annotations or {},
            ),
            "engineering_links": build_engineering_links(
                gc, organization_id=organization_id
            ),
        }
        if await self.analytics_detail_redaction_enabled(organization_id):
            return redact_analytics_call_detail(raw)
        return raw

    async def list_review_inbox(
        self,
        organization_id: int,
        *,
        limit: int = 50,
        status: str = "pending",
    ) -> list[dict[str, Any]]:
        """Human-in-the-loop items from run annotations (pending suggested responses)."""
        from sqlalchemy import desc

        limit = max(1, min(limit, 200))
        q = (
            select(WorkflowRunModel)
            .join(WorkflowModel, WorkflowRunModel.workflow_id == WorkflowModel.id)
            .where(WorkflowModel.organization_id == organization_id)
            .options(joinedload(WorkflowRunModel.workflow))
            .order_by(desc(WorkflowRunModel.created_at))
            .limit(300)
        )
        async with self.async_session() as session:
            runs = (await session.execute(q)).scalars().unique().all()

        items: list[dict[str, Any]] = []
        for run in runs:
            wf = run.workflow
            mk01 = (wf.workflow_configurations or {}).get("mk01") if wf else {}
            catalog_slug = mk01.get("catalog_slug") if isinstance(mk01, dict) else None
            cached = get_cached_ai_review(run.annotations or {})
            ai_summary = cached.get("summary") if cached else None
            for fu in list_follow_ups(run.annotations or {}):
                fu_status = str(fu.get("status") or "pending")
                if status == "pending" and not is_inbox_pending(fu):
                    continue
                if status != "pending" and fu_status != status:
                    continue
                items.append(
                    {
                        "call_id": workflow_run_to_analytics_call_id(run.id),
                        "workflow_id": run.workflow_id,
                        "workflow_name": wf.name if wf else None,
                        "catalog_slug": catalog_slug,
                        "follow_up": fu,
                        "ai_summary": ai_summary,
                    }
                )
                if len(items) >= limit:
                    return items
        return items
