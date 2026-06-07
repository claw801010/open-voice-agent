"""scripts/run_all_buyer_demos.sh dry-run stays aligned with buyer-demo-defaults."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "run_all_buyer_demos.sh"
DEFAULTS = REPO / "catalog" / "buyer-demo-defaults.json"


def test_run_all_buyer_demos_dry_run_lists_all_slugs() -> None:
    proc = subprocess.run(
        [str(SCRIPT)],
        cwd=REPO,
        capture_output=True,
        text=True,
        env={**os.environ, "BUYER_DEMO_SKIP_CHECK": "1"},
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    defaults = json.loads(DEFAULTS.read_text(encoding="utf-8"))["defaults"]
    for slug in defaults:
        assert slug in proc.stdout, f"dry run missing slug {slug}"
