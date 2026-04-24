from __future__ import annotations

import re
from collections import Counter
from typing import Dict, List, Optional, Set

from pydantic import ValidationError

from api.services.workflow.dto import EdgeDataDTO, NodeDataDTO, NodeType, ReactFlowDTO
from api.services.workflow.errors import ItemKind, WorkflowError

# Regex for matching {{ variable }} template placeholders.
# Captures: group(1) = variable path, group(2) = filter name, group(3) = filter value.
# Shared with api.utils.template_renderer via import.
TEMPLATE_VAR_PATTERN = r"\{\{\s*([^|\s}]+)(?:\s*\|\s*([^:}]+)(?::([^}]+))?)?\s*\}\}"

# Variables injected by the system at runtime, not from source data.
_SYSTEM_VARIABLES = {"campaign_id", "provider", "source_uuid"}


def extract_template_variables(text: str) -> Set[str]:
    """Extract template variable names from a string, excluding nested paths,
    variables with a fallback filter, and system-injected variables."""
    variables: Set[str] = set()
    for match in re.finditer(TEMPLATE_VAR_PATTERN, text):
        var_name = match.group(1).strip()
        filter_name = match.group(2).strip() if match.group(2) else None

        # Skip nested paths (runtime-resolved, e.g. gathered_context.city)
        if "." in var_name:
            continue
        # Skip variables with a fallback (they have a default value)
        # Supports both {{var | default}} and legacy {{var | fallback:default}}
        if filter_name is not None:
            continue
        # Skip system-injected variables
        if var_name in _SYSTEM_VARIABLES:
            continue

        variables.add(var_name)
    return variables


class Edge:
    def __init__(self, source: str, target: str, data: EdgeDataDTO):
        self.source = source
        self.target = target

        self.label = data.label
        self.condition = data.condition
        self.transition_speech = data.transition_speech

        self.data = data

    def get_function_name(self):
        return re.sub(r"[^a-z0-9]", "_", self.label.lower())

    def __eq__(self, other):
        if not isinstance(other, Edge):
            return False
        return self.source == other.source and self.target == other.target

    def __hash__(self):
        return hash((self.source, self.target))


class Node:
    def __init__(self, id: str, node_type: NodeType, data: NodeDataDTO):
        self.id, self.node_type, self.data = id, node_type, data
        self.out: Dict[str, "Node"] = {}  # forward nodes
        self.out_edges: List[Edge] = []  # forward edges with properties

        self.name = data.name
        self.prompt = data.prompt
        self.is_static = data.is_static
        self.is_start = data.is_start
        self.is_end = data.is_end
        self.allow_interrupt = data.allow_interrupt
        self.extraction_enabled = data.extraction_enabled
        self.extraction_prompt = data.extraction_prompt
        self.extraction_variables = data.extraction_variables
        self.add_global_prompt = data.add_global_prompt
        self.greeting = data.greeting
        self.greeting_type = data.greeting_type
        self.greeting_recording_id = data.greeting_recording_id
        self.detect_voicemail = data.detect_voicemail
        self.delayed_start = data.delayed_start
        self.delayed_start_duration = data.delayed_start_duration
        self.tool_uuids = data.tool_uuids
        self.document_uuids = data.document_uuids
        self.pre_call_fetch_enabled = data.pre_call_fetch_enabled
        self.pre_call_fetch_url = data.pre_call_fetch_url
        self.pre_call_fetch_credential_uuid = data.pre_call_fetch_credential_uuid

        self.data = data


class WorkflowGraph:
    """
    *All* business invariants (acyclic, cardinality, etc.) are verified here.
    The constructor accepts a validated ReactFlowDTO.
    """

    def __init__(
        self,
        dto: ReactFlowDTO,
        *,
        enter_subflow_allowed_keys: Optional[Set[str]] = None,
    ):
        # build adjacency list
        self.nodes: Dict[str, Node] = {
            n.id: Node(n.id, n.type, n.data) for n in dto.nodes
        }

        # Store all edges
        self.edges: List[Edge] = []

        for e in dto.edges:
            source_node = self.nodes[e.source]
            target_node = self.nodes[e.target]

            # Create the edge with properties from dto
            edge = Edge(source=e.source, target=e.target, data=e.data)

            # Add to the edge list
            self.edges.append(edge)

            # Add to the source node's outgoing edges
            source_node.out_edges.append(edge)

            # Set up the node references for backward compatibility
            source_node.out[target_node.id] = target_node

        self._validate_graph()

        # Get a reference to the start node
        self.start_node_id = [n.id for n in dto.nodes if n.data.is_start][0]

        # Get a reference to the global node
        try:
            self.global_node_id = [
                n.id for n in dto.nodes if n.type == NodeType.globalNode
            ][0]
        except IndexError:
            self.global_node_id = None

        # WE-01-SUBFLOWS: optional explicit allow-list (nested component graphs reference root subgraph keys).
        self._enter_subflow_allowed_keys: Optional[Set[str]] = enter_subflow_allowed_keys
        # WE-01-SUBFLOWS: validate each non-empty named subgraph like the main graph.
        self.subflow_graphs: Dict[str, WorkflowGraph] = self._load_subflows(dto)
        self._validate_subflow_entry_edges()

    def _validate_subflow_entry_edges(self) -> None:
        """Edges with ``enter_subflow`` must name an allowed subgraph key (root: loaded graphs; nested: siblings)."""
        errors: list[WorkflowError] = []
        allowed: Set[str] = (
            set(self._enter_subflow_allowed_keys)
            if self._enter_subflow_allowed_keys is not None
            else set(self.subflow_graphs.keys())
        )
        for edge in self.edges:
            key = edge.data.enter_subflow
            if not key:
                continue
            if key not in allowed:
                errors.append(
                    WorkflowError(
                        kind=ItemKind.edge,
                        id=None,
                        field="data.enter_subflow",
                        message=(
                            f"Edge {edge.source}→{edge.target} sets enter_subflow to "
                            f"'{key}' but that subgraph name is not allowed here (missing or empty subgraph)"
                        ),
                    )
                )
        if errors:
            raise ValueError(errors)

    def _load_subflows(self, dto: ReactFlowDTO) -> Dict[str, WorkflowGraph]:
        result: Dict[str, WorkflowGraph] = {}
        raw = dto.subflows
        if not raw:
            return result
        if not isinstance(raw, dict):
            raise ValueError(
                [
                    WorkflowError(
                        kind=ItemKind.workflow,
                        id=None,
                        field="subflows",
                        message="subflows must be an object mapping names to graph definitions",
                    )
                ]
            )
        sibling_keys: Set[str] = set()
        for _k, blob in raw.items():
            if not isinstance(blob, dict):
                continue
            _nodes = blob.get("nodes") or []
            _edges = blob.get("edges") or []
            if _nodes or _edges:
                sibling_keys.add(_k)

        for name, blob in raw.items():
            if not isinstance(blob, dict):
                raise ValueError(
                    [
                        WorkflowError(
                            kind=ItemKind.workflow,
                            id=None,
                            field=f"subflows.{name}",
                            message="Subflow definition must be an object with nodes and edges",
                        )
                    ]
                )
            nodes = blob.get("nodes") or []
            edges = blob.get("edges") or []
            if not nodes and not edges:
                continue
            inner = {k: v for k, v in blob.items() if k != "subflows"}
            inner.setdefault("nodes", nodes)
            inner.setdefault("edges", edges)
            try:
                sub_dto = ReactFlowDTO.model_validate(inner)
            except ValidationError as exc:
                raise ValueError(
                    [
                        WorkflowError(
                            kind=ItemKind.workflow,
                            id=None,
                            field=f"subflows.{name}",
                            message=f"Invalid subflow graph (schema): {exc}",
                        )
                    ]
                ) from exc
            try:
                result[name] = WorkflowGraph(
                    sub_dto,
                    enter_subflow_allowed_keys=sibling_keys,
                )
            except ValueError as exc:
                errs = exc.args[0] if exc.args else None
                if isinstance(errs, list):
                    wrapped: list = []
                    for err in errs:
                        if isinstance(err, dict):
                            fe = dict(err)
                            prev_field = fe.get("field")
                            fe["field"] = (
                                f"subflows.{name}"
                                if not prev_field
                                else f"subflows.{name}.{prev_field}"
                            )
                            fe["message"] = f"[subflow '{name}'] {fe.get('message', '')}"
                            wrapped.append(fe)
                    raise ValueError(wrapped) from exc
                raise
        return result

    # -----------------------------------------------------------
    # template variable extraction
    # -----------------------------------------------------------
    def get_required_template_variables(self) -> Set[str]:
        """Extract all template variables referenced in node prompts/greetings
        and edge transition speeches.

        Scans:
          - Start node: prompt, greeting
          - Agent / End / Global nodes: prompt
          - All edges: transition_speech

        Returns a set of top-level variable names that the workflow expects
        from the source data (excluding nested paths, fallback vars, and
        system-injected vars).
        """
        variables: Set[str] = set()

        for node in self.nodes.values():
            if node.node_type in (
                NodeType.startNode,
                NodeType.agentNode,
                NodeType.endNode,
                NodeType.globalNode,
            ):
                if node.prompt:
                    variables |= extract_template_variables(node.prompt)

            # greeting is only relevant on the start node
            if node.node_type == NodeType.startNode and node.greeting:
                variables |= extract_template_variables(node.greeting)

        for edge in self.edges:
            if edge.transition_speech:
                variables |= extract_template_variables(edge.transition_speech)

        return variables

    # -----------------------------------------------------------
    # validators
    # -----------------------------------------------------------
    def _validate_graph(self) -> None:
        errors: list[WorkflowError] = []

        # TODO: Figure out what kind of cyclic contraints can be applied, since there can be a cycle in the graph
        # try:
        #     self._assert_acyclic()
        # except ValueError as e:
        #     errors.append(
        #         WorkflowError(
        #             kind=ItemKind.workflow, id=None, field=None, message=str(e)
        #         )
        #     )

        errors.extend(self._assert_start_node())
        errors.extend(self._assert_connection_counts())
        errors.extend(self._assert_global_node())
        errors.extend(self._assert_node_configs())
        if errors:
            raise ValueError(errors)

    def _assert_acyclic(self):
        color: Dict[str, str] = {}  # white / gray / black

        def dfs(n: Node):
            if color.get(n.id) == "gray":  # back-edge
                raise ValueError("workflow contains a cycle")
            if color.get(n.id) != "black":
                color[n.id] = "gray"
                for m in n.out.values():
                    dfs(m)
                color[n.id] = "black"

        for n in self.nodes.values():
            dfs(n)

    def _assert_start_node(self):
        errors: list[WorkflowError] = []
        start_node = [n for n in self.nodes.values() if n.data.is_start]
        if not start_node:
            errors.append(
                WorkflowError(
                    kind=ItemKind.workflow,
                    id=None,
                    field=None,
                    message="Workflow must have exactly one start node",
                )
            )
        elif len(start_node) > 1:
            errors.append(
                WorkflowError(
                    kind=ItemKind.workflow,
                    id=None,
                    field=None,
                    message="Workflow must have exactly one start node",
                )
            )
        return errors

    def _assert_global_node(self):
        errors: list[WorkflowError] = []
        global_node = [
            n for n in self.nodes.values() if n.node_type == NodeType.globalNode
        ]
        if not len(global_node) <= 1:
            errors.append(
                WorkflowError(
                    kind=ItemKind.workflow,
                    id=None,
                    field=None,
                    message="Workflow must have at most one global node",
                )
            )
        return errors

    def _assert_connection_counts(self):
        errors: list[WorkflowError] = []

        out_deg = Counter()
        in_deg = Counter()
        for n in self.nodes.values():  # init counters
            out_deg[n.id] = in_deg[n.id] = 0
        for src, n in self.nodes.items():  # compute degrees
            for m in n.out.values():
                out_deg[src] += 1
                in_deg[m.id] += 1

        for n in self.nodes.values():
            in_d, out_d = in_deg[n.id], out_deg[n.id]

            match n.node_type:
                case NodeType.endNode:
                    if in_d < 1 or out_d != 0:
                        errors.append(
                            WorkflowError(
                                kind=ItemKind.node,
                                id=n.id,
                                field=None,
                                message=f"EndNode must have at least 1 incoming edge",
                            )
                        )
                case NodeType.agentNode:
                    if in_d < 1:
                        errors.append(
                            WorkflowError(
                                kind=ItemKind.node,
                                id=n.id,
                                field=None,
                                message=f"Worker must have at least 1 incoming edge",
                            )
                        )

        return errors

    def _assert_node_configs(self):
        """Validate node-specific configuration constraints."""
        errors: list[WorkflowError] = []

        for node in self.nodes.values():
            # Validate StartNode constraints
            if node.node_type == NodeType.startNode:
                # No specific validations for start node at this time
                pass

        return errors
