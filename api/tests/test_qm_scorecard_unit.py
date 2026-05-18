"""Unit tests: QM scorecard rubric + call grid."""

from api.services.analytics.qm_scorecard import (
    build_call_scorecard,
    normalize_qm_scorecard_document,
    parse_criteria_from_qa_parsed,
)


def test_normalize_scorecard_requires_criteria():
    doc = normalize_qm_scorecard_document(
        {
            "v": 1,
            "criteria": [
                {"id": "greeting", "label": "Greeting"},
                {"id": "outcome_achieved", "label": "Outcome", "description": "Booked or resolved"},
            ],
        }
    )
    assert len(doc["criteria"]) == 2


def test_build_call_scorecard_pass_fail_grid():
    rubric = normalize_qm_scorecard_document(
        {
            "v": 1,
            "criteria": [
                {"id": "greeting", "label": "Greeting"},
                {"id": "tools", "label": "Tools"},
            ],
        }
    )
    annotations = {
        "node_results": {
            "n1": {
                "node_name": "QA",
                "criteria": [
                    {"criterion_id": "greeting", "pass": True, "note": "ok"},
                    {"criterion_id": "tools", "pass": False, "note": "HTTP 500"},
                ],
            }
        }
    }
    grid = build_call_scorecard(rubric=rubric, annotations=annotations)
    assert grid["summary"]["passed_count"] == 1
    assert grid["summary"]["evaluated_count"] == 2
    assert grid["criteria"][1]["pass"] is False


def test_parse_criteria_from_qa_parsed():
    rows = parse_criteria_from_qa_parsed(
        {
            "criteria": [
                {"criterion_id": "greeting", "pass": "true", "note": "fine"},
            ]
        }
    )
    assert rows[0]["pass"] is True
