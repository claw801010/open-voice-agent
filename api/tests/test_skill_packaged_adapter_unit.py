"""Unit tests: agent skill → packaged draft (MK-01-IMPORT-OPTIONS)."""

from pathlib import Path

import pytest

from api.services.workflow.dto import ReactFlowDTO
from api.services.workflow.workflow import WorkflowGraph
from api.utils.skill_packaged_adapter import (
    SkillImportError,
    distill_skill_markdown,
    draft_packaged_workflow_from_skill,
)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE = _REPO_ROOT / "catalog" / "fixtures" / "skill-booking-draft.sample.md"


def test_distill_skill_extracts_vars_and_title():
    md = _FIXTURE.read_text(encoding="utf-8")
    prompt, vars_, warns = distill_skill_markdown(md)
    assert "Patient booking skill" in prompt
    assert "patient_name" in vars_
    assert "timezone" in vars_
    assert any("template" in w.lower() for w in warns)


def test_draft_graph_validates():
    md = _FIXTURE.read_text(encoding="utf-8")
    graph, warns, vars_ = draft_packaged_workflow_from_skill(md, skill_title="Booking")
    assert vars_
    agent = next(n for n in graph["nodes"] if n["type"] == "agentNode")
    assert "HIPAA" in agent["data"]["prompt"]
    WorkflowGraph(ReactFlowDTO.model_validate(graph))


def test_empty_skill_raises():
    with pytest.raises(SkillImportError, match="empty"):
        distill_skill_markdown("   ")
