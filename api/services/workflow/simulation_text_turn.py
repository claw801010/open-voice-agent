"""Text-only simulation for editor WE-01-TEST — draft graph + user LLM (no PSTN / no WebRTC)."""

from __future__ import annotations

from collections import deque
from typing import Any

from fastapi import HTTPException
from loguru import logger
from pydantic import BaseModel, Field, ValidationError as PydanticValidationError
from pydantic import field_validator

from api.db import db_client
from api.services.pipecat.service_factory import create_llm_service
from api.services.workflow.dto import NodeType, ReactFlowDTO
from api.services.workflow.simulation_user_persona import apply_user_persona
from api.services.workflow.pipecat_engine_context_composer import (
    compose_system_prompt_for_node,
)
from api.services.workflow.workflow import Node, WorkflowGraph
from api.utils.template_renderer import render_template
from pipecat.processors.aggregators.llm_context import LLMContext


class SimulationTextTurnRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_history: list[dict[str, str]] = Field(default_factory=list)
    user_persona: str | None = Field(
        default=None,
        max_length=2000,
        description=(
            "Optional role-play hint for user messages (e.g. impatient shopper). "
            "Prepended to each user turn for the agent LLM."
        ),
    )

    @field_validator("user_persona", mode="before")
    @classmethod
    def empty_persona_to_none(cls, v: object) -> str | None:
        if v is None:
            return None
        if not isinstance(v, str):
            return None
        s = v.strip()
        return s if s else None

    @field_validator("conversation_history")
    @classmethod
    def cap_history(cls, v: list[dict[str, str]]) -> list[dict[str, str]]:
        return v[-20:]


class SimulationTextTurnResponse(BaseModel):
    reply: str


def _first_agent_after_start(graph: WorkflowGraph) -> Node | None:
    start = graph.nodes[graph.start_node_id]
    queue: deque[Node] = deque([start])
    seen: set[str] = {start.id}
    while queue:
        node = queue.popleft()
        if node.node_type == NodeType.agentNode:
            return node
        for edge in node.out_edges:
            tid = edge.target
            if tid not in seen:
                seen.add(tid)
                queue.append(graph.nodes[tid])
    return None


def _workflow_uses_recording_placeholders(graph: WorkflowGraph) -> bool:
    for n in graph.nodes.values():
        if n.prompt and "RECORDING_ID:" in n.prompt:
            return True
    return False


async def _run_llm_inference(llm, messages: list[dict], system_prompt: str) -> str | None:
    context = LLMContext()
    context.set_messages(messages)
    return await llm.run_inference(context, system_instruction=system_prompt)


async def run_simulation_text_turn(
    *,
    workflow_id: int,
    user_id: int,
    organization_id: int,
    body: SimulationTextTurnRequest,
) -> SimulationTextTurnResponse:
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=organization_id
    )
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    draft = await db_client.get_draft_version(workflow_id)
    if draft and draft.workflow_json:
        workflow_definition = draft.workflow_json
    elif workflow.released_definition and workflow.released_definition.workflow_json:
        workflow_definition = workflow.released_definition.workflow_json
    else:
        raise HTTPException(
            status_code=400,
            detail="No workflow graph found — save the workflow in the editor first.",
        )

    try:
        dto = ReactFlowDTO.model_validate(workflow_definition)
        wf_graph = WorkflowGraph(dto)
    except (PydanticValidationError, ValueError) as e:
        logger.warning(f"Simulation text: invalid workflow graph: {e}")
        raise HTTPException(
            status_code=422,
            detail="Workflow graph is invalid — fix validation in the editor first.",
        ) from e

    agent_node = _first_agent_after_start(wf_graph)
    if agent_node is None:
        raise HTTPException(
            status_code=400,
            detail="No Agent node reachable from Start — connect an Agent step to your flow.",
        )

    template_context: dict[str, Any] = dict(workflow.template_context_variables or {})

    def format_prompt(prompt: str) -> str:
        if not prompt:
            return ""
        rendered = render_template(prompt, template_context)
        return rendered if isinstance(rendered, str) else str(rendered)

    has_rec = _workflow_uses_recording_placeholders(wf_graph)
    system_prompt = compose_system_prompt_for_node(
        node=agent_node,
        workflow=wf_graph,
        format_prompt=format_prompt,
        has_recordings=has_rec,
    )

    user_configuration = await db_client.get_user_configurations(user_id)
    if user_configuration.llm is None:
        raise HTTPException(
            status_code=400,
            detail="Configure an LLM in Settings before using text simulation.",
        )

    try:
        llm = create_llm_service(user_configuration)
    except Exception as e:
        logger.warning(f"Simulation text: could not build LLM service: {e}")
        raise HTTPException(
            status_code=400,
            detail="Could not initialize LLM from your user settings.",
        ) from e

    persona = body.user_persona

    history: list[dict] = []
    for turn in body.conversation_history:
        role = turn.get("role", "").strip()
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        if role not in ("user", "assistant"):
            continue
        out_content = (
            apply_user_persona(persona, content) if role == "user" else content
        )
        history.append({"role": role, "content": out_content[:8000]})

    user_message = apply_user_persona(persona, body.message.strip())
    messages = history + [{"role": "user", "content": user_message}]

    try:
        reply = await _run_llm_inference(llm, messages, system_prompt)
    except Exception as e:
        logger.exception("Simulation text turn failed")
        raise HTTPException(
            status_code=502,
            detail=f"LLM request failed: {e!s}"[:800],
        ) from e

    if not reply or not str(reply).strip():
        return SimulationTextTurnResponse(reply="(No response)")

    return SimulationTextTurnResponse(reply=str(reply).strip())
