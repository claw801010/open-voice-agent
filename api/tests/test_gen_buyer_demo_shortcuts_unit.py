"""Buyer-demo shortcut scripts stay aligned with gen_buyer_demo_shortcuts.py."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GEN = REPO / "scripts" / "gen_buyer_demo_shortcuts.py"
DEFAULTS = REPO / "catalog" / "buyer-demo-defaults.json"


def test_gen_buyer_demo_shortcuts_check_passes() -> None:
    proc = subprocess.run(
        [sys.executable, str(GEN), "--check"],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout


def test_short_names_cover_all_defaults() -> None:
    spec = importlib.util.spec_from_file_location("gen_buyer_demo_shortcuts", GEN)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    defaults = json.loads(DEFAULTS.read_text(encoding="utf-8"))["defaults"]
    assert set(mod.SHORT_NAMES.keys()) == set(defaults.keys())
