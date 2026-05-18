"""Persist and load normalized analytics tool spans (MK-01 Phase D)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select

from api.db.analytics_http_tool_span_rls import set_analytics_http_tool_span_rls_org
from api.db.base_client import BaseDBClient
from api.db.models import AnalyticsHttpToolSpanModel
from api.services.analytics.analytics_http_tool_spans import (
    parse_started_at_iso,
    tool_span_row_to_api_dict,
    truncate_str,
)
from api.services.analytics.call_intel import extract_tool_spans_from_logs


class AnalyticsHttpToolSpanClient(BaseDBClient):
    @staticmethod
    def span_row_to_api_dict(row: AnalyticsHttpToolSpanModel) -> dict[str, Any]:
        http = row.http_summary
        return tool_span_row_to_api_dict(
            span_id=row.span_id,
            tool_name=row.tool_name,
            tool_type=row.tool_type,
            started_at=row.started_at,
            duration_ms=row.duration_ms,
            http_summary=http if isinstance(http, dict) else None,
        )

    async def map_analytics_http_tool_spans_for_run_ids(
        self,
        organization_id: int,
        run_ids: list[int],
    ) -> dict[int, list[dict[str, Any]]]:
        """Batch-load span dicts keyed by workflow_run_id (stable order by row id)."""
        if not run_ids:
            return {}
        async with self.async_session() as session:
            await set_analytics_http_tool_span_rls_org(session, organization_id)
            result = await session.execute(
                select(AnalyticsHttpToolSpanModel)
                .where(
                    AnalyticsHttpToolSpanModel.organization_id == organization_id,
                    AnalyticsHttpToolSpanModel.workflow_run_id.in_(run_ids),
                )
                .order_by(
                    AnalyticsHttpToolSpanModel.workflow_run_id.asc(),
                    AnalyticsHttpToolSpanModel.id.asc(),
                )
            )
            rows = list(result.scalars().all())
        out: dict[int, list[dict[str, Any]]] = {}
        for r in rows:
            rid = r.workflow_run_id
            out.setdefault(rid, []).append(self.span_row_to_api_dict(r))
        return out

    async def list_analytics_http_tool_spans_for_run(
        self, organization_id: int, workflow_run_id: int
    ) -> list[dict[str, Any]]:
        async with self.async_session() as session:
            await set_analytics_http_tool_span_rls_org(session, organization_id)
            result = await session.execute(
                select(AnalyticsHttpToolSpanModel)
                .where(
                    AnalyticsHttpToolSpanModel.organization_id == organization_id,
                    AnalyticsHttpToolSpanModel.workflow_run_id == workflow_run_id,
                )
                .order_by(AnalyticsHttpToolSpanModel.id.asc())
            )
            rows = list(result.scalars().all())
        return [self.span_row_to_api_dict(r) for r in rows]

    async def replace_analytics_http_tool_spans_for_run(
        self,
        *,
        organization_id: int,
        workflow_id: int,
        workflow_run_id: int,
        logs: dict[str, Any] | None,
    ) -> None:
        spans = extract_tool_spans_from_logs(logs)
        async with self.async_session() as session:
            await set_analytics_http_tool_span_rls_org(session, organization_id)
            await session.execute(
                delete(AnalyticsHttpToolSpanModel).where(
                    AnalyticsHttpToolSpanModel.workflow_run_id == workflow_run_id,
                )
            )
            for idx, s in enumerate(spans):
                sid_raw = s.get("span_id")
                sid = truncate_str(str(sid_raw) if sid_raw is not None else "", 512)
                if not sid:
                    sid = f"span-{idx}"[:512]
                http = s.get("http")
                http_summary = http if isinstance(http, dict) and http else None
                started_raw = s.get("started_at")
                started_at = parse_started_at_iso(
                    started_raw if isinstance(started_raw, str) else None
                )
                try:
                    duration_ms = max(0, int(s.get("duration_ms") or 0))
                except (TypeError, ValueError):
                    duration_ms = 0
                session.add(
                    AnalyticsHttpToolSpanModel(
                        organization_id=organization_id,
                        workflow_id=workflow_id,
                        workflow_run_id=workflow_run_id,
                        span_id=sid,
                        tool_name=truncate_str(str(s.get("tool_name") or "unknown"), 512),
                        tool_type=truncate_str(str(s.get("tool_type") or "function"), 64),
                        started_at=started_at,
                        duration_ms=duration_ms,
                        http_summary=http_summary,
                    )
                )
            await session.commit()
