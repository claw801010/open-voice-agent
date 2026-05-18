"""Zapier Zap export helpers (MK-01-IMPORT-OPTIONS) — Dograh import subset.

Accepts a documented JSON shape with a top-level ``steps`` array (see
``catalog/fixtures/zapier-*.json``), or platform-style ``nodes`` / ``zap.nodes`` maps
coerced via ``normalize_zapier_export``. Not a full Zapier platform export parser.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from api.utils.n8n_workflow_adapter import agent_prompt_addon_from_http_hints
from api.utils.packaged_import_shell import minimal_packaged_voice_graph


class ZapierZapExportError(ValueError):
    """Raised when JSON is not a usable Zapier import-subset export."""


class ZapierUnsupportedStepsError(ZapierZapExportError):
    """Raised when the export contains steps outside the strict import subset."""


def _steps_from_nodes_object(nodes: dict[str, Any]) -> list[dict[str, Any]]:
    """Coerce Zapier platform-style ``nodes`` map into a ``steps`` list."""
    steps: list[dict[str, Any]] = []
    for key, node in nodes.items():
        if not isinstance(node, dict):
            continue
        step = dict(node)
        if step.get("id") is None and str(key).isdigit():
            step["id"] = int(key)
        elif step.get("id") is None:
            step["id"] = key
        steps.append(step)
    return steps


def normalize_zapier_export(data: Any) -> dict[str, Any]:
    """
    Accept Dograh subset JSON (``steps[]``), ``zap.steps``, or platform-style ``nodes`` map.
    """
    if not isinstance(data, dict):
        raise ZapierZapExportError(
            'Expected a JSON object with a "steps" array (or zap.steps / nodes map).'
        )

    if isinstance(data.get("steps"), list):
        return data

    inner = data.get("zap")
    if isinstance(inner, dict):
        if isinstance(inner.get("steps"), list):
            return inner
        nodes = inner.get("nodes")
        if isinstance(nodes, dict):
            steps = _steps_from_nodes_object(nodes)
            if steps:
                return {"title": inner.get("title") or data.get("title"), "steps": steps}

    nodes = data.get("nodes")
    if isinstance(nodes, dict):
        steps = _steps_from_nodes_object(nodes)
        if steps:
            return {"title": data.get("title") or data.get("name"), "steps": steps}

    raise ZapierZapExportError(
        'Expected a JSON object with a "steps" array (or zap.steps / nodes map).'
    )


def validate_zapier_export_structure(zap: dict[str, Any]) -> None:
    steps = zap.get("steps")
    if not isinstance(steps, list):
        raise ZapierZapExportError('Missing or invalid "steps" array.')


def parse_zapier_export_bytes(raw: bytes) -> dict[str, Any]:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ZapierZapExportError("Invalid JSON.") from e
    zap = normalize_zapier_export(data)
    validate_zapier_export_structure(zap)
    return zap


def _step_key(step: dict[str, Any]) -> str:
    app = str(step.get("app") or step.get("selected_api") or "").lower()
    action = str(step.get("action") or "").lower()
    return f"{app}:{action}"


def _step_title(step: dict[str, Any]) -> str:
    for key in ("title", "name", "label"):
        v = step.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    sid = step.get("id")
    return f"Step {sid}" if sid is not None else "(unnamed)"


def _step_params(step: dict[str, Any]) -> dict[str, Any]:
    p = step.get("params")
    if isinstance(p, dict):
        return p
    p = step.get("input")
    return p if isinstance(p, dict) else {}


def _is_trigger_step(step: Any) -> bool:
    if not isinstance(step, dict):
        return False
    st = str(step.get("step_type") or step.get("type") or "").lower()
    return st == "trigger" or "trigger" in _step_key(step)


def _is_http_step(step: Any) -> bool:
    if not isinstance(step, dict):
        return False
    key = _step_key(step)
    if "webhook" in key and any(x in key for x in ("post", "get", "put", "custom")):
        return True
    params = _step_params(step)
    return isinstance(params.get("url"), str) and bool(params.get("url").strip())


def _is_code_step(step: Any) -> bool:
    if not isinstance(step, dict):
        return False
    key = _step_key(step)
    return "code" in key or "run_javascript" in key or "run_python" in key


def _is_formatter_step(step: Any) -> bool:
    if not isinstance(step, dict):
        return False
    key = _step_key(step)
    return "formatter" in key or "filter" in key and "branch" not in key


def _is_paths_step(step: Any) -> bool:
    if not isinstance(step, dict):
        return False
    st = str(step.get("step_type") or step.get("type") or "").lower()
    if st in ("branch", "paths", "path"):
        return True
    branches = step.get("branches")
    return isinstance(branches, list) and len(branches) >= 2


def _is_supported_strict_step(step: Any) -> bool:
    return _is_http_step(step) or _is_paths_step(step)


def _walk_steps(steps: list[Any]) -> Iterator[dict[str, Any]]:
    for item in steps:
        if not isinstance(item, dict):
            continue
        yield item
        branches = item.get("branches")
        if isinstance(branches, list):
            for branch in branches:
                if not isinstance(branch, dict):
                    continue
                nested = branch.get("steps")
                if isinstance(nested, list):
                    yield from _walk_steps(nested)


def iter_zapier_steps(zap: dict[str, Any]) -> list[dict[str, Any]]:
    steps = zap.get("steps")
    if not isinstance(steps, list):
        return []
    return list(_walk_steps(steps))


def summarize_http_step(step: dict[str, Any]) -> dict[str, Any]:
    params = _step_params(step)
    method = str(params.get("method") or params.get("http_method") or "POST").upper()[:16]
    url = params.get("url")
    if not isinstance(url, str):
        url = str(url) if url is not None else ""
    url_preview = url if len(url) <= 240 else f"{url[:240]}…"
    return {
        "n8nNodeName": _step_title(step),
        "type": _step_key(step),
        "method": method,
        "urlPreview": url_preview,
        "mappingHint": "Map to HTTP tool: Method + URL + body templates.",
    }


def summarize_code_step(step: dict[str, Any]) -> dict[str, Any]:
    params = _step_params(step)
    code = params.get("code") or params.get("javascript") or params.get("python") or ""
    if not isinstance(code, str):
        code = str(code)
    preview = code.replace("\n", " ").strip()
    if len(preview) > 200:
        preview = f"{preview[:200]}…"
    lang = "python" if "python" in _step_key(step) else "javascript"
    return {
        "n8nNodeName": _step_title(step),
        "kind": "code",
        "language": lang,
        "codePreview": preview,
        "mappingHint": "Refactor Code by Zapier logic into agent instructions or HTTP tools.",
    }


def summarize_formatter_step(step: dict[str, Any]) -> dict[str, Any]:
    return {
        "n8nNodeName": _step_title(step),
        "kind": "formatter",
        "mappingHint": "Map formatter output fields to {{template}} variables manually.",
    }


def http_hints_from_zap(zap: dict[str, Any]) -> list[dict[str, Any]]:
    return [summarize_http_step(s) for s in iter_zapier_steps(zap) if _is_http_step(s)]


def code_hints_from_zap(zap: dict[str, Any]) -> list[dict[str, Any]]:
    return [summarize_code_step(s) for s in iter_zapier_steps(zap) if _is_code_step(s)]


def agent_prompt_addon_from_code_hints(hints: list[dict[str, Any]]) -> str:
    lines = ["", "Zapier Code steps (not executed in voice runtime):"]
    for i, h in enumerate(hints, start=1):
        nm = h.get("n8nNodeName") or "(unnamed)"
        lang = h.get("language") or "?"
        preview = h.get("codePreview") or ""
        lines.append(f'{i}. "{nm}" ({lang}) — {preview or "(empty)"}')
    lines.append(str(hints[0].get("mappingHint") if hints else ""))
    return "\n".join(lines).strip()


@dataclass(frozen=True)
class ZapierBranchSlice:
    paths_title: str
    branch_index: int
    branch_label: str
    subflow_key: str
    http_step_titles: tuple[str, ...]


def _slugify_zap_subflow(paths_title: str, label: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "_", paths_title.strip()).strip("_").lower() or "paths"
    lab = re.sub(r"[^a-zA-Z0-9]+", "_", label.strip()).strip("_").lower() or "branch"
    return f"zap_{base}_{lab}"[:48]


def analyze_zapier_paths_slices(zap: dict[str, Any]) -> list[ZapierBranchSlice]:
    slices: list[ZapierBranchSlice] = []
    used: set[str] = set()
    steps = zap.get("steps")
    if not isinstance(steps, list):
        return slices

    for step in steps:
        if not isinstance(step, dict) or not _is_paths_step(step):
            continue
        paths_title = _step_title(step)
        branches = step.get("branches")
        if not isinstance(branches, list) or len(branches) < 2:
            continue
        for idx, branch in enumerate(branches):
            if not isinstance(branch, dict):
                continue
            label = (
                str(branch.get("title") or branch.get("name") or f"path_{idx}").strip()
                or f"path_{idx}"
            )
            nested = branch.get("steps")
            http_titles = tuple(
                _step_title(s)
                for s in _walk_steps(nested if isinstance(nested, list) else [])
                if _is_http_step(s)
            )
            key = _slugify_zap_subflow(paths_title, label)
            n = 0
            while key in used:
                n += 1
                key = _slugify_zap_subflow(f"{paths_title}_{n}", label)
            used.add(key)
            slices.append(
                ZapierBranchSlice(
                    paths_title=paths_title,
                    branch_index=idx,
                    branch_label=label,
                    subflow_key=key,
                    http_step_titles=http_titles,
                )
            )
    return slices


def _http_hints_for_titles(zap: dict[str, Any], titles: tuple[str, ...]) -> list[dict[str, Any]]:
    if not titles:
        return []
    title_set = frozenset(titles)
    return [
        summarize_http_step(s)
        for s in iter_zapier_steps(zap)
        if _is_http_step(s) and _step_title(s) in title_set
    ]


def _branch_prompt_addon(slices: list[ZapierBranchSlice], *, subflows_emitted: bool) -> str:
    lines = ["", "Zapier Paths branching:"]
    for sl in slices:
        http_list = (
            ", ".join(f'"{t}"' for t in sl.http_step_titles)
            if sl.http_step_titles
            else "(no HTTP steps on this path)"
        )
        if subflows_emitted:
            lines.append(
                f'- Subflow "{sl.subflow_key}" — paths "{sl.paths_title}" '
                f'**{sl.branch_label}**: {http_list}'
            )
        else:
            lines.append(f'- Paths "{sl.paths_title}" **{sl.branch_label}**: {http_list}')
    if subflows_emitted:
        lines.append(
            "Use the matching **Run subgraph first** transition when the caller matches that path."
        )
    return "\n".join(lines).strip()


def _attach_paths_subflows(
    graph: dict[str, Any], zap: dict[str, Any], slices: list[ZapierBranchSlice]
) -> dict[str, Any]:
    subflows: dict[str, Any] = {}
    for sl in slices:
        hints = _http_hints_for_titles(zap, sl.http_step_titles)
        body = (
            agent_prompt_addon_from_http_hints(hints)
            if hints
            else (
                f'Path "{sl.branch_label}" from Zapier Paths "{sl.paths_title}" has no HTTP '
                "steps. Add tools in this subflow if needed."
            )
        )
        subflows[sl.subflow_key] = minimal_packaged_voice_graph(
            agent_prompt_body=body,
            id_prefix=f"sf-{sl.subflow_key}"[:40],
            agent_name=f"Path {sl.branch_label}",
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
                "condition": "When complete without a Paths subflow",
            },
        }
    )
    for i, sl in enumerate(slices):
        edges.append(
            {
                "id": f"e-import-path-{i}",
                "source": agent_id,
                "target": end_id,
                "data": {
                    "label": f"Path {sl.branch_label}",
                    "condition": (
                        f'When the caller matches Zapier path "{sl.branch_label}" '
                        f'under "{sl.paths_title}"'
                    ),
                    "enter_subflow": sl.subflow_key,
                },
            }
        )
    out = dict(graph)
    out["edges"] = edges
    out["subflows"] = subflows
    return out


def _step_label(step: dict[str, Any]) -> str:
    return f'"{_step_title(step)}" ({_step_key(step)})'


def _skipped_step_labels(steps: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for s in steps:
        if _is_trigger_step(s):
            continue
        if _is_http_step(s) or _is_paths_step(s) or _is_code_step(s) or _is_formatter_step(s):
            continue
        out.append(_step_label(s))
    return out


def _strict_unsupported_labels(steps: list[dict[str, Any]]) -> list[str]:
    return [_step_label(s) for s in steps if not _is_supported_strict_step(s) and not _is_trigger_step(s)]


def draft_packaged_workflow_from_zapier(
    zap: dict[str, Any],
    *,
    strict_http_only: bool = False,
    emit_paths_subflows: bool = True,
) -> tuple[dict[str, Any], list[str]]:
    """Build a minimal Dograh workflow_definition from a Zapier import-subset export."""
    validate_zapier_export_structure(zap)
    warnings: list[str] = []
    steps = iter_zapier_steps(zap)
    if not steps:
        raise ZapierZapExportError("Zap export has no steps.")

    http_steps = [s for s in steps if _is_http_step(s)]
    if not http_steps:
        raise ZapierZapExportError(
            "Zap export has no HTTP/Webhooks steps with a url in params."
        )

    if strict_http_only:
        bad = _strict_unsupported_labels(steps)
        if bad:
            raise ZapierUnsupportedStepsError(
                "Zapier strict import supports HTTP and Paths steps only. Unsupported: "
                + "; ".join(bad[:8])
                + (f" … (+{len(bad) - 8} more)" if len(bad) > 8 else "")
            )

    skipped = _skipped_step_labels(steps)
    if skipped and not strict_http_only:
        shown = "; ".join(skipped[:8])
        if len(skipped) > 8:
            shown += f" … (+{len(skipped) - 8} more)"
        warnings.append("Skipped Zapier step(s) not mapped to canvas: " + shown)

    if any(_is_trigger_step(s) for s in steps):
        warnings.append(
            "Zap trigger step(s) are not mapped — configure Start / Trigger in the editor."
        )

    hints = http_hints_from_zap(zap)
    code_hints = code_hints_from_zap(zap)
    path_slices = analyze_zapier_paths_slices(zap)

    body = agent_prompt_addon_from_http_hints(hints) if hints else ""
    if code_hints:
        body += "\n\n" + agent_prompt_addon_from_code_hints(code_hints)
        warnings.append(f"Summarized {len(code_hints)} Zapier Code step(s) as prompt hints.")

    if path_slices:
        body += "\n\n" + _branch_prompt_addon(path_slices, subflows_emitted=emit_paths_subflows)
        if emit_paths_subflows:
            warnings.append(
                f"Mapped {len(path_slices)} Zapier Paths branch(es) to subflow(s): "
                + ", ".join(sl.subflow_key for sl in path_slices)
            )

    graph = minimal_packaged_voice_graph(agent_prompt_body=body.strip())
    if path_slices and emit_paths_subflows:
        graph = _attach_paths_subflows(graph, zap, path_slices)

    return graph, warnings
