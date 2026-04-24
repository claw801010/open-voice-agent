"""WE-01-SUBFLOWS: WorkflowGraph validates non-empty named subgraphs on load."""

import pytest

from api.services.workflow.dto import (
    EdgeDataDTO,
    NodeDataDTO,
    NodeType,
    Position,
    ReactFlowDTO,
    RFEdgeDTO,
    RFNodeDTO,
)
from api.services.workflow.workflow import WorkflowGraph

_START_P = "Start Call System Prompt"
_END_P = "End Call System Prompt"


def _main_start_end() -> tuple[list[RFNodeDTO], list[RFEdgeDTO]]:
    nodes = [
        RFNodeDTO(
            id="m_start",
            type=NodeType.startNode,
            position=Position(x=0, y=0),
            data=NodeDataDTO(
                name="Start Call",
                prompt=_START_P,
                is_start=True,
                allow_interrupt=False,
                add_global_prompt=False,
            ),
        ),
        RFNodeDTO(
            id="m_end",
            type=NodeType.endNode,
            position=Position(x=0, y=200),
            data=NodeDataDTO(
                name="End Call",
                prompt=_END_P,
                is_end=True,
                allow_interrupt=False,
                add_global_prompt=False,
            ),
        ),
    ]
    edges = [
        RFEdgeDTO(
            id="m_se",
            source="m_start",
            target="m_end",
            data=EdgeDataDTO(
                label="End Call",
                condition="When the user says to end the call, end the call",
            ),
        ),
    ]
    return nodes, edges


def _sub_start_end(prefix: str) -> ReactFlowDTO:
    return ReactFlowDTO(
        nodes=[
            RFNodeDTO(
                id=f"{prefix}_start",
                type=NodeType.startNode,
                position=Position(x=0, y=0),
                data=NodeDataDTO(
                    name="Sub Start",
                    prompt=_START_P,
                    is_start=True,
                    allow_interrupt=False,
                    add_global_prompt=False,
                ),
            ),
            RFNodeDTO(
                id=f"{prefix}_end",
                type=NodeType.endNode,
                position=Position(x=0, y=200),
                data=NodeDataDTO(
                    name="Sub End",
                    prompt=_END_P,
                    is_end=True,
                    allow_interrupt=False,
                    add_global_prompt=False,
                ),
            ),
        ],
        edges=[
            RFEdgeDTO(
                id=f"{prefix}_se",
                source=f"{prefix}_start",
                target=f"{prefix}_end",
                data=EdgeDataDTO(
                    label="Done",
                    condition="done",
                ),
            ),
        ],
    )


def test_workflow_graph_loads_nonempty_subflow():
    main_nodes, main_edges = _main_start_end()
    inner = _sub_start_end("c1")
    dto = ReactFlowDTO(
        nodes=main_nodes,
        edges=main_edges,
        subflows={
            "component_1": inner.model_dump(mode="python", exclude_none=True),
        },
    )
    wg = WorkflowGraph(dto)
    assert list(wg.subflow_graphs.keys()) == ["component_1"]
    sub = wg.subflow_graphs["component_1"]
    assert sub.start_node_id == "c1_start"


def test_workflow_graph_skips_empty_subflow_entries():
    main_nodes, main_edges = _main_start_end()
    dto = ReactFlowDTO(
        nodes=main_nodes,
        edges=main_edges,
        subflows={
            "empty_a": {"nodes": [], "edges": []},
            "empty_b": {},
        },
    )
    wg = WorkflowGraph(dto)
    assert wg.subflow_graphs == {}


def test_enter_subflow_edge_requires_named_subgraph():
    main_nodes, main_edges = _main_start_end()
    inner = _sub_start_end("c1")
    dto = ReactFlowDTO(
        nodes=main_nodes,
        edges=[
            *main_edges,
            RFEdgeDTO(
                id="extra",
                source="m_start",
                target="m_end",
                data=EdgeDataDTO(
                    label="Via component",
                    condition="When user asks for the component path",
                    enter_subflow="component_1",
                ),
            ),
        ],
        subflows={
            "component_1": inner.model_dump(mode="python", exclude_none=True),
        },
    )
    wg = WorkflowGraph(dto)
    assert "component_1" in wg.subflow_graphs


def test_enter_subflow_from_component_graph_allows_sibling_subgraph():
    """Nested component graphs may reference other root-level subgraph keys (siblings)."""
    main_nodes, main_edges = _main_start_end()
    inner_b = _sub_start_end("b")
    inner_a_base = _sub_start_end("a")
    inner_a = ReactFlowDTO(
        nodes=inner_a_base.nodes,
        edges=[
            RFEdgeDTO(
                id="a_se",
                source="a_start",
                target="a_end",
                data=EdgeDataDTO(
                    label="Done",
                    condition="done",
                    enter_subflow="component_b",
                ),
            ),
        ],
    )
    dto = ReactFlowDTO(
        nodes=main_nodes,
        edges=main_edges,
        subflows={
            "component_a": inner_a.model_dump(mode="python", exclude_none=True),
            "component_b": inner_b.model_dump(mode="python", exclude_none=True),
        },
    )
    wg = WorkflowGraph(dto)
    assert "component_a" in wg.subflow_graphs
    assert "component_b" in wg.subflow_graphs
    sub_a = wg.subflow_graphs["component_a"]
    assert sub_a.edges[0].data.enter_subflow == "component_b"


def test_enter_subflow_from_component_graph_unknown_key_raises():
    main_nodes, main_edges = _main_start_end()
    inner_b = _sub_start_end("b")
    inner_a = ReactFlowDTO(
        nodes=_sub_start_end("a").nodes,
        edges=[
            RFEdgeDTO(
                id="a_se",
                source="a_start",
                target="a_end",
                data=EdgeDataDTO(
                    label="Done",
                    condition="done",
                    enter_subflow="missing_subflow",
                ),
            ),
        ],
    )
    dto = ReactFlowDTO(
        nodes=main_nodes,
        edges=main_edges,
        subflows={
            "component_a": inner_a.model_dump(mode="python", exclude_none=True),
            "component_b": inner_b.model_dump(mode="python", exclude_none=True),
        },
    )
    with pytest.raises(ValueError) as excinfo:
        WorkflowGraph(dto)
    errs = excinfo.value.args[0]
    assert isinstance(errs, list)
    assert any("enter_subflow" in (e.get("field") or "") for e in errs)


def test_enter_subflow_edge_unknown_key_raises():
    main_nodes, main_edges = _main_start_end()
    dto = ReactFlowDTO(
        nodes=main_nodes,
        edges=[
            *main_edges,
            RFEdgeDTO(
                id="extra",
                source="m_start",
                target="m_end",
                data=EdgeDataDTO(
                    label="Bad ref",
                    condition="x",
                    enter_subflow="missing_subflow",
                ),
            ),
        ],
        subflows={},
    )
    with pytest.raises(ValueError) as excinfo:
        WorkflowGraph(dto)
    errs = excinfo.value.args[0]
    assert isinstance(errs, list)
    assert any("enter_subflow" in (e.get("field") or "") for e in errs)


def test_workflow_graph_invalid_subflow_raises():
    main_nodes, main_edges = _main_start_end()
    bad_inner = ReactFlowDTO(
        nodes=[
            RFNodeDTO(
                id="only_end",
                type=NodeType.endNode,
                position=Position(x=0, y=0),
                data=NodeDataDTO(
                    name="Lonely End",
                    prompt=_END_P,
                    is_end=True,
                    allow_interrupt=False,
                    add_global_prompt=False,
                ),
            ),
        ],
        edges=[],
    )
    dto = ReactFlowDTO(
        nodes=main_nodes,
        edges=main_edges,
        subflows={
            "broken": bad_inner.model_dump(mode="python", exclude_none=True),
        },
    )
    with pytest.raises(ValueError) as excinfo:
        WorkflowGraph(dto)
    errs = excinfo.value.args[0]
    assert isinstance(errs, list)
    assert any("subflow" in e.get("message", "").lower() for e in errs)
