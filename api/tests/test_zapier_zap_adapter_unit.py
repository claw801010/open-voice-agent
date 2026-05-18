"""Unit tests: Zapier import-subset adapter (MK-01-IMPORT-OPTIONS)."""

import json
from pathlib import Path

import pytest

from api.services.workflow.dto import ReactFlowDTO
from api.services.workflow.workflow import WorkflowGraph
from api.utils.skill_packaged_adapter import suggest_template_variables_from_markdown
from api.utils.zapier_zap_adapter import (
    ZapierUnsupportedStepsError,
    ZapierZapExportError,
    analyze_zapier_paths_slices,
    draft_packaged_workflow_from_zapier,
    http_hints_from_zap,
    normalize_zapier_export,
    parse_zapier_export_bytes,
)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE_LINEAR = _REPO_ROOT / "catalog" / "fixtures" / "zapier-webhook-code-http.json"
_FIXTURE_PATHS = _REPO_ROOT / "catalog" / "fixtures" / "zapier-paths-two-http.json"
_FIXTURE_PLATFORM_NODES = _REPO_ROOT / "catalog" / "fixtures" / "zapier-platform-nodes-map.json"


def test_normalize_platform_nodes_map():
    raw = json.loads(_FIXTURE_PLATFORM_NODES.read_text(encoding="utf-8"))
    zap = normalize_zapier_export(raw)
    assert isinstance(zap.get("steps"), list)
    assert len(zap["steps"]) == 2
    parsed = parse_zapier_export_bytes(_FIXTURE_PLATFORM_NODES.read_bytes())
    hints = http_hints_from_zap(parsed)
    assert len(hints) == 1
    assert hints[0]["method"] == "POST"


def test_parse_http_hints():
    zap = parse_zapier_export_bytes(_FIXTURE_LINEAR.read_bytes())
    hints = http_hints_from_zap(zap)
    assert len(hints) == 1
    assert hints[0]["method"] == "POST"
    assert "httpbin" in hints[0]["urlPreview"]


def test_draft_includes_code_hints():
    zap = parse_zapier_export_bytes(_FIXTURE_LINEAR.read_bytes())
    draft, warns = draft_packaged_workflow_from_zapier(zap)
    prompt = next(n for n in draft["nodes"] if n["type"] == "agentNode")["data"]["prompt"]
    assert "Normalize payload" in prompt
    assert any("Code step" in w for w in warns)
    assert any("trigger" in w.lower() for w in warns)


def test_paths_slices_and_subflows():
    zap = parse_zapier_export_bytes(_FIXTURE_PATHS.read_bytes())
    slices = analyze_zapier_paths_slices(zap)
    assert len(slices) == 2
    draft, warns = draft_packaged_workflow_from_zapier(zap)
    assert len(draft.get("subflows", {})) == 2
    WorkflowGraph(ReactFlowDTO.model_validate(draft))
    assert any("subflow" in w.lower() for w in warns)


def test_strict_rejects_code_step():
    zap = parse_zapier_export_bytes(_FIXTURE_LINEAR.read_bytes())
    with pytest.raises(ZapierUnsupportedStepsError, match="Unsupported"):
        draft_packaged_workflow_from_zapier(zap, strict_http_only=True)


def test_no_http_raises():
    zap = parse_zapier_export_bytes(_FIXTURE_LINEAR.read_bytes())
    zap = dict(zap)
    zap["steps"] = [zap["steps"][0], zap["steps"][1]]
    with pytest.raises(ZapierZapExportError, match="no HTTP"):
        draft_packaged_workflow_from_zapier(zap)


def test_suggest_template_vars_from_skill_fixture():
    md = (_REPO_ROOT / "catalog" / "fixtures" / "skill-booking-draft.sample.md").read_text()
    vars_ = suggest_template_variables_from_markdown(md)
    assert "patient_name" in vars_
    assert "timezone" in vars_
