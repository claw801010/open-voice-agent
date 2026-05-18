"""Post-call quality report: containment, CX, outcomes, tool ratings."""

from __future__ import annotations

from typing import Any

from api.services.analytics.call_intel import (
    gather_outcome_dict,
    outcome_key_from_gathered,
    qa_summary_from_annotations,
)
from api.services.analytics.call_intel import extract_tool_spans_from_logs
from api.services.analytics.call_live_trace import (
    RTF_PIPELINE_ERROR,
    _events_list,
    build_llm_inference_insights,
    build_tool_function_report,
)


def _containment_label(
    outcomes: dict[str, Any],
    gathered: dict[str, Any] | None,
    errors: list[dict[str, Any]],
) -> str:
    fatal = any(e.get("fatal") for e in errors if isinstance(e, dict))
    if fatal:
        return "escalated"
    text = " ".join(
        str(v).lower()
        for v in (
            outcomes.get("outcome_key"),
            outcomes.get("customer_outcome"),
            outcomes.get("mapped_call_disposition"),
        )
        if v
    )
    if any(w in text for w in ("escalat", "transfer", "human", "supervisor")):
        return "escalated"
    if outcome_key_from_gathered(gathered) or outcomes.get("customer_outcome"):
        return "contained"
    if errors:
        return "partial"
    return "unknown"


def build_call_quality_report(
    *,
    logs: dict[str, Any] | None,
    gathered_context: dict[str, Any] | None,
    annotations: dict[str, Any] | None,
    duration_ms: int,
) -> dict[str, Any]:
    events = _events_list(logs)
    outcomes = gather_outcome_dict(gathered_context)
    qa = qa_summary_from_annotations(annotations) or {}
    tool_report = build_tool_function_report(logs)
    llm = build_llm_inference_insights(logs)
    spans = extract_tool_spans_from_logs(logs)

    errors = [e for e in events if e.get("type") == RTF_PIPELINE_ERROR]
    containment = _containment_label(outcomes, gathered_context, errors)

    # CX score 0–100 (heuristic when QA score absent)
    qa_score = qa.get("score")
    if isinstance(qa_score, (int, float)):
        cx_score = int(min(100, max(0, float(qa_score) * (100 / 5 if qa_score <= 5 else 1))))
    else:
        cx_score = 50
        if containment == "contained":
            cx_score += 25
        elif containment == "partial":
            cx_score += 10
        if not errors:
            cx_score += 15
        if llm.get("avg_ttfb_ms") is not None and llm["avg_ttfb_ms"] < 2000:
            cx_score += 10
        if tool_report:
            avg_sr = sum(t["success_rate"] for t in tool_report) / len(tool_report)
            cx_score += int(avg_sr * 10)
        cx_score = min(100, cx_score)

    total_tools = sum(t["invocation_count"] for t in tool_report)
    ok_tools = sum(t["success_count"] for t in tool_report)

    return {
        "containment": containment,
        "cx_score": cx_score,
        "qa_score": qa_score,
        "qa_flags": qa.get("flags") or [],
        "outcome_key": outcome_key_from_gathered(gathered_context),
        "outcomes": outcomes,
        "tool_invocation_count": len(spans),
        "tool_success_rate": round(ok_tools / total_tools, 2) if total_tools else None,
        "llm_inference": llm,
        "tool_functions": tool_report,
        "error_count": len(errors),
        "duration_ms": duration_ms,
    }
