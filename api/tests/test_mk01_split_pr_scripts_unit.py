"""MK-01 split-PR helper scripts stay aligned with planning docs."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HINTS = REPO / "scripts" / "split_mk01_pr_hints.sh"
STAGE = REPO / "scripts" / "stage_mk01_split.sh"


def test_split_mk01_pr_hints_lists_four_prs() -> None:
    text = HINTS.read_text(encoding="utf-8")
    for n in (1, 2, 3, 4):
        assert f"PR {n}" in text


def test_stage_mk01_split_script_has_all_pr_targets() -> None:
    text = STAGE.read_text(encoding="utf-8")
    for fn in ("stage_pr1", "stage_pr2", "stage_pr3", "stage_pr4"):
        assert fn in text
    assert 'case "$PR" in' in text
    assert "--dry-run" in text
