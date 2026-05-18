"""Parse realtime_feedback_events into operator-friendly live trace + tool/API detail."""

from __future__ import annotations

import json
from typing import Any

from api.services.analytics.call_intel import (
    RTF_FUNCTION_CALL_END,
    RTF_FUNCTION_CALL_START,
    _http_summary_from_tool_result,
    _parse_function_result_payload,
    _parse_iso_ts,

)

RTF_USER_TRANSCRIPTION = "rtf-user-transcription"
RTF_BOT_TEXT = "rtf-bot-text"
RTF_TTFB_METRIC = "rtf-ttfb-metric"
RTF_PIPELINE_ERROR = "rtf-pipeline-error"
RTF_NODE_TRANSITION = "rtf-node-transition"


def _events_list(logs: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not logs or not isinstance(logs, dict):
        return []
    raw = logs.get("realtime_feedback_events") or []
    return [e for e in raw if isinstance(e, dict)]


def build_live_trace_timeline(logs: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Chronological trace entries for UI timeline (conversation, tool, llm, system)."""
    entries: list[dict[str, Any]] = []
    for ev in _events_list(logs):
        t = ev.get("type")
        payload = ev.get("payload") if isinstance(ev.get("payload"), dict) else {}
        ts = ev.get("timestamp") or ""
        turn = ev.get("turn")

        if t == RTF_USER_TRANSCRIPTION and payload.get("final"):
            text = (payload.get("text") or "").strip()
            if text:
                entries.append(
                    {
                        "kind": "conversation",
                        "role": "user",
                        "summary": text[:240],
                        "timestamp": ts,
                        "turn": turn,
                    }
                )
        elif t == RTF_BOT_TEXT:
            text = (payload.get("text") or "").strip()
            if text:
                entries.append(
                    {
                        "kind": "conversation",
                        "role": "assistant",
                        "summary": text[:240],
                        "timestamp": ts,
                        "turn": turn,
                    }
                )
        elif t == RTF_TTFB_METRIC:
            sec = payload.get("ttfb_seconds")
            entries.append(
                {
                    "kind": "llm",
                    "summary": "Model inference",
                    "timestamp": ts,
                    "turn": turn,
                    "ttfb_ms": int(float(sec) * 1000) if sec is not None else None,
                    "processor": payload.get("processor"),
                    "model": payload.get("model"),
                }
            )
        elif t == RTF_FUNCTION_CALL_END:
            fn = payload.get("function_name") or "tool"
            parsed = _parse_function_result_payload(
                payload.get("result") if isinstance(payload.get("result"), str) else None
            )
            http = _http_summary_from_tool_result(parsed) if parsed else None
            ok = True
            if http and http.get("request_status") is not None:
                ok = 200 <= int(http["request_status"]) < 300
            elif parsed and parsed.get("status") == "error":
                ok = False
            entries.append(
                {
                    "kind": "tool",
                    "summary": fn,
                    "timestamp": ts,
                    "turn": turn,
                    "tool_name": fn,
                    "success": ok,
                    "http_status": http.get("request_status") if http else None,
                }
            )
        elif t == RTF_NODE_TRANSITION:
            entries.append(
                {
                    "kind": "system",
                    "summary": f"Node → {payload.get('node_name') or '?'}",
                    "timestamp": ts,
                    "turn": turn,
                }
            )
        elif t == RTF_PIPELINE_ERROR:
            entries.append(
                {
                    "kind": "error",
                    "summary": (payload.get("error") or "Pipeline error")[:200],
                    "timestamp": ts,
                    "turn": turn,
                    "fatal": bool(payload.get("fatal")),
                }
            )

    entries.sort(key=lambda e: (e.get("timestamp") or ""))
    return entries


def build_tool_invocation_details(logs: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Per-tool-call detail including HTTP send/receive when available."""
    events = _events_list(logs)
    starts: dict[str, dict[str, Any]] = {}
    details: list[dict[str, Any]] = []

    for ev in events:
        t = ev.get("type")
        payload = ev.get("payload") if isinstance(ev.get("payload"), dict) else {}
        tc_id = str(payload.get("tool_call_id") or "")

        if t == RTF_FUNCTION_CALL_START:
            starts[tc_id] = {
                "tool_call_id": tc_id,
                "tool_name": payload.get("function_name") or "unknown",
                "started_at": ev.get("timestamp"),
            }
            continue
        if t != RTF_FUNCTION_CALL_END:
            continue

        start = starts.pop(tc_id, {})
        parsed = _parse_function_result_payload(
            payload.get("result") if isinstance(payload.get("result"), str) else None
        )
        http_summary = _http_summary_from_tool_result(parsed) if parsed else None
        started_at = start.get("started_at") or ev.get("timestamp")
        ended_at = ev.get("timestamp")
        start_dt = _parse_iso_ts(started_at if isinstance(started_at, str) else None)
        end_dt = _parse_iso_ts(ended_at if isinstance(ended_at, str) else None)
        duration_ms = 0
        if start_dt and end_dt:
            duration_ms = max(0, int((end_dt - start_dt).total_seconds() * 1000))

        receive: dict[str, Any] | None = None
        if parsed:
            receive = {
                "status": parsed.get("status"),
                "status_code": parsed.get("status_code"),
                "mapped_data": parsed.get("mapped_data"),
                "error": parsed.get("error"),
                "data_preview": _preview_json(parsed.get("data")),
            }

        success = True
        if http_summary and http_summary.get("request_status") is not None:
            success = 200 <= int(http_summary["request_status"]) < 300
        elif parsed and parsed.get("status") == "error":
            success = False

        details.append(
            {
                "tool_call_id": tc_id or f"span-{len(details)}",
                "tool_name": start.get("tool_name") or payload.get("function_name"),
                "started_at": started_at,
                "ended_at": ended_at,
                "duration_ms": duration_ms,
                "success": success,
                "http": http_summary,
                "receive": receive,
            }
        )

    return details


def _preview_json(val: Any, max_len: int = 400) -> str | None:
    if val is None:
        return None
    try:
        s = json.dumps(val, default=str)
    except (TypeError, ValueError):
        s = str(val)
    return s if len(s) <= max_len else s[: max_len - 3] + "..."


def build_llm_inference_insights(logs: dict[str, Any] | None) -> dict[str, Any]:
    events = _events_list(logs)
    ttfb_ms: list[int] = []
    models: set[str] = set()
    for ev in events:
        if ev.get("type") != RTF_TTFB_METRIC:
            continue
        payload = ev.get("payload") if isinstance(ev.get("payload"), dict) else {}
        sec = payload.get("ttfb_seconds")
        if sec is not None:
            ttfb_ms.append(int(float(sec) * 1000))
        m = payload.get("model")
        if m:
            models.add(str(m))
    return {
        "inference_count": len(ttfb_ms),
        "avg_ttfb_ms": int(sum(ttfb_ms) / len(ttfb_ms)) if ttfb_ms else None,
        "max_ttfb_ms": max(ttfb_ms) if ttfb_ms else None,
        "models": sorted(models),
    }


def build_tool_function_report(logs: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Aggregate per function_name: count, success rate, avg duration."""
    details = build_tool_invocation_details(logs)
    by_name: dict[str, list[dict[str, Any]]] = {}
    for d in details:
        name = str(d.get("tool_name") or "unknown")
        by_name.setdefault(name, []).append(d)

    report: list[dict[str, Any]] = []
    for name, invocations in sorted(by_name.items()):
        ok = sum(1 for i in invocations if i.get("success"))
        durations = [i["duration_ms"] for i in invocations if isinstance(i.get("duration_ms"), int)]
        report.append(
            {
                "function_name": name,
                "invocation_count": len(invocations),
                "success_count": ok,
                "success_rate": round(ok / len(invocations), 2) if invocations else 0,
                "avg_duration_ms": int(sum(durations) / len(durations)) if durations else None,
            }
        )
    return report
