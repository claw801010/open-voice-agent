"""Append call-review improvements to workflow agent prompt."""

from __future__ import annotations

import copy
from typing import Any

from api.services.workflow.dto import NodeType

IMPROVEMENT_HEADER = "\n\n## Call review improvements\n"


def append_improvement_to_workflow_definition(
    workflow_definition: dict[str, Any],
    improvement: str,
) -> tuple[dict[str, Any], str | None]:
    """Append improvement text to the first agent node prompt. Returns (new_def, node_id)."""
    definition = copy.deepcopy(workflow_definition)
    nodes = definition.get("nodes") or []
    if not isinstance(nodes, list):
        return definition, None

    snippet = improvement.strip()
    if not snippet:
        return definition, None

    block = f"{IMPROVEMENT_HEADER}{snippet}\n"

    for node in nodes:
        if not isinstance(node, dict):
            continue
        if node.get("type") != NodeType.agentNode.value:
            continue
        data = node.setdefault("data", {})
        if not isinstance(data, dict):
            continue
        prompt = (data.get("prompt") or "").rstrip()
        if snippet in prompt:
            return definition, str(node.get("id"))
        data["prompt"] = prompt + block
        return definition, str(node.get("id"))

    # Fallback: start node prompt
    for node in nodes:
        if not isinstance(node, dict):
            continue
        if node.get("type") != NodeType.startNode.value:
            continue
        data = node.setdefault("data", {})
        if not isinstance(data, dict):
            continue
        prompt = (data.get("prompt") or "").rstrip()
        data["prompt"] = prompt + block
        return definition, str(node.get("id"))

    return definition, None
