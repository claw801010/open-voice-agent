import json

import pytest

from api.services.workflow.dto import ReactFlowDTO


@pytest.mark.asyncio
async def test_dto():
    # assert no exceptions are raised
    with open("tests/definitions/rf-1.json", "r") as f:
        dto = ReactFlowDTO.model_validate_json(f.read())
    assert dto is not None
    assert dto.viewport is not None


def test_react_flow_dto_accepts_subflows_placeholder():
    """WE-01-SUBFLOWS: optional opaque subgraph map validates and round-trips."""
    with open("tests/definitions/rf-1.json", "r") as f:
        base = json.loads(f.read())
    base["subflows"] = {
        "component_a": {
            "nodes": [],
            "edges": [],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        }
    }
    dto = ReactFlowDTO.model_validate(base)
    assert dto.subflows is not None
    assert "component_a" in dto.subflows
    dumped = dto.model_dump(mode="python", exclude_none=False)
    assert dumped.get("subflows", {}).get("component_a", {}).get("nodes") == []
