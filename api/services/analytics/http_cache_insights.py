"""Roll up HTTP integration cache hits for analytics insights (WE-01-DATASTORE-INTEG)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _http_cache_rollups_sql(mix_sql_extra: str) -> str:
    """SQL returning one row: invocations, cache_hits (span table + log fallback)."""
    return f"""
    SELECT
      COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)::int AS cache_hits,
      COUNT(*)::int AS invocations
    FROM (
      SELECT
        COALESCE((s.http_summary->>'cache_hit')::boolean, false) AS cache_hit
      FROM analytics_http_tool_spans s
      INNER JOIN workflow_runs ON s.workflow_run_id = workflow_runs.id
      INNER JOIN workflows ON workflow_runs.workflow_id = workflows.id
      WHERE workflows.organization_id = :oid
        AND workflow_runs.created_at >= :since
        AND workflow_runs.created_at <= :until
        AND s.organization_id = workflows.organization_id
        AND (
          s.tool_type = 'http_api'
          OR NULLIF(s.http_summary->>'request_status', '') IS NOT NULL
        )
      {mix_sql_extra}

      UNION ALL

      SELECT
        COALESCE(
          CASE
            WHEN elem->'payload'->>'result' LIKE '{{%'
            THEN ((elem->'payload'->>'result')::jsonb->>'cache_hit')::boolean
            ELSE false
          END,
          false
        ) AS cache_hit
      FROM workflow_runs
      INNER JOIN workflows ON workflow_runs.workflow_id = workflows.id
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(workflow_runs.logs::jsonb -> 'realtime_feedback_events', '[]'::jsonb)
      ) AS elem
      WHERE workflows.organization_id = :oid
        AND workflow_runs.created_at >= :since
        AND workflow_runs.created_at <= :until
        AND elem->>'type' = 'rtf-function-call-end'
        AND elem->'payload'->>'result' LIKE '{{%'
        AND (elem->'payload'->>'result')::jsonb ? 'status_code'
        AND NOT EXISTS (
          SELECT 1
          FROM analytics_http_tool_spans s0
          WHERE s0.workflow_run_id = workflow_runs.id
            AND s0.organization_id = workflows.organization_id
        )
      {mix_sql_extra}
    ) AS http_rows
    """


async def fetch_http_cache_rollups(
    session: AsyncSession,
    *,
    mix_params: dict[str, Any],
    mix_sql_extra: str,
) -> dict[str, int]:
    result = await session.execute(text(_http_cache_rollups_sql(mix_sql_extra)), mix_params)
    row = result.first()
    if not row:
        return {"http_tool_invocations": 0, "http_tool_cache_hits": 0}
    invocations = int(row[1] or 0)
    cache_hits = int(row[0] or 0)
    return {
        "http_tool_invocations": invocations,
        "http_tool_cache_hits": min(cache_hits, invocations),
    }
