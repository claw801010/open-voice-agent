"""n8n workflow export helpers (MK-01-IMPORT-OPTIONS).

Structural validation and HTTP Request–style node summaries for manual mapping to
Dograh HTTP tools. Complements ``catalog/scripts/validate-n8n-workflow-export.mjs``.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Any


class N8nWorkflowExportError(ValueError):
    """Raised when JSON is not a usable n8n workflow export."""


class N8nUnsupportedNodesError(N8nWorkflowExportError):
    """Raised when the export contains nodes outside the v1 HTTP-only packaged-draft subset."""


def normalize_n8n_export(data: Any) -> dict[str, Any]:
    """Accept either a single workflow object or n8n's array-of-workflows export."""
    if isinstance(data, list):
        if not data:
            raise N8nWorkflowExportError("Empty workflow array.")
        first = data[0]
        if not isinstance(first, dict):
            raise N8nWorkflowExportError("Workflow array entries must be objects.")
        return first
    if isinstance(data, dict):
        return data
    raise N8nWorkflowExportError("Expected a JSON object or array of workflows.")


def validate_n8n_workflow_structure(wf: dict[str, Any]) -> None:
    """Ensure minimal shape matches what ``validate-n8n-workflow-export.mjs`` checks."""
    nodes = wf.get("nodes")
    if not isinstance(nodes, list):
        raise N8nWorkflowExportError(
            'Missing or invalid "nodes" array (not an n8n workflow export?).'
        )


def parse_n8n_workflow_export_bytes(raw: bytes) -> dict[str, Any]:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise N8nWorkflowExportError("Invalid JSON.") from e
    wf = normalize_n8n_export(data)
    validate_n8n_workflow_structure(wf)
    return wf


def _is_http_request_style_node(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    t = node.get("type")
    return isinstance(t, str) and "httprequest" in t.lower()


def _is_branching_control_node(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    t = node.get("type")
    if not isinstance(t, str):
        return False
    tl = t.lower()
    return tl.endswith(".if") or ".switch" in tl


def _is_set_node(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    t = node.get("type")
    return isinstance(t, str) and (t.lower().endswith(".set") or t.lower() == "set")


def _is_code_node(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    t = node.get("type")
    return isinstance(t, str) and (".code" in t.lower() or t.lower().endswith(".function"))


def _is_merge_node(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    t = node.get("type")
    return isinstance(t, str) and ".merge" in t.lower()


def _is_transform_hint_node(node: Any) -> bool:
    return _is_set_node(node) or _is_code_node(node) or _is_merge_node(node)


def _is_supported_strict_node(node: Any) -> bool:
    return _is_http_request_style_node(node) or _is_branching_control_node(node)


def iter_http_request_style_nodes(wf: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = wf.get("nodes") or []
    if not isinstance(nodes, list):
        return []
    return [n for n in nodes if _is_http_request_style_node(n)]


def summarize_http_like_node(node: dict[str, Any]) -> dict[str, Any]:
    """Extract method/URL hints aligned with the catalog Node script output."""
    p = node.get("parameters") if isinstance(node.get("parameters"), dict) else {}
    name = node.get("name") if isinstance(node.get("name"), str) else "(unnamed)"
    ntype = node.get("type") if isinstance(node.get("type"), str) else ""
    method_raw = (
        p.get("requestMethod")
        or p.get("method")
        or p.get("httpMethod")
        or p.get("requestMethodUi")
        or p.get("methodUi")
        or "GET"
    )
    method = str(method_raw).upper()[:16]
    url = p.get("url")
    if url is not None and not isinstance(url, str):
        url = p.get("urlExpression") or p.get("path") or ""
    if not isinstance(url, str):
        url = ""
    url_preview = url if len(url) <= 240 else f"{url[:240]}…"
    return {
        "n8nNodeName": name,
        "type": ntype,
        "method": method,
        "urlPreview": url_preview,
        "mappingHint": (
            "Map to HTTP tool: set Method + URL on the tool; move JSON keys from "
            "Send Body / Query to body_template or URL templates."
        ),
    }


def http_hints_from_workflow(wf: dict[str, Any]) -> list[dict[str, Any]]:
    """Return one summary dict per HTTP-like node (may be empty)."""
    return [summarize_http_like_node(n) for n in iter_http_request_style_nodes(wf)]


def _preview_scalar(value: Any, *, max_len: int = 96) -> str:
    if value is None:
        return ""
    s = str(value).replace("\n", " ").strip()
    if len(s) > max_len:
        return f"{s[:max_len]}…"
    return s


def _extract_set_field_pairs(node: dict[str, Any]) -> list[tuple[str, str]]:
    """Best-effort parse of n8n Set / Edit Fields assignments from export JSON."""
    p = node.get("parameters") if isinstance(node.get("parameters"), dict) else {}
    pairs: list[tuple[str, str]] = []

    assignments = p.get("assignments")
    if isinstance(assignments, dict):
        items = assignments.get("assignments")
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = item.get("name") or item.get("id")
                if not name:
                    continue
                pairs.append((str(name), _preview_scalar(item.get("value"))))

    json_output = p.get("jsonOutput")
    if isinstance(json_output, str) and json_output.strip():
        pairs.append(("(jsonOutput)", _preview_scalar(json_output, max_len=120)))

    values = p.get("values")
    if isinstance(values, dict):
        for group_key, entries in values.items():
            if not isinstance(entries, list):
                continue
            for entry in entries[:16]:
                if not isinstance(entry, dict):
                    continue
                name = entry.get("name") or group_key
                if name:
                    pairs.append((str(name), _preview_scalar(entry.get("value"))))

    return pairs[:24]


def summarize_set_node(node: dict[str, Any]) -> dict[str, Any]:
    name = node.get("name") if isinstance(node.get("name"), str) else "(unnamed)"
    fields = _extract_set_field_pairs(node)
    return {
        "n8nNodeName": name,
        "kind": "set",
        "fields": [{"name": n, "valuePreview": v} for n, v in fields],
        "mappingHint": (
            "Map fields to template variables ({{var}}) or call-context test JSON; "
            "use the same dot paths in HTTP tool body/URL templates."
        ),
    }


def summarize_code_node(node: dict[str, Any]) -> dict[str, Any]:
    p = node.get("parameters") if isinstance(node.get("parameters"), dict) else {}
    name = node.get("name") if isinstance(node.get("name"), str) else "(unnamed)"
    js = p.get("jsCode") if isinstance(p.get("jsCode"), str) else ""
    py = p.get("pythonCode") if isinstance(p.get("pythonCode"), str) else ""
    if js:
        language = "javascript"
        code = js
    elif py:
        language = "python"
        code = py
    else:
        language = "unknown"
        code = ""
    return {
        "n8nNodeName": name,
        "kind": "code",
        "language": language,
        "codePreview": _preview_scalar(code, max_len=200),
        "mappingHint": (
            "Refactor imperative logic into agent instructions, tool response_mapping, "
            "or a dedicated HTTP tool — Code nodes do not run in voice runtime."
        ),
    }


def summarize_merge_node(node: dict[str, Any]) -> dict[str, Any]:
    p = node.get("parameters") if isinstance(node.get("parameters"), dict) else {}
    name = node.get("name") if isinstance(node.get("name"), str) else "(unnamed)"
    mode = p.get("mode") or p.get("mergeByFields") or "append"
    return {
        "n8nNodeName": name,
        "kind": "merge",
        "mergeMode": _preview_scalar(mode, max_len=48),
        "mappingHint": (
            "Voice flows merge context in the agent or a single HTTP tool response; "
            "no 1:1 Merge node on canvas."
        ),
    }


def iter_transform_hint_nodes(wf: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = wf.get("nodes") or []
    if not isinstance(nodes, list):
        return []
    out: list[dict[str, Any]] = []
    for n in nodes:
        if not isinstance(n, dict):
            continue
        if _is_set_node(n):
            out.append(summarize_set_node(n))
        elif _is_code_node(n):
            out.append(summarize_code_node(n))
        elif _is_merge_node(n):
            out.append(summarize_merge_node(n))
    return out


def transform_hints_from_workflow(wf: dict[str, Any]) -> list[dict[str, Any]]:
    """Return Set / Code / Merge summaries in workflow node-list order."""
    return iter_transform_hint_nodes(wf)


def agent_prompt_addon_from_transform_hints(hints: list[dict[str, Any]]) -> str:
    lines = [
        "",
        "n8n Set / Code / Merge (map to template variables & prompts — not auto-wired):",
    ]
    for i, h in enumerate(hints, start=1):
        nm = h.get("n8nNodeName") or "(unnamed)"
        kind = h.get("kind") or "transform"
        if kind == "set":
            fields = h.get("fields") or []
            if fields:
                field_bits = ", ".join(
                    f'{f.get("name")}={f.get("valuePreview")!r}'[:80] for f in fields[:6]
                )
                if len(fields) > 6:
                    field_bits += f" … (+{len(fields) - 6} more)"
            else:
                field_bits = "(no parsed assignments — open in n8n UI)"
            lines.append(f'{i}. Set "{nm}" — {field_bits}')
        elif kind == "code":
            lang = h.get("language") or "?"
            preview = h.get("codePreview") or ""
            lines.append(f'{i}. Code "{nm}" ({lang}) — {preview or "(empty)"}')
        elif kind == "merge":
            mode = h.get("mergeMode") or "?"
            lines.append(f'{i}. Merge "{nm}" — mode {mode}')
        else:
            lines.append(f"{i}. {kind} \"{nm}\"")
    lines.append(
        "Map Set fields to {{template}} variables; refactor Code into agent logic or HTTP "
        "response_mapping — these nodes are not executed in voice runtime."
    )
    return "\n".join(lines).strip()


def _http_node_display_name(node: dict[str, Any]) -> str:
    n = node.get("name")
    return str(n).strip() if isinstance(n, str) and str(n).strip() else ""


def _edges_between_http_nodes(
    connections: dict[str, Any], http_names: frozenset[str]
) -> list[tuple[str, str]]:
    """Parse n8n ``connections`` main links whose endpoints are both HTTP nodes (by name)."""
    edges: list[tuple[str, str]] = []
    for src_name, outs in connections.items():
        if not isinstance(src_name, str) or src_name not in http_names:
            continue
        if not isinstance(outs, dict):
            continue
        main = outs.get("main")
        if not isinstance(main, list):
            continue
        for slot in main:
            if not isinstance(slot, list):
                continue
            for link in slot:
                if not isinstance(link, dict):
                    continue
                tgt = link.get("node")
                if isinstance(tgt, str) and tgt in http_names:
                    edges.append((src_name, tgt))
    return edges


def _stable_topo_sort_http_names(
    names_in_node_order: list[str], edges: list[tuple[str, str]]
) -> tuple[list[str] | None, bool]:
    """Return topological order of ``names_in_node_order`` or ``(None, _)`` if cycle.

    Tie-breaks among ready nodes by first appearance index in ``names_in_node_order``.
    Second bool: ``True`` if every edge was between known names (no filtered stray edges).
    """
    name_set = frozenset(names_in_node_order)
    index_of = {n: i for i, n in enumerate(names_in_node_order)}
    adj: dict[str, list[str]] = defaultdict(list)
    indeg = {n: 0 for n in names_in_node_order}
    used_edges = 0
    for a, b in edges:
        if a not in name_set or b not in name_set:
            continue
        adj[a].append(b)
        indeg[b] += 1
        used_edges += 1

    ready = sorted(
        [n for n in names_in_node_order if indeg[n] == 0],
        key=lambda x: index_of[x],
    )
    result: list[str] = []
    while ready:
        n = ready.pop(0)
        result.append(n)
        for m in sorted(adj[n], key=lambda x: index_of[x]):
            indeg[m] -= 1
            if indeg[m] == 0:
                ready.append(m)
        ready.sort(key=lambda x: index_of[x])

    if len(result) != len(name_set):
        return None, used_edges > 0

    return result, used_edges > 0


def ordered_http_hints_from_http_only_workflow(
    wf: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Order HTTP summaries using n8n ``connections`` when it forms a DAG over HTTP nodes.

    Falls back to canvas/node-list order. Returns ``(hints, extra_warnings)``.
    """
    warnings: list[str] = []
    raw_nodes = wf.get("nodes")
    if not isinstance(raw_nodes, list):
        return [], warnings

    http_nodes = [n for n in raw_nodes if isinstance(n, dict) and _is_http_request_style_node(n)]
    if not http_nodes:
        return [], warnings

    names_order = [_http_node_display_name(n) for n in http_nodes]
    if any(not nm for nm in names_order):
        warnings.append(
            "Some HTTP Request nodes have no name; cannot match n8n connections — "
            "hints follow workflow node list order."
        )
        return [summarize_http_like_node(n) for n in http_nodes], warnings

    if len(set(names_order)) != len(names_order):
        warnings.append(
            "Duplicate HTTP Request node names; cannot reliably apply n8n connections — "
            "hints follow workflow node list order."
        )
        return [summarize_http_like_node(n) for n in http_nodes], warnings

    hints_by_name = {nm: summarize_http_like_node(n) for nm, n in zip(names_order, http_nodes)}

    conn = wf.get("connections")
    if not isinstance(conn, dict) or not conn:
        return [hints_by_name[k] for k in names_order], warnings

    http_name_set = frozenset(names_order)
    edges = _edges_between_http_nodes(conn, http_name_set)
    topo, had_edges = _stable_topo_sort_http_names(names_order, edges)

    if topo is None:
        warnings.append(
            "n8n main connections among HTTP nodes could not be linearized (cycle); "
            "HTTP hints follow workflow node list order."
        )
        ordered_keys = names_order
    elif had_edges and topo != names_order:
        warnings.append(
            "Ordered HTTP Request hints using n8n main-connection topology "
            "(Dograh draft graph remains linear start → agent → end)."
        )
        ordered_keys = topo
    elif had_edges:
        ordered_keys = topo
    else:
        warnings.append(
            "n8n connections did not define HTTP→HTTP main links; "
            "hints follow workflow node list order."
        )
        ordered_keys = names_order

    return [hints_by_name[k] for k in ordered_keys], warnings


@dataclass(frozen=True)
class N8nBranchSlice:
    """One output branch from an n8n IF/Switch mapped to a Dograh subflow key."""

    branch_node_name: str
    branch_node_type: str
    output_index: int
    output_label: str
    subflow_key: str
    http_node_names: tuple[str, ...]


def _branch_output_label(node_type: str, output_index: int, num_slots: int) -> str:
    tl = node_type.lower()
    if num_slots == 2 and (tl.endswith(".if") or "if" in tl):
        return "true" if output_index == 0 else "false"
    return f"output_{output_index}"


def _slugify_subflow_key(branch_node_name: str, output_label: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "_", branch_node_name.strip()).strip("_").lower()
    if not base:
        base = "branch"
    key = f"n8n_{base}_{output_label}"
    return key[:48]


def _main_output_target_names(
    connections: dict[str, Any], source_name: str
) -> list[list[str]]:
    """Return n8n ``connections[source].main`` slots as lists of target node names."""
    outs = connections.get(source_name)
    if not isinstance(outs, dict):
        return []
    main = outs.get("main")
    if not isinstance(main, list):
        return []
    slots: list[list[str]] = []
    for slot in main:
        names: list[str] = []
        if isinstance(slot, list):
            for link in slot:
                if isinstance(link, dict):
                    tgt = link.get("node")
                    if isinstance(tgt, str) and tgt.strip():
                        names.append(tgt.strip())
        slots.append(names)
    return slots


def _all_outgoing_target_names(connections: dict[str, Any], source_name: str) -> list[str]:
    seen: list[str] = []
    for slot in _main_output_target_names(connections, source_name):
        for n in slot:
            if n not in seen:
                seen.append(n)
    return seen


def _reachable_http_node_names(
    wf: dict[str, Any],
    seeds: list[str],
    *,
    stop_at_branching: bool = True,
) -> list[str]:
    """BFS from ``seeds`` along n8n main links; collect HTTP Request node names in visit order."""
    connections = wf.get("connections")
    if not isinstance(connections, dict):
        return []

    raw_nodes = wf.get("nodes")
    if not isinstance(raw_nodes, list):
        return []

    by_name: dict[str, dict[str, Any]] = {}
    for n in raw_nodes:
        if isinstance(n, dict):
            nm = (
                str(n.get("name")).strip()
                if isinstance(n.get("name"), str) and str(n.get("name")).strip()
                else ""
            )
            if nm:
                by_name[nm] = n

    visited: set[str] = set()
    queue = [s for s in seeds if s]
    http_names: list[str] = []

    while queue:
        cur = queue.pop(0)
        if cur in visited:
            continue
        visited.add(cur)
        node = by_name.get(cur)
        if node is None:
            continue
        if _is_http_request_style_node(node):
            http_names.append(cur)
        if stop_at_branching and _is_branching_control_node(node):
            continue
        for tgt in _all_outgoing_target_names(connections, cur):
            if tgt not in visited:
                queue.append(tgt)

    return http_names


def analyze_n8n_branch_slices(wf: dict[str, Any]) -> list[N8nBranchSlice]:
    """Detect IF/Switch nodes with multiple main outputs and HTTP reachable per branch."""
    connections = wf.get("connections")
    if not isinstance(connections, dict):
        return []

    raw_nodes = wf.get("nodes")
    if not isinstance(raw_nodes, list):
        return []

    slices: list[N8nBranchSlice] = []
    used_keys: set[str] = set()

    for node in raw_nodes:
        if not isinstance(node, dict) or not _is_branching_control_node(node):
            continue
        name = (
            str(node.get("name")).strip()
            if isinstance(node.get("name"), str) and str(node.get("name")).strip()
            else ""
        )
        if not name:
            continue
        ntype = str(node.get("type") or "")
        slots = _main_output_target_names(connections, name)
        if len(slots) < 2:
            continue
        for idx, targets in enumerate(slots):
            if not targets:
                continue
            label = _branch_output_label(ntype, idx, len(slots))
            key = _slugify_subflow_key(name, label)
            n = 0
            while key in used_keys:
                n += 1
                key = _slugify_subflow_key(f"{name}_{n}", label)
            used_keys.add(key)
            http_names = tuple(_reachable_http_node_names(wf, targets))
            slices.append(
                N8nBranchSlice(
                    branch_node_name=name,
                    branch_node_type=ntype,
                    output_index=idx,
                    output_label=label,
                    subflow_key=key,
                    http_node_names=http_names,
                )
            )

    return slices


def agent_prompt_addon_from_http_hints(hints: list[dict[str, Any]]) -> str:
    """Human-readable block for the imported agent node (tools still created separately)."""
    lines = [
        "Imported n8n HTTP Request nodes — create matching HTTP API tools in the editor:",
    ]
    for i, h in enumerate(hints, start=1):
        nm = h.get("n8nNodeName") or "(unnamed)"
        method = h.get("method") or "?"
        url = h.get("urlPreview") or ""
        lines.append(f'{i}. "{nm}" — {method} {url}')
    if hints:
        lines.append("")
        lines.append(str(hints[0].get("mappingHint") or ""))
    return "\n".join(lines).strip()


def _minimal_voice_graph(
    *,
    agent_prompt_body: str,
    id_prefix: str = "n-import",
    agent_name: str = "Imported agent",
) -> dict[str, Any]:
    """startCall → agentNode → endCall (same shape as catalog packaged workflows)."""
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


def _minimal_import_shell_graph(*, agent_prompt_body: str) -> dict[str, Any]:
    return _minimal_voice_graph(agent_prompt_body=agent_prompt_body)


def _http_hints_for_node_names(
    wf: dict[str, Any], http_names: tuple[str, ...]
) -> tuple[list[dict[str, Any]], list[str]]:
    if not http_names:
        return [], []
    raw_nodes = wf.get("nodes")
    if not isinstance(raw_nodes, list):
        return [], []
    name_set = frozenset(http_names)
    http_nodes = [
        n
        for n in raw_nodes
        if isinstance(n, dict)
        and _is_http_request_style_node(n)
        and _http_node_display_name(n) in name_set
    ]
    mini = dict(wf)
    mini["nodes"] = http_nodes
    return ordered_http_hints_from_http_only_workflow(mini)


def _branch_routing_prompt_addon(
    slices: list[N8nBranchSlice],
    *,
    subflows_emitted: bool,
) -> str:
    lines = [
        "",
        "n8n branching (IF/Switch):",
    ]
    for sl in slices:
        if sl.http_node_names:
            http_list = ", ".join(f'"{n}"' for n in sl.http_node_names)
        else:
            http_list = "(no HTTP Request nodes on this branch)"
        if subflows_emitted:
            lines.append(
                f'- Subflow "{sl.subflow_key}" — n8n "{sl.branch_node_name}" '
                f"**{sl.output_label}** branch: {http_list}"
            )
        else:
            lines.append(
                f'- n8n "{sl.branch_node_name}" **{sl.output_label}** branch: {http_list}'
            )
    if subflows_emitted:
        lines.append(
            "Use the matching **Run subgraph first** transition on the main agent when "
            "the caller's intent matches that branch; finish HTTP tools inside the subflow."
        )
    else:
        lines.append("Wire branch logic manually in the editor (subflow import disabled).")
    return "\n".join(lines)


def _attach_branch_subflows(
    graph: dict[str, Any],
    wf: dict[str, Any],
    slices: list[N8nBranchSlice],
) -> dict[str, Any]:
    """Add ``subflows`` and agent→end edges with ``enter_subflow`` per branch slice."""
    subflows: dict[str, Any] = {}
    for sl in slices:
        hints, _ = _http_hints_for_node_names(wf, sl.http_node_names)
        if hints:
            body = agent_prompt_addon_from_http_hints(hints)
        else:
            body = (
                f'Branch "{sl.output_label}" from n8n "{sl.branch_node_name}" has no '
                "HTTP Request nodes. Add tools here if this path needs integrations."
            )
        subflows[sl.subflow_key] = _minimal_voice_graph(
            agent_prompt_body=body,
            id_prefix=f"sf-{sl.subflow_key}"[:40],
            agent_name=f"Branch {sl.output_label}",
        )

    agent_id = "n-import-agent"
    end_id = "n-import-end"
    edges: list[dict[str, Any]] = [
        e for e in graph.get("edges", []) if e.get("source") != agent_id
    ]
    edges.append(
        {
            "id": "e-import-end-default",
            "source": agent_id,
            "target": end_id,
            "data": {
                "label": "End",
                "condition": "When the conversation is complete without a branch subflow",
            },
        }
    )
    for i, sl in enumerate(slices):
        edges.append(
            {
                "id": f"e-import-branch-{i}",
                "source": agent_id,
                "target": end_id,
                "data": {
                    "label": f"Branch {sl.output_label}",
                    "condition": (
                        f"When the caller matches the n8n "
                        f'"{sl.branch_node_name}" {sl.output_label} path'
                    ),
                    "enter_subflow": sl.subflow_key,
                },
            }
        )

    out = dict(graph)
    out["edges"] = edges
    out["subflows"] = subflows
    return out


def _node_label(n: dict[str, Any]) -> str:
    name = n.get("name") if isinstance(n.get("name"), str) else "(unnamed)"
    ntype = n.get("type") if isinstance(n.get("type"), str) else "(missing type)"
    return f'"{name}" ({ntype})'


def _skipped_non_http_node_labels(raw_nodes: list[Any]) -> list[str]:
    labels: list[str] = []
    for n in raw_nodes:
        if not isinstance(n, dict):
            continue
        if (
            _is_http_request_style_node(n)
            or _is_branching_control_node(n)
            or _is_transform_hint_node(n)
        ):
            continue
        labels.append(_node_label(n))
    return labels


def _strict_unsupported_node_labels(raw_nodes: list[Any]) -> list[str]:
    """Nodes rejected when ``strict_http_only`` is true (HTTP + IF/Switch only)."""
    labels: list[str] = []
    for n in raw_nodes:
        if not isinstance(n, dict) or _is_supported_strict_node(n):
            continue
        labels.append(_node_label(n))
    return labels


def draft_packaged_workflow_from_n8n(
    wf: dict[str, Any],
    *,
    strict_http_only: bool = False,
    emit_branch_subflows: bool = True,
) -> tuple[dict[str, Any], list[str]]:
    """
    Build a minimal Dograh ``workflow_definition`` from an n8n export.

    Uses n8n ``connections`` **main** links between HTTP nodes to **order** tool hints in the
    agent prompt. The main graph is **startCall → agentNode → endCall**; when ``emit_branch_subflows``
    is true and the export has IF/Switch nodes with multiple outputs, each branch becomes a named
    **subflow** (same voice skeleton) and the main agent gains **enter_subflow** transitions.

    When ``strict_http_only`` is false (default), non-HTTP nodes except IF/Switch are **skipped**
    with warnings. When true, only HTTP Request and IF/Switch nodes are allowed.
    """
    validate_n8n_workflow_structure(wf)
    warnings: list[str] = []
    raw_nodes = wf.get("nodes")
    if not isinstance(raw_nodes, list):
        raise N8nWorkflowExportError('Missing or invalid "nodes" array.')
    if len(raw_nodes) == 0:
        raise N8nWorkflowExportError("n8n workflow has no nodes.")

    http_nodes = [n for n in raw_nodes if isinstance(n, dict) and _is_http_request_style_node(n)]
    skipped = _skipped_non_http_node_labels(raw_nodes)

    if not http_nodes:
        raise N8nWorkflowExportError(
            "n8n export has no HTTP Request–style nodes (type contains 'httpRequest')."
        )

    if strict_http_only:
        strict_bad = _strict_unsupported_node_labels(raw_nodes)
        if strict_bad:
            raise N8nUnsupportedNodesError(
                "n8n packaged-draft strict mode supports HTTP Request nodes and IF/Switch "
                "control nodes only. Unsupported: "
                + "; ".join(strict_bad[:8])
                + (f" … (+{len(strict_bad) - 8} more)" if len(strict_bad) > 8 else "")
            )

    if skipped:
        shown = "; ".join(skipped[:8])
        if len(skipped) > 8:
            shown += f" … (+{len(skipped) - 8} more)"
        warnings.append(
            "Skipped non-HTTP n8n node(s) (not mapped to canvas); wire manually if needed: "
            + shown
        )

    filtered_wf = dict(wf)
    filtered_wf["nodes"] = http_nodes
    hints, hint_warnings = ordered_http_hints_from_http_only_workflow(filtered_wf)
    warnings.extend(hint_warnings)
    branch_slices = analyze_n8n_branch_slices(wf)
    transform_hints = transform_hints_from_workflow(wf)

    if hints:
        body = agent_prompt_addon_from_http_hints(hints)
    else:
        body = (
            "This n8n export listed no HTTP Request nodes. Add HTTP API tools manually "
            "and describe when to call them in this prompt."
        )
        warnings.append("No HTTP Request–style nodes detected after filtering.")

    if transform_hints:
        body += "\n\n" + agent_prompt_addon_from_transform_hints(transform_hints)
        warnings.append(
            f"Summarized {len(transform_hints)} n8n Set/Code/Merge node(s) as "
            "template-variable hints (manual wiring in editor)."
        )

    if branch_slices:
        body += _branch_routing_prompt_addon(
            branch_slices, subflows_emitted=emit_branch_subflows
        )
        if emit_branch_subflows:
            warnings.append(
                f"Mapped {len(branch_slices)} n8n IF/Switch branch(es) to Dograh subflow(s): "
                + ", ".join(sl.subflow_key for sl in branch_slices)
                + ". Review transition conditions on the main agent."
            )
        else:
            warnings.append(
                f"Detected {len(branch_slices)} n8n IF/Switch branch(es); "
                "subflow emit disabled — branch summary is prompt-only."
            )

    graph = _minimal_import_shell_graph(agent_prompt_body=body)
    if branch_slices and emit_branch_subflows:
        graph = _attach_branch_subflows(graph, wf, branch_slices)

    return graph, warnings


def draft_packaged_workflow_from_n8n_http_only(
    wf: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    """Strict alias: reject exports that contain any non-HTTP n8n node."""
    return draft_packaged_workflow_from_n8n(wf, strict_http_only=True)
