"""Call AI review heuristics (no LLM)."""

from api.services.analytics.call_review_ai import heuristic_review
from api.services.analytics.call_transcript import transcript_from_logs


def test_transcript_from_logs_empty():
    assert transcript_from_logs({}) == ""


def test_heuristic_review_with_outcomes():
    review = heuristic_review(
        call_id="wr-1",
        transcript="[t] user: hello\n[t] assistant: hi\n",
        outcomes={"outcome_key": "booked"},
        tool_spans=[{"tool_name": "book_slot"}],
    )
    assert "wr-1" in review["summary"]
    assert "booked" in review["outcome_analysis"]
    assert review["recommendations"]


def test_heuristic_suggests_tools_when_missing():
    review = heuristic_review(
        call_id="wr-2",
        transcript="",
        outcomes={},
        tool_spans=[],
    )
    titles = " ".join(r["title"] for r in review["recommendations"])
    assert "HTTP" in titles or "outcome" in titles.lower()
