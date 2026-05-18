"""Make.com scenario blueprint helpers (MK-01-IMPORT-OPTIONS).

Structural validation and HTTP / Set / Router summaries for packaged voice-graph drafts.
Complements ``catalog/scripts/validate-make-blueprint.mjs``.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from api.utils.n8n_workflow_adapter import agent_prompt_addon_from_http_hints


class MakeScenarioExportError(ValueError):
    """Raised when JSON is not a usable Make scenario blueprint."""


class MakeUnsupportedModulesError(MakeScenarioExportError):
    """Raised when the blueprint contains modules outside the strict import subset."""


def normalize_make_export(data: Any) -> dict[str, Any]:
    if isinstance(data, dict):
        return data
    raise MakeScenarioExportError("Expected a Make scenario blueprint JSON object.")


def validate_make_blueprint_structure(bp: dict[str, Any]) -> None:
    flow = bp.get("flow")
    if not isinstance(flow, list):
        raise MakeScenarioExportError(
            'Missing or invalid top-level "flow" array (not a Make scenario blueprint?).'
        )


def parse_make_blueprint_bytes(raw: bytes) -> dict[str, Any]:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise MakeScenarioExportError("Invalid JSON.") from e
    bp = normalize_make_export(data)
    validate_make_blueprint_structure(bp)
    return bp


def _module_uri(mod: dict[str, Any]) -> str:
    return str(mod.get("module") or "").lower()


def _module_display_name(mod: dict[str, Any]) -> str:
    meta = mod.get("metadata")
    if isinstance(meta, dict):
        designer = meta.get("designer")
        if isinstance(designer, dict):
            name = designer.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()
    mid = mod.get("id")
    return f"Module {mid}" if mid is not None else "(unnamed)"


def _is_http_module(mod: Any) -> bool:
    if not isinstance(mod, dict):
        return False
    uri = _module_uri(mod)
    return uri.startswith("http:") or "actionsenddata" in uri


def _is_router_module(mod: Any) -> bool:
    if not isinstance(mod, dict):
        return False
    return "router" in _module_uri(mod)


def _is_set_module(mod: Any) -> bool:
    if not isinstance(mod, dict):
        return False
    uri = _module_uri(mod)
    return uri.startswith("util:set") or "setvariable" in uri


def _is_supported_strict_module(mod: Any) -> bool:
    return _is_http_module(mod) or _is_router_module(mod)


def _walk_flow(flow: list[Any]) -> Iterator[dict[str, Any]]:
    for item in flow:
        if not isinstance(item, dict):
            continue
        yield item
        routes = item.get("routes")
        if isinstance(routes, list):
            for route in routes:
                if not isinstance(route, dict):
                    continue
                nested = route.get("flow")
                if isinstance(nested, list):
                    yield from _walk_flow(nested)


def iter_make_modules(bp: dict[str, Any]) -> list[dict[str, Any]]:
    flow = bp.get("flow")
    if not isinstance(flow, list):
        return []
    return list(_walk_flow(flow))


def _preview_scalar(value: Any, *, max_len: int = 96) -> str:
    if value is None:
        return ""
    s = str(value).replace("\n", " ").strip()
    if len(s) > max_len:
        return f"{s[:max_len]}…"
    return s


def summarize_http_module(mod: dict[str, Any]) -> dict[str, Any]:
    mapper = mod.get("mapper") if isinstance(mod.get("mapper"), dict) else {}
    method = str(mapper.get("method") or "GET").upper()[:16]
    url = mapper.get("url")
    if not isinstance(url, str):
        url = str(url) if url is not None else ""
    url_preview = url if len(url) <= 240 else f"{url[:240]}…"
    return {
        "n8nNodeName": _module_display_name(mod),
        "type": mod.get("module") or "",
        "method": method,
        "urlPreview": url_preview,
        "mappingHint": (
            "Map to HTTP tool: set Method + URL; move body/query fields to "
            "body_template or URL templates."
        ),
    }


def summarize_set_module(mod: dict[str, Any]) -> dict[str, Any]:
    mapper = mod.get("mapper") if isinstance(mod.get("mapper"), dict) else {}
    fields: list[dict[str, str]] = []
    variables = mapper.get("variables")
    if isinstance(variables, list):
        for v in variables[:24]:
            if isinstance(v, dict) and v.get("name"):
                fields.append(
                    {
                        "name": str(v["name"]),
                        "valuePreview": _preview_scalar(v.get("value")),
                    }
                )
    return {
        "n8nNodeName": _module_display_name(mod),
        "kind": "set",
        "fields": fields,
        "mappingHint": (
            "Map variables to template {{var}} keys or call-context test JSON paths."
        ),
    }


def http_hints_from_blueprint(bp: dict[str, Any]) -> list[dict[str, Any]]:
    return [summarize_http_module(m) for m in iter_make_modules(bp) if _is_http_module(m)]


def set_hints_from_blueprint(bp: dict[str, Any]) -> list[dict[str, Any]]:
    return [summarize_set_module(m) for m in iter_make_modules(bp) if _is_set_module(m)]


def agent_prompt_addon_from_set_hints(hints: list[dict[str, Any]]) -> str:
    lines = [
        "",
        "Make Set variable modules (map to template variables — not auto-wired):",
    ]
    for i, h in enumerate(hints, start=1):
        nm = h.get("n8nNodeName") or "(unnamed)"
        fields = h.get("fields") or []
        if fields:
            bits = ", ".join(
                f'{f.get("name")}={f.get("valuePreview")!r}'[:80] for f in fields[:6]
            )
            if len(fields) > 6:
                bits += f" … (+{len(fields) - 6} more)"
        else:
            bits = "(no variables parsed — open in Make UI)"
        lines.append(f'{i}. Set "{nm}" — {bits}')
    lines.append(
        "Map Set fields to {{template}} variables in the editor; they are not executed "
        "in voice runtime."
    )
    return "\n".join(lines).strip()


@dataclass(frozen=True)
class MakeBranchSlice:
    router_name: str
    route_index: int
    route_label: str
    subflow_key: str
    http_module_names: tuple[str, ...]


def _slugify_make_subflow_key(router_name: str, route_label: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "_", router_name.strip()).strip("_").lower() or "router"
    return f"make_{base}_{route_label}"[:48]


def analyze_make_router_slices(bp: dict[str, Any]) -> list[MakeBranchSlice]:
    slices: list[MakeBranchSlice] = []
    used_keys: set[str] = set()
    flow = bp.get("flow")
    if not isinstance(flow, list):
        return slices

    for mod in flow:
        if not isinstance(mod, dict) or not _is_router_module(mod):
            continue
        router_name = _module_display_name(mod)
        routes = mod.get("routes")
        if not isinstance(routes, list) or len(routes) < 2:
            continue
        for idx, route in enumerate(routes):
            if not isinstance(route, dict):
                continue
            nested = route.get("flow")
            if not isinstance(nested, list):
                nested = []
            http_names = tuple(
                _module_display_name(m) for m in _walk_flow(nested) if _is_http_module(m)
            )
            label = f"route_{idx}"
            key = _slugify_make_subflow_key(router_name, label)
            n = 0
            while key in used_keys:
                n += 1
                key = _slugify_make_subflow_key(f"{router_name}_{n}", label)
            used_keys.add(key)
            slices.append(
                MakeBranchSlice(
                    router_name=router_name,
                    route_index=idx,
                    route_label=label,
                    subflow_key=key,
                    http_module_names=http_names,
                )
            )
    return slices


def _minimal_voice_graph(
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


def _http_hints_for_module_names(
    bp: dict[str, Any], names: tuple[str, ...]
) -> list[dict[str, Any]]:
    if not names:
        return []
    name_set = frozenset(names)
    mods = [m for m in iter_make_modules(bp) if _is_http_module(m)]
    return [
        summarize_http_module(m)
        for m in mods
        if _module_display_name(m) in name_set
    ]


def _branch_routing_prompt_addon(
    slices: list[MakeBranchSlice], *, subflows_emitted: bool
) -> str:
    lines = ["", "Make Router branching:"]
    for sl in slices:
        http_list = (
            ", ".join(f'"{n}"' for n in sl.http_module_names)
            if sl.http_module_names
            else "(no HTTP modules on this route)"
        )
        if subflows_emitted:
            lines.append(
                f'- Subflow "{sl.subflow_key}" — router "{sl.router_name}" '
                f"**{sl.route_label}**: {http_list}"
            )
        else:
            lines.append(
                f'- Router "{sl.router_name}" **{sl.route_label}**: {http_list}'
            )
    if subflows_emitted:
        lines.append(
            "Use the matching **Run subgraph first** transition when the caller matches "
            "that route; finish HTTP tools inside the subflow."
        )
    return "\n".join(lines).strip()


def _attach_router_subflows(
    graph: dict[str, Any], bp: dict[str, Any], slices: list[MakeBranchSlice]
) -> dict[str, Any]:
    subflows: dict[str, Any] = {}
    for sl in slices:
        hints = _http_hints_for_module_names(bp, sl.http_module_names)
        if hints:
            body = agent_prompt_addon_from_http_hints(hints)
        else:
            body = (
                f'Route "{sl.route_label}" from Make router "{sl.router_name}" has no '
                "HTTP modules. Add tools here if this path needs integrations."
            )
        subflows[sl.subflow_key] = _minimal_voice_graph(
            agent_prompt_body=body,
            id_prefix=f"sf-{sl.subflow_key}"[:40],
            agent_name=f"Route {sl.route_index}",
        )

    agent_id = "n-import-agent"
    end_id = "n-import-end"
    edges = [e for e in graph.get("edges", []) if e.get("source") != agent_id]
    edges.append(
        {
            "id": "e-import-end-default",
            "source": agent_id,
            "target": end_id,
            "data": {
                "label": "End",
                "condition": "When the conversation is complete without a route subflow",
            },
        }
    )
    for i, sl in enumerate(slices):
        edges.append(
            {
                "id": f"e-import-route-{i}",
                "source": agent_id,
                "target": end_id,
                "data": {
                    "label": f"Route {sl.route_index}",
                    "condition": (
                        f"When the caller matches Make router "
                        f'"{sl.router_name}" route {sl.route_index}'
                    ),
                    "enter_subflow": sl.subflow_key,
                },
            }
        )
    out = dict(graph)
    out["edges"] = edges
    out["subflows"] = subflows
    return out


def _module_label(mod: dict[str, Any]) -> str:
    return f'"{_module_display_name(mod)}" ({mod.get("module") or "?"})'


def _skipped_module_labels(modules: list[dict[str, Any]]) -> list[str]:
    labels: list[str] = []
    for m in modules:
        if _is_http_module(m) or _is_router_module(m) or _is_set_module(m):
            continue
        labels.append(_module_label(m))
    return labels


def _strict_unsupported_labels(modules: list[dict[str, Any]]) -> list[str]:
    return [_module_label(m) for m in modules if not _is_supported_strict_module(m)]


def draft_packaged_workflow_from_make(
    bp: dict[str, Any],
    *,
    strict_http_only: bool = False,
    emit_route_subflows: bool = True,
) -> tuple[dict[str, Any], list[str]]:
    """
    Build a minimal Dograh ``workflow_definition`` from a Make scenario blueprint.

    Summarizes HTTP modules, Set-variable modules, and optional Router routes as subflows.
    """
    validate_make_blueprint_structure(bp)
    warnings: list[str] = []
    modules = iter_make_modules(bp)
    if not modules:
        raise MakeScenarioExportError("Make blueprint flow has no modules.")

    http_mods = [m for m in modules if _is_http_module(m)]
    if not http_mods:
        raise MakeScenarioExportError(
            "Make blueprint has no HTTP modules (module URI like http:ActionSendData)."
        )

    if strict_http_only:
        strict_bad = _strict_unsupported_labels(modules)
        if strict_bad:
            raise MakeUnsupportedModulesError(
                "Make strict import supports HTTP and Router modules only. Unsupported: "
                + "; ".join(strict_bad[:8])
                + (f" … (+{len(strict_bad) - 8} more)" if len(strict_bad) > 8 else "")
            )

    skipped = _skipped_module_labels(modules)
    if skipped and not strict_http_only:
        shown = "; ".join(skipped[:8])
        if len(skipped) > 8:
            shown += f" … (+{len(skipped) - 8} more)"
        warnings.append(
            "Skipped non-HTTP Make module(s) (not mapped to canvas); wire manually: " + shown
        )

    hints = http_hints_from_blueprint(bp)
    set_hints = set_hints_from_blueprint(bp)
    router_slices = analyze_make_router_slices(bp)

    if hints:
        body = agent_prompt_addon_from_http_hints(hints)
    else:
        body = "Add HTTP API tools manually and describe when to call them."
        warnings.append("No HTTP modules detected after filtering.")

    if set_hints:
        body += "\n\n" + agent_prompt_addon_from_set_hints(set_hints)
        warnings.append(
            f"Summarized {len(set_hints)} Make Set variable module(s) as template hints."
        )

    if router_slices:
        body += "\n\n" + _branch_routing_prompt_addon(
            router_slices, subflows_emitted=emit_route_subflows
        )
        if emit_route_subflows:
            warnings.append(
                f"Mapped {len(router_slices)} Make Router route(s) to subflow(s): "
                + ", ".join(sl.subflow_key for sl in router_slices)
            )
        else:
            warnings.append(
                f"Detected {len(router_slices)} Router route(s); subflow emit disabled."
            )

    graph = _minimal_voice_graph(agent_prompt_body=body)
    if router_slices and emit_route_subflows:
        graph = _attach_router_subflows(graph, bp, router_slices)

    return graph, warnings
