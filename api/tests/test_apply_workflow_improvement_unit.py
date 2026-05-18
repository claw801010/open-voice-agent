"""Append call-review text to agent prompt."""

from api.services.analytics.apply_workflow_improvement import (
    append_improvement_to_workflow_definition,
)


def test_appends_to_agent_node():
    definition = {
        "nodes": [
            {"id": "1", "type": "startCall", "data": {"prompt": "start"}},
            {"id": "2", "type": "agentNode", "data": {"prompt": "Be helpful."}},
        ],
        "edges": [],
    }
    new_def, node_id = append_improvement_to_workflow_definition(
        definition, "Always confirm booking before hangup."
    )
    assert node_id == "2"
    assert "Call review improvements" in new_def["nodes"][1]["data"]["prompt"]
    assert "confirm booking" in new_def["nodes"][1]["data"]["prompt"]
