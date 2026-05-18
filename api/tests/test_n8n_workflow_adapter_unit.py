"""Unit tests: n8n export adapter (MK-01-IMPORT-OPTIONS)."""

import json
from pathlib import Path

import pytest

from api.services.workflow.dto import ReactFlowDTO
from api.services.workflow.workflow import WorkflowGraph
from api.utils.n8n_workflow_adapter import (
    N8nUnsupportedNodesError,
    N8nWorkflowExportError,
    analyze_n8n_branch_slices,
    draft_packaged_workflow_from_n8n,
    draft_packaged_workflow_from_n8n_http_only,
    http_hints_from_workflow,
    normalize_n8n_export,
    ordered_http_hints_from_http_only_workflow,
    parse_n8n_workflow_export_bytes,
    summarize_set_node,
    validate_n8n_workflow_structure,
)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE = _REPO_ROOT / "catalog" / "fixtures" / "n8n-minimal-http-request.json"
_FIXTURE_TWO_LINEAR = _REPO_ROOT / "catalog" / "fixtures" / "n8n-two-http-linear.json"
_FIXTURE_IF_BRANCHES = _REPO_ROOT / "catalog" / "fixtures" / "n8n-if-two-branches-http.json"
_FIXTURE_SET_CODE = _REPO_ROOT / "catalog" / "fixtures" / "n8n-set-code-http.json"


def test_normalize_n8n_export_accepts_array_wrapper():
    wf = normalize_n8n_export([{"nodes": [], "name": "x"}])
    assert wf["name"] == "x"


def test_validate_requires_nodes_array():
    with pytest.raises(N8nWorkflowExportError, match="nodes"):
        validate_n8n_workflow_structure({"name": "no nodes"})


def test_parse_fixture_http_hints():
    raw = _FIXTURE.read_bytes()
    wf = parse_n8n_workflow_export_bytes(raw)
    hints = http_hints_from_workflow(wf)
    assert len(hints) == 1
    assert hints[0]["method"] == "POST"
    assert "httpbin.org" in hints[0]["urlPreview"]
    assert hints[0]["n8nNodeName"] == "HTTP Request"


def test_http_hints_skip_non_httprequest_types():
    node = {"name": "X", "type": "n8n-nodes-base.set", "parameters": {}}
    assert http_hints_from_workflow({"nodes": [node]}) == []


def test_invalid_json_raises():
    with pytest.raises(N8nWorkflowExportError, match="Invalid JSON"):
        parse_n8n_workflow_export_bytes(b"not json")


def test_roundtrip_equivalence_with_json_load():
    data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    wf = normalize_n8n_export(data)
    validate_n8n_workflow_structure(wf)
    assert len(http_hints_from_workflow(wf)) == 1


def _assert_minimal_graph(data: dict) -> None:
    assert isinstance(data.get("nodes"), list) and len(data["nodes"]) >= 1
    assert isinstance(data.get("edges"), list)
    for n in data["nodes"]:
        assert n.get("id") and n.get("type")


def test_draft_packaged_workflow_http_only_fixture():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE.read_bytes())
    draft, warns = draft_packaged_workflow_from_n8n_http_only(wf)
    _assert_minimal_graph(draft)
    assert len(draft["nodes"]) == 3
    assert any(n["type"] == "agentNode" for n in draft["nodes"])
    agent = next(n for n in draft["nodes"] if n["type"] == "agentNode")
    prompt = agent["data"]["prompt"]
    assert "HTTP Request" in prompt or "httpbin" in prompt
    assert len(warns) == 0


def test_draft_rejects_non_http_nodes_strict():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE.read_bytes())
    wf = dict(wf)
    wf["nodes"] = list(wf["nodes"]) + [
        {"id": "bad", "name": "Set", "type": "n8n-nodes-base.set", "parameters": {}}
    ]
    with pytest.raises(N8nUnsupportedNodesError, match="IF/Switch|httpRequest"):
        draft_packaged_workflow_from_n8n_http_only(wf)


def test_draft_skips_non_http_nodes_lenient():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE.read_bytes())
    wf = dict(wf)
    wf["nodes"] = list(wf["nodes"]) + [
        {
            "id": "bad",
            "name": "Slack",
            "type": "n8n-nodes-base.slack",
            "parameters": {},
        }
    ]
    draft, warns = draft_packaged_workflow_from_n8n(wf, strict_http_only=False)
    _assert_minimal_graph(draft)
    assert any("Skipped non-HTTP" in w for w in warns)
    assert any("Slack" in w for w in warns)


def test_summarize_set_node_extracts_assignments():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_SET_CODE.read_bytes())
    set_node = next(n for n in wf["nodes"] if n.get("type", "").endswith(".set"))
    summary = summarize_set_node(set_node)
    names = {f["name"] for f in summary["fields"]}
    assert "customer_id" in names
    assert "timezone" in names


def test_draft_includes_set_and_code_hints_not_skip_warning():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_SET_CODE.read_bytes())
    draft, warns = draft_packaged_workflow_from_n8n(wf, strict_http_only=False)
    prompt = next(n for n in draft["nodes"] if n["type"] == "agentNode")["data"]["prompt"]
    assert "Shape payload" in prompt
    assert "Normalize slot" in prompt
    assert "customer_id" in prompt
    assert any("Set/Code/Merge" in w for w in warns)
    assert not any("Skipped non-HTTP" in w and "Shape payload" in w for w in warns)


def test_draft_strict_rejects_set_node():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_SET_CODE.read_bytes())
    with pytest.raises(N8nUnsupportedNodesError, match="IF/Switch|Unsupported"):
        draft_packaged_workflow_from_n8n_http_only(wf)


def test_draft_warns_when_connections_present():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE.read_bytes())
    wf = dict(wf)
    wf["connections"] = {"HTTP Request": {"main": [[]]}}
    draft, warns = draft_packaged_workflow_from_n8n_http_only(wf)
    assert draft["edges"]
    assert any("connections" in w.lower() for w in warns)


def test_ordered_hints_follow_n8n_connections_over_node_list_order():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_TWO_LINEAR.read_bytes())
    hints, warns = ordered_http_hints_from_http_only_workflow(wf)
    assert [h["n8nNodeName"] for h in hints] == ["Fetch A", "Fetch B"]
    assert any("topology" in w.lower() for w in warns)


def test_draft_two_http_orders_prompt_by_connections():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_TWO_LINEAR.read_bytes())
    draft, warns = draft_packaged_workflow_from_n8n_http_only(wf)
    prompt = next(n for n in draft["nodes"] if n["type"] == "agentNode")["data"]["prompt"]
    pos_a = prompt.index("Fetch A")
    pos_b = prompt.index("Fetch B")
    assert pos_a < pos_b
    assert any("topology" in w.lower() for w in warns)


def test_cycle_in_http_connections_falls_back_to_list_order():
    wf = {
        "nodes": [
            {
                "name": "A",
                "type": "n8n-nodes-base.httpRequest",
                "parameters": {"url": "https://a.example", "requestMethod": "GET"},
            },
            {
                "name": "B",
                "type": "n8n-nodes-base.httpRequest",
                "parameters": {"url": "https://b.example", "requestMethod": "GET"},
            },
        ],
        "connections": {
            "A": {"main": [[{"node": "B", "type": "main", "index": 0}]]},
            "B": {"main": [[{"node": "A", "type": "main", "index": 0}]]},
        },
    }
    hints, warns = ordered_http_hints_from_http_only_workflow(wf)
    assert [h["n8nNodeName"] for h in hints] == ["A", "B"]
    assert any("cycle" in w.lower() for w in warns)


def test_analyze_if_branches_finds_true_false_http():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_IF_BRANCHES.read_bytes())
    slices = analyze_n8n_branch_slices(wf)
    assert len(slices) == 2
    keys = {sl.subflow_key for sl in slices}
    assert "n8n_route_booking_true" in keys
    assert "n8n_route_booking_false" in keys
    by_label = {sl.output_label: sl for sl in slices}
    assert by_label["true"].http_node_names == ("Book slot",)
    assert by_label["false"].http_node_names == ("Log decline",)


def test_draft_if_branches_emit_subflows_validates():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_IF_BRANCHES.read_bytes())
    draft, warns = draft_packaged_workflow_from_n8n(wf)
    assert "subflows" in draft
    assert len(draft["subflows"]) == 2
    assert any("subflow" in w.lower() for w in warns)
    agent = next(n for n in draft["nodes"] if n["type"] == "agentNode")
    assert "n8n_route_booking_true" in agent["data"]["prompt"]
    branch_edges = [
        e
        for e in draft["edges"]
        if e.get("data", {}).get("enter_subflow")
    ]
    assert len(branch_edges) == 2
    wg = WorkflowGraph(ReactFlowDTO.model_validate(draft))
    assert len(wg.subflow_graphs) == 2


def test_draft_if_branches_prompt_only_when_emit_disabled():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_IF_BRANCHES.read_bytes())
    draft, warns = draft_packaged_workflow_from_n8n(wf, emit_branch_subflows=False)
    assert "subflows" not in draft
    assert any("subflow emit disabled" in w for w in warns)
    assert any("n8n branching" in n["data"]["prompt"] for n in draft["nodes"] if n["type"] == "agentNode")


def test_strict_if_and_http_allowed():
    wf = parse_n8n_workflow_export_bytes(_FIXTURE_IF_BRANCHES.read_bytes())
    draft, _ = draft_packaged_workflow_from_n8n_http_only(wf)
    assert draft["subflows"]
