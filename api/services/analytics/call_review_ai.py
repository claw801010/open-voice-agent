"""Generate AI call review from transcript + outcomes (MK-01)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from loguru import logger

from api.services.analytics.call_transcript import transcript_from_logs
from api.services.gen_ai.json_parser import parse_llm_json
from api.services.pipecat.service_factory import create_llm_service_from_provider
from api.services.workflow.qa.llm_config import resolve_user_llm_config
from pipecat.processors.aggregators.llm_context import LLMContext

CALL_REVIEW_SYSTEM_PROMPT = """You are a voice-AI QA coach. Given a call transcript, structured outcomes, and HTTP tool results,
return a single JSON object (no markdown fences) with this shape:
{
  "summary": "2-4 sentences on what happened",
  "outcome_analysis": "1-3 sentences on whether business outcome was achieved",
  "suggested_outcome": "short label e.g. booked, escalated, unresolved",
  "recommendations": [
    {
      "title": "short title",
      "detail": "why this helps",
      "prompt_snippet": "one imperative sentence to add to the agent system prompt"
    }
  ]
}
Provide 2-5 actionable recommendations. Focus on clarity, tool usage, compliance, and booking/confirmation flows when relevant."""


async def _run_llm_json(llm, user_content: str) -> dict[str, Any] | None:
    context = LLMContext()
    context.set_messages([{"role": "user", "content": user_content}])
    raw = await llm.run_inference(context, system_instruction=CALL_REVIEW_SYSTEM_PROMPT)
    if not raw:
        return None
    return parse_llm_json(raw)


def heuristic_review(
    *,
    call_id: str,
    transcript: str,
    outcomes: dict[str, Any],
    tool_spans: list[dict[str, Any]],
) -> dict[str, Any]:
    lines = [ln.strip() for ln in transcript.splitlines() if ln.strip()]
    summary = (
        f"Call {call_id} with {len(lines)} transcript lines and {len(tool_spans)} tool invocation(s)."
        if lines
        else f"Call {call_id} has no transcript events; review outcomes and tool spans only."
    )
    outcome_bits = []
    for k in ("outcome_key", "customer_outcome", "mapped_call_disposition"):
        v = outcomes.get(k)
        if v:
            outcome_bits.append(f"{k}={v}")
    outcome_analysis = (
        "; ".join(outcome_bits)
        if outcome_bits
        else "No outcome_key or customer_outcome recorded — add extraction or HTTP mapping."
    )
    recs = [
        {
            "title": "Confirm outcome in prompt",
            "detail": "Ask the agent to restate booking or resolution before ending the call.",
            "prompt_snippet": "Before ending, confirm the outcome (booked, escalated, or callback) in one sentence.",
        },
    ]
    if not tool_spans:
        recs.append(
            {
                "title": "Wire HTTP proof tools",
                "detail": "No tool spans logged — attach book_slot or vertical HTTP tools.",
                "prompt_snippet": "When scheduling is requested, call the book_slot HTTP tool before confirming success.",
            }
        )
    return {
        "summary": summary,
        "outcome_analysis": outcome_analysis,
        "suggested_outcome": str(outcomes.get("outcome_key") or outcomes.get("customer_outcome") or ""),
        "recommendations": recs,
        "source": "heuristic",
        "model": None,
    }


async def generate_call_ai_review(
    *,
    call_id: str,
    workflow_run,
    detail: dict[str, Any],
    force_refresh: bool = False,
) -> dict[str, Any]:
    ann = workflow_run.annotations or {}
    if not force_refresh:
        cached = ann.get("analytics_ai_review")
        if isinstance(cached, dict) and cached.get("summary"):
            return cached

    transcript = transcript_from_logs(workflow_run.logs)
    outcomes = detail.get("outcomes") or {}
    tool_spans = detail.get("tool_spans") or []

    user_blob = json.dumps(
        {
            "call_id": call_id,
            "workflow_id": detail.get("workflow_id"),
            "catalog_slug": detail.get("workflow_slug"),
            "duration_ms": detail.get("duration_ms"),
            "outcomes": outcomes,
            "tool_spans": [
                {
                    "tool_name": s.get("tool_name"),
                    "http": s.get("http"),
                }
                for s in tool_spans
                if isinstance(s, dict)
            ],
            "transcript": transcript or "(empty)",
        },
        indent=2,
        default=str,
    )[:14000]

    generated_at = datetime.now(timezone.utc).isoformat()
    try:
        provider, model, api_key, kwargs = await resolve_user_llm_config(workflow_run)
        if not api_key:
            raise ValueError("No LLM API key configured")
        llm = create_llm_service_from_provider(provider, api_key, model, **kwargs)
        parsed = await _run_llm_json(llm, user_blob)
        if not parsed:
            raise ValueError("Empty LLM response")
        out = {
            "call_id": call_id,
            "summary": str(parsed.get("summary") or "").strip(),
            "outcome_analysis": str(parsed.get("outcome_analysis") or "").strip(),
            "suggested_outcome": (parsed.get("suggested_outcome") or None),
            "recommendations": parsed.get("recommendations") or [],
            "transcript_excerpt": transcript[:2000] if transcript else None,
            "generated_at": generated_at,
            "model": model,
            "source": "llm",
        }
    except Exception as e:
        logger.warning(f"Call AI review LLM failed for {call_id}: {e}")
        out = heuristic_review(
            call_id=call_id,
            transcript=transcript,
            outcomes=outcomes,
            tool_spans=tool_spans,
        )
        out["call_id"] = call_id
        out["transcript_excerpt"] = transcript[:2000] if transcript else None
        out["generated_at"] = generated_at

    return out
