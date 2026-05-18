"""Org-level quality rollups for GET /analytics/insights (CX, containment, tool health)."""

from __future__ import annotations

from collections import Counter
from typing import Any

from api.services.analytics.call_quality_report import build_call_quality_report

# Cap per-request quality computation to keep insights fast for large orgs.
QUALITY_ROLLUP_MAX_RUNS = 500


def _duration_ms_from_cost(cost_info: dict[str, Any] | None) -> int:
    if not cost_info or not isinstance(cost_info, dict):
        return 0
    dur_sec = cost_info.get("call_duration_seconds") or 0
    try:
        return max(0, int(round(float(dur_sec) * 1000)))
    except (TypeError, ValueError):
        return 0


def rollup_quality_insights(
    run_snapshots: list[dict[str, Any]],
    *,
    total_calls_in_range: int,
) -> dict[str, Any]:
    """
    Aggregate per-call quality reports into org-level summary.

    Each snapshot: ``logs``, ``gathered_context``, ``annotations``, ``cost_info`` (optional).
    """
    empty: dict[str, Any] = {
        "sampled_calls": 0,
        "sample_capped": False,
        "avg_cx_score": None,
        "containment_mix": [],
        "calls_with_qa": 0,
        "avg_qa_score": None,
        "avg_tool_success_rate": None,
        "tool_health": [],
    }
    if not run_snapshots:
        empty["sample_capped"] = total_calls_in_range > 0
        return empty

    containment: Counter[str] = Counter()
    cx_scores: list[int] = []
    qa_scores: list[float] = []
    tool_invocations: Counter[str] = Counter()
    tool_successes: Counter[str] = Counter()
    per_call_tool_rates: list[float] = []

    for snap in run_snapshots:
        logs = snap.get("logs") if isinstance(snap.get("logs"), dict) else {}
        gc = snap.get("gathered_context") if isinstance(snap.get("gathered_context"), dict) else {}
        ann = snap.get("annotations") if isinstance(snap.get("annotations"), dict) else {}
        duration_ms = snap.get("duration_ms")
        if duration_ms is None:
            duration_ms = _duration_ms_from_cost(
                snap.get("cost_info") if isinstance(snap.get("cost_info"), dict) else None
            )

        report = build_call_quality_report(
            logs=logs,
            gathered_context=gc,
            annotations=ann,
            duration_ms=int(duration_ms or 0),
        )
        containment[str(report.get("containment") or "unknown")] += 1
        cx = report.get("cx_score")
        if isinstance(cx, (int, float)):
            cx_scores.append(int(cx))
        qa = report.get("qa_score")
        if isinstance(qa, (int, float)):
            qa_scores.append(float(qa))
        tsr = report.get("tool_success_rate")
        if isinstance(tsr, (int, float)):
            per_call_tool_rates.append(float(tsr))
        for row in report.get("tool_functions") or []:
            if not isinstance(row, dict):
                continue
            name = str(row.get("function_name") or "unknown")
            inv = int(row.get("invocation_count") or 0)
            ok = int(row.get("success_count") or 0)
            tool_invocations[name] += inv
            tool_successes[name] += ok

    containment_mix = [
        {"containment": k, "count": v}
        for k, v in sorted(containment.items(), key=lambda x: (-x[1], x[0]))
    ]

    tool_health: list[dict[str, Any]] = []
    for name, inv in tool_invocations.items():
        if inv <= 0:
            continue
        ok = tool_successes.get(name, 0)
        rate = round(ok / inv, 2)
        tool_health.append(
            {
                "function_name": name,
                "invocation_count": inv,
                "success_count": ok,
                "success_rate": rate,
                "failed_invocations": inv - ok,
            }
        )
    # Lowest success rate first; tie-break by volume.
    tool_health.sort(key=lambda r: (r["success_rate"], -r["invocation_count"]))

    avg_tool: float | None = None
    if per_call_tool_rates:
        avg_tool = round(sum(per_call_tool_rates) / len(per_call_tool_rates), 2)
    elif tool_invocations:
        total_inv = sum(tool_invocations.values())
        total_ok = sum(tool_successes.values())
        if total_inv:
            avg_tool = round(total_ok / total_inv, 2)

    return {
        "sampled_calls": len(run_snapshots),
        "sample_capped": total_calls_in_range > len(run_snapshots),
        "avg_cx_score": int(round(sum(cx_scores) / len(cx_scores))) if cx_scores else None,
        "containment_mix": containment_mix,
        "calls_with_qa": len(qa_scores),
        "avg_qa_score": round(sum(qa_scores) / len(qa_scores), 2) if qa_scores else None,
        "avg_tool_success_rate": avg_tool,
        "tool_health": tool_health[:15],
    }
