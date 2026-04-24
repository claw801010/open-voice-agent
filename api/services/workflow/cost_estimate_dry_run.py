"""WE-01-HEADER: heuristic token/cost dry-run without a completed workflow run."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from api.schemas.user_configuration import UserConfiguration
from api.services.configuration.resolve import resolve_effective_config
from api.services.pricing.cost_calculator import cost_calculator
from api.services.workflow.dto import NodeType, ReactFlowDTO

CHARS_PER_TOKEN_EST = 4
DEFAULT_CALL_SECONDS = 180
MIN_TURNS = 4
MAX_TURNS = 32


class WorkflowCostDryRunResult(BaseModel):
    estimated_total_cost_usd: float
    estimated_dograh_tokens: float = Field(
        description="Same scale as completed runs: ~USD total × 100 (cents as tokens)."
    )
    pricing_model_label: str
    assumptions: list[str]
    main_agent_nodes: int
    subflow_agent_nodes_total: int
    estimated_turns: int
    reference_call_duration_seconds: int


def _prompt_chars_in_dto(dto: ReactFlowDTO) -> tuple[int, int]:
    agents = 0
    chars = 0
    for n in dto.nodes:
        if n.type == NodeType.agentNode:
            agents += 1
        p = n.data.prompt or ""
        chars += len(p)
        if n.data.greeting:
            chars += len(n.data.greeting)
    return agents, chars


def estimate_workflow_cost_dry_run(
    *,
    workflow_json: dict[str, Any],
    workflow_configurations: dict[str, Any] | None,
    user_config: UserConfiguration,
) -> WorkflowCostDryRunResult:
    dto = ReactFlowDTO.model_validate(workflow_json)
    overrides = (workflow_configurations or {}).get("model_overrides")
    effective = resolve_effective_config(user_config, overrides)

    main_agents, main_chars = _prompt_chars_in_dto(dto)
    sub_agents_total = 0
    if dto.subflows:
        for blob in dto.subflows.values():
            if not isinstance(blob, dict):
                continue
            nodes = blob.get("nodes") or []
            if not nodes:
                continue
            inner = {k: v for k, v in blob.items() if k != "subflows"}
            inner.setdefault("nodes", nodes)
            inner.setdefault("edges", blob.get("edges") or [])
            sub_dto = ReactFlowDTO.model_validate(inner)
            a, _c = _prompt_chars_in_dto(sub_dto)
            sub_agents_total += a

    effective_agent_weight = float(main_agents) + 0.5 * float(sub_agents_total)
    estimated_turns = int(
        max(MIN_TURNS, min(MAX_TURNS, effective_agent_weight * 2.0 + 3.0))
    )

    avg_chars_per_agent = max(main_chars // max(main_agents, 1), 200)
    prompt_tokens_per_turn = max(
        800, min(12000, avg_chars_per_agent // CHARS_PER_TOKEN_EST + 1200)
    )
    completion_tokens_per_turn = 450

    total_prompt = prompt_tokens_per_turn * estimated_turns
    total_completion = completion_tokens_per_turn * estimated_turns

    stt_seconds = DEFAULT_CALL_SECONDS * 0.45
    tts_chars = max(200, min(8000, (avg_chars_per_agent // 5) * estimated_turns))

    llm_model = "gpt-4.1"
    stt_model = "nova-2-phonecall"
    tts_model = "aura-2-helena-en"

    if effective.is_realtime and effective.realtime:
        llm_model = effective.realtime.model
        assumptions = [
            f"Realtime speech-to-speech model `{llm_model}`; composite LLM token proxy (no separate STT/TTS lines).",
            f"Heuristic: ~{estimated_turns} modeled turns over ~{DEFAULT_CALL_SECONDS // 60} min reference window.",
            "Not a guarantee; actual usage varies with caller behavior and tool calls.",
        ]
        usage_info = {
            "llm": {
                f"dry_run|||{llm_model}": {
                    "prompt_tokens": total_prompt,
                    "completion_tokens": total_completion + 500 * estimated_turns,
                    "total_tokens": total_prompt + total_completion,
                }
            }
        }
    else:
        if effective.llm:
            llm_model = effective.llm.model
        if effective.stt:
            stt_model = effective.stt.model
        if effective.tts:
            tts_model = effective.tts.model
        assumptions = [
            f"Reference call duration ~{DEFAULT_CALL_SECONDS // 60} min; STT ~{stt_seconds:.0f}s; TTS ~{tts_chars} chars.",
            f"Heuristic: ~{estimated_turns} LLM turns from {main_agents} main agent node(s) and subgraph weight.",
            "Not a guarantee; actual usage varies with caller behavior, retries, and tools.",
        ]
        usage_info = {
            "llm": {
                f"dry_run|||{llm_model}": {
                    "prompt_tokens": total_prompt,
                    "completion_tokens": total_completion,
                    "total_tokens": total_prompt + total_completion,
                }
            },
            "stt": {f"dry_run|||{stt_model}": stt_seconds},
            "tts": {f"dry_run|||{tts_model}": tts_chars},
        }

    breakdown = cost_calculator.calculate_total_cost(usage_info)
    total_usd = float(breakdown["total"])
    dograh = round(total_usd * 100, 2)

    label_parts: list[str] = []
    if effective.is_realtime and effective.realtime:
        label_parts.append(f"realtime:{effective.realtime.provider}/{llm_model}")
    else:
        if effective.llm:
            label_parts.append(f"llm:{effective.llm.provider}/{llm_model}")
        if effective.stt:
            label_parts.append(f"stt:{effective.stt.provider}/{stt_model}")
        if effective.tts:
            label_parts.append(f"tts:{effective.tts.provider}/{tts_model}")

    return WorkflowCostDryRunResult(
        estimated_total_cost_usd=round(total_usd, 6),
        estimated_dograh_tokens=dograh,
        pricing_model_label=" · ".join(label_parts) if label_parts else "registry defaults",
        assumptions=assumptions,
        main_agent_nodes=main_agents,
        subflow_agent_nodes_total=sub_agents_total,
        estimated_turns=estimated_turns,
        reference_call_duration_seconds=DEFAULT_CALL_SECONDS,
    )
