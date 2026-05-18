"""Unit tests for QA prompt hint builder."""

from api.services.analytics.qm_scorecard import build_qa_criteria_prompt_hint, normalize_qm_scorecard_document


def test_build_qa_criteria_prompt_hint_lists_ids():
    rubric = normalize_qm_scorecard_document(
        {"v": 1, "criteria": [{"id": "greeting", "label": "Greeting"}]}
    )
    hint = build_qa_criteria_prompt_hint(rubric)
    assert "greeting" in hint
    assert "criteria" in hint
