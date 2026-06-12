"""Regression guards for scripts/gtm-local-all-in-one-demo.sh (MK-01 smoke)."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SMOKE_SCRIPT = REPO / "scripts" / "gtm-local-all-in-one-demo.sh"


def test_gtm_local_all_in_one_demo_pretty_json_reads_integration_files() -> None:
    """pretty_json only reads stdin — passing a path arg hung the integrations loop."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert 'pretty_json "/tmp/gtm-int-' not in text
    assert 'pretty_json <"/tmp/gtm-int-' in text


def test_gtm_local_all_in_one_demo_booking_uses_unique_slots() -> None:
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert "random.randint(0,59)" in text
    assert "Slot already booked" in text
