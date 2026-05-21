"""Derive analytics call payloads from persisted workflow run rows (logs, contexts, cost)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

# Mirror pipecat RealtimeFeedbackType string values (avoid importing pipecat in analytics-only paths).
RTF_FUNCTION_CALL_START = "rtf-function-call-start"
RTF_FUNCTION_CALL_END = "rtf-function-call-end"
RTF_TTFB_METRIC = "rtf-ttfb-metric"

CALL_ID_PREFIX = "wr-"


def workflow_run_to_analytics_call_id(run_id: int) -> str:
    """Stable analytics id for a workflow run (list + detail)."""
    return f"{CALL_ID_PREFIX}{run_id}"


def parse_analytics_call_id(call_id: str) -> int | None:
    """Resolve path `call_id` to internal workflow run id."""
    if not call_id or not isinstance(call_id, str):
        return None
    s = call_id.strip()
    if s.startswith(CALL_ID_PREFIX):
        s = s[len(CALL_ID_PREFIX) :]
    try:
        return int(s)
    except ValueError:
        return None


def _parse_iso_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except ValueError:
        return None


def _parse_function_result_payload(result_str: str | None) -> dict[str, Any] | None:
    if not result_str:
        return None
    try:
        obj = json.loads(result_str)
        return obj if isinstance(obj, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _http_summary_from_tool_result(
    parsed: dict[str, Any],
) -> dict[str, Any] | None:
    """Build HttpToolSpanSummary-shaped dict when result looks like execute_http_request output."""
    if not isinstance(parsed, dict):
        return None
    if "status_code" not in parsed and parsed.get("status") not in (
        "success",
        "error",
    ):
        return None
    status_code = parsed.get("status_code")
    mapped = parsed.get("mapped_data")
    err = parsed.get("error")
    out: dict[str, Any] = {}
    if status_code is not None:
        out["request_status"] = int(status_code)
    if mapped is not None and isinstance(mapped, dict):
        out["mapped_data"] = mapped
    if parsed.get("cache_hit") is True:
        out["cache_hit"] = True
    if err:
        out["error_message"] = str(err)
    return out or None


def _tool_type_from_result(parsed: dict[str, Any] | None) -> str:
    if parsed and _http_summary_from_tool_result(parsed) is not None:
        return "http_api"
    return "function"


def extract_tool_spans_from_logs(logs: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Pair rtf-function-call-start/end events into ToolSpan-shaped dicts."""
    if not logs or not isinstance(logs, dict):
        return []
    events = logs.get("realtime_feedback_events") or []
    if not isinstance(events, list):
        return []

    starts: dict[str, dict[str, Any]] = {}
    spans: list[dict[str, Any]] = []

    for ev in events:
        if not isinstance(ev, dict):
            continue
        t = ev.get("type")
        payload = ev.get("payload") if isinstance(ev.get("payload"), dict) else {}
        tool_call_id = (payload or {}).get("tool_call_id") or ""
        fn = (payload or {}).get("function_name") or "unknown"

        if t == RTF_FUNCTION_CALL_START:
            starts[str(tool_call_id)] = {
                "function_name": fn,
                "started_at": ev.get("timestamp"),
            }
            continue
        if t != RTF_FUNCTION_CALL_END:
            continue

        start = starts.pop(str(tool_call_id), None)
        started_at = (start or {}).get("started_at") or ev.get("timestamp")
        ended_at = ev.get("timestamp")
        start_dt = _parse_iso_ts(started_at if isinstance(started_at, str) else None)
        end_dt = _parse_iso_ts(ended_at if isinstance(ended_at, str) else None)
        duration_ms = 0
        if start_dt and end_dt:
            duration_ms = max(
                0, int((end_dt - start_dt).total_seconds() * 1000)
            )

        parsed = _parse_function_result_payload(
            payload.get("result") if isinstance(payload.get("result"), str) else None
        )
        tool_type = _tool_type_from_result(parsed)
        http = _http_summary_from_tool_result(parsed) if tool_type == "http_api" else None

        span_id = str(tool_call_id) if tool_call_id else f"span-{len(spans)}"
        spans.append(
            {
                "span_id": span_id,
                "tool_name": fn,
                "tool_type": tool_type,
                "started_at": started_at
                if isinstance(started_at, str)
                else (start_dt.isoformat() if start_dt else ""),
                "duration_ms": duration_ms,
                "http": http,
            }
        )

    return spans


def distinct_tool_names_from_spans(spans: list[dict[str, Any]]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for s in spans:
        n = s.get("tool_name")
        if isinstance(n, str) and n and n not in seen:
            seen.add(n)
            names.append(n)
    return names


def build_call_metrics(
    spans: list[dict[str, Any]],
    logs: dict[str, Any] | None,
    _cost_info: dict[str, Any] | None,
) -> dict[str, Any]:
    events = (logs or {}).get("realtime_feedback_events") or []
    if not isinstance(events, list):
        events = []
    llm_rounds = sum(
        1
        for e in events
        if isinstance(e, dict)
        and e.get("type") == RTF_TTFB_METRIC
    )
    return {
        "llm_rounds": llm_rounds,
        "tool_invocation_count": len(spans),
        "stt_seconds": None,
        "tts_seconds": None,
    }


def gather_outcome_dict(gathered: dict[str, Any] | None) -> dict[str, Any]:
    """Surface customer-defined outcomes from gathered_context (convention)."""
    if not gathered or not isinstance(gathered, dict):
        return {}
    keys = (
        "outcome_key",
        "customer_outcome",
        "outcomes",
        "booking_status",
        "mapped_call_disposition",
    )
    out: dict[str, Any] = {}
    for k in keys:
        if k in gathered and gathered[k] is not None:
            out[k] = gathered[k]
    return out


def outcome_key_from_gathered(gathered: dict[str, Any] | None) -> str | None:
    if not gathered or not isinstance(gathered, dict):
        return None
    for k in ("outcome_key", "customer_outcome"):
        v = gathered.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def disposition_from_gathered(gathered: dict[str, Any] | None) -> str | None:
    if not gathered or not isinstance(gathered, dict):
        return None
    v = gathered.get("mapped_call_disposition")
    return str(v) if v is not None else None


def qa_summary_from_annotations(annotations: dict[str, Any] | None) -> dict[str, Any] | None:
    """Lightweight QM summary from QA node annotations (if present)."""
    if not annotations or not isinstance(annotations, dict):
        return None
    flags: list[str] = []
    tags = annotations.get("tags")
    if isinstance(tags, list):
        flags.extend(str(t) for t in tags if t)
    score = None
    for _node_key, node_result in (annotations.get("node_results") or {}).items():
        if not isinstance(node_result, dict):
            continue
        s = node_result.get("score")
        if isinstance(s, (int, float)):
            score = float(s)
            break
    if score is None and not flags:
        return None
    return {"score": score, "flags": flags, "reviewer_notes": None}
