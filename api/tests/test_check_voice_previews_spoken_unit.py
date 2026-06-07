"""scripts/check_voice_previews_spoken.sh advisory gate."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "check_voice_previews_spoken.sh"


def test_check_voice_previews_spoken_advisory_exits_zero() -> None:
    proc = subprocess.run(
        [str(SCRIPT)],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "Summary:" in proc.stdout


def test_check_voice_previews_spoken_strict_fails_while_silent() -> None:
    proc = subprocess.run(
        [str(SCRIPT), "--strict"],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    if ", 0 silent" in proc.stdout:
        assert proc.returncode == 0
    else:
        assert proc.returncode == 1
        assert "silent-placeholder" in proc.stdout
