"""Shared startCall → agentNode → endCall shell for import adapters (MK-01-IMPORT-OPTIONS)."""

from __future__ import annotations

from typing import Any


def minimal_packaged_voice_graph(
    *,
    agent_prompt_body: str,
    id_prefix: str = "n-import",
    agent_name: str = "Imported agent",
) -> dict[str, Any]:
    start_id = f"{id_prefix}-start"
    agent_id = f"{id_prefix}-agent"
    end_id = f"{id_prefix}-end"
    return {
        "nodes": [
            {
                "id": start_id,
                "type": "startCall",
                "position": {"x": 0, "y": 0},
                "data": {
                    "name": "Start",
                    "prompt": "Greet the caller briefly and route to the agent.",
                    "is_start": True,
                    "allow_interrupt": False,
                    "add_global_prompt": False,
                },
            },
            {
                "id": agent_id,
                "type": "agentNode",
                "position": {"x": 0, "y": 140},
                "data": {
                    "name": agent_name,
                    "prompt": agent_prompt_body,
                    "allow_interrupt": True,
                    "add_global_prompt": False,
                },
            },
            {
                "id": end_id,
                "type": "endCall",
                "position": {"x": 0, "y": 280},
                "data": {
                    "name": "End",
                    "prompt": "Close politely when the task is done.",
                    "is_end": True,
                    "allow_interrupt": False,
                    "add_global_prompt": False,
                },
            },
        ],
        "edges": [
            {
                "id": f"e-{id_prefix}-1",
                "source": start_id,
                "target": agent_id,
                "data": {"label": "Continue", "condition": "After start"},
            },
            {
                "id": f"e-{id_prefix}-2",
                "source": agent_id,
                "target": end_id,
                "data": {"label": "End", "condition": "When done"},
            },
        ],
    }
