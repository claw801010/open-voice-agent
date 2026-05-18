"""CSV export for analytics call list rows (columns aligned with UI client export)."""

import csv
import io
from typing import Any

from api.services.analytics.analytics_redact import redact_csv_cell


def analytics_call_rows_to_csv_bytes(
    items: list[dict[str, Any]], *, redact_cells: bool = True
) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "call_id",
            "workflow_id",
            "workflow_slug",
            "catalog_variant_id",
            "started_at",
            "duration_ms",
            "disposition",
            "outcome_key",
            "tool_names",
            "cx_score",
            "containment",
            "qa_score",
            "scorecard_pass_rate",
        ]
    )
    def cell(v: Any) -> str:
        if redact_cells:
            return redact_csv_cell(v)
        if v is None:
            return ""
        return str(v)

    for it in items:
        names = it.get("tool_names") or []
        if isinstance(names, list):
            tool_cell = "; ".join(cell(x) for x in names)
        else:
            tool_cell = cell(names)
        writer.writerow(
            [
                cell(it.get("call_id", "")),
                cell(it.get("workflow_id", "")),
                cell(it.get("workflow_slug") or ""),
                cell(it.get("catalog_variant_id") or ""),
                cell(it.get("started_at", "")),
                cell(it.get("duration_ms", "")),
                cell(it.get("disposition") or ""),
                cell(it.get("outcome_key") or ""),
                tool_cell,
                cell(it.get("cx_score", "")),
                cell(it.get("containment") or ""),
                cell(it.get("qa_score", "")),
                cell(it.get("scorecard_pass_rate", "")),
            ]
        )
    return ("\ufeff" + buf.getvalue()).encode("utf-8")
