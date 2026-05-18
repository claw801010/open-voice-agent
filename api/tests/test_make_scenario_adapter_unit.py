"""Unit tests: Make scenario blueprint adapter (MK-01-IMPORT-OPTIONS)."""

import json
from pathlib import Path

import pytest

from api.services.workflow.dto import ReactFlowDTO
from api.services.workflow.workflow import WorkflowGraph
from api.utils.make_scenario_adapter import (
    MakeScenarioExportError,
    MakeUnsupportedModulesError,
    analyze_make_router_slices,
    draft_packaged_workflow_from_make,
    http_hints_from_blueprint,
    parse_make_blueprint_bytes,
    set_hints_from_blueprint,
)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE_ROUTER = _REPO_ROOT / "catalog" / "fixtures" / "make-router-two-http.json"
_FIXTURE_SET = _REPO_ROOT / "catalog" / "fixtures" / "make-set-http.json"


def test_parse_fixture_http_hints():
    bp = parse_make_blueprint_bytes(_FIXTURE_SET.read_bytes())
    hints = http_hints_from_blueprint(bp)
    assert len(hints) == 1
    assert hints[0]["method"] == "POST"
    assert "httpbin.org" in hints[0]["urlPreview"]


def test_set_hints_extract_variables():
    bp = parse_make_blueprint_bytes(_FIXTURE_SET.read_bytes())
    hints = set_hints_from_blueprint(bp)
    assert len(hints) == 1
    names = {f["name"] for f in hints[0]["fields"]}
    assert "customer_id" in names
    assert "timezone" in names


def test_router_slices_detect_two_routes():
    bp = parse_make_blueprint_bytes(_FIXTURE_ROUTER.read_bytes())
    slices = analyze_make_router_slices(bp)
    assert len(slices) == 2
    keys = {s.subflow_key for s in slices}
    assert "make_route_booking_route_0" in keys
    assert "make_route_booking_route_1" in keys


def test_draft_router_emits_subflows():
    bp = parse_make_blueprint_bytes(_FIXTURE_ROUTER.read_bytes())
    draft, warns = draft_packaged_workflow_from_make(bp)
    assert len(draft.get("subflows", {})) == 2
    assert any("subflow" in w.lower() for w in warns)
    branch_edges = [e for e in draft["edges"] if e.get("data", {}).get("enter_subflow")]
    assert len(branch_edges) == 2
    WorkflowGraph(ReactFlowDTO.model_validate(draft))


def test_draft_set_in_prompt_not_skipped():
    bp = parse_make_blueprint_bytes(_FIXTURE_SET.read_bytes())
    draft, warns = draft_packaged_workflow_from_make(bp)
    prompt = next(n for n in draft["nodes"] if n["type"] == "agentNode")["data"]["prompt"]
    assert "Shape payload" in prompt
    assert "customer_id" in prompt
    assert any("Set variable" in w for w in warns)
    assert not any("Skipped" in w and "Shape payload" in w for w in warns)


def test_invalid_json_raises():
    with pytest.raises(MakeScenarioExportError, match="Invalid JSON"):
        parse_make_blueprint_bytes(b"{")


def test_strict_rejects_set_module():
    bp = parse_make_blueprint_bytes(_FIXTURE_SET.read_bytes())
    with pytest.raises(MakeUnsupportedModulesError, match="Unsupported"):
        draft_packaged_workflow_from_make(bp, strict_http_only=True)


def test_draft_skips_unknown_modules_lenient():
    bp = json.loads(_FIXTURE_SET.read_text(encoding="utf-8"))
    bp["flow"].append(
        {
            "id": 99,
            "module": "slack:ActionCreateMessage",
            "mapper": {},
            "metadata": {"designer": {"name": "Slack notify"}},
        }
    )
    _, warns = draft_packaged_workflow_from_make(bp)
    assert any("Skipped" in w and "Slack" in w for w in warns)
