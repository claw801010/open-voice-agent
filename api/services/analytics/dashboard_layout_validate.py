"""Validate MK-01 analytics custom dashboard layout JSON (matches ui/src/lib/analyticsDashboardLayout.ts)."""

from __future__ import annotations

from typing import Any

ALLOWED_WIDGET_TYPES = frozenset(
    {
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "dive_deeper",
        "vertical_shortcuts",
        "revenue_motions",
    }
)


def normalize_analytics_dashboard_layout(raw: Any) -> dict[str, Any]:
    """
    Accepts a dict with ``v`` == 1 and ``widgets`` array; returns a normalized copy.

    Raises ``ValueError`` with a short message if invalid.
    """
    if not isinstance(raw, dict):
        raise ValueError("layout must be an object")
    if raw.get("v") != 1:
        raise ValueError("layout.v must be 1")
    widgets = raw.get("widgets")
    if not isinstance(widgets, list) or len(widgets) == 0:
        raise ValueError("layout.widgets must be a non-empty array")
    out: list[dict[str, str]] = []
    for w in widgets:
        if not isinstance(w, dict):
            continue
        wid = str(w.get("id", "")).strip()
        typ = w.get("type")
        if not wid or typ not in ALLOWED_WIDGET_TYPES:
            continue
        out.append({"id": wid, "type": str(typ)})
    if not out:
        raise ValueError("layout.widgets must contain at least one valid widget")
    return {"v": 1, "widgets": out}
