"""Buyer demo hints JSON stays aligned with buyer-demo-defaults.json."""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HINTS_PATH = REPO / "catalog" / "buyer-demo-hints.json"
DEFAULTS_PATH = REPO / "catalog" / "buyer-demo-defaults.json"


def test_buyer_demo_hints_cover_all_default_variants() -> None:
    hints = json.loads(HINTS_PATH.read_text(encoding="utf-8"))
    defaults = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))["defaults"]
    by_slug = hints.get("by_slug") or {}
    missing: list[str] = []
    for slug, variant_id in defaults.items():
        pack = by_slug.get(slug) or {}
        variants = pack.get("variants") or {}
        if variant_id not in variants:
            missing.append(f"{slug}:{variant_id}")
    assert not missing, f"buyer-demo-hints.json missing variants: {', '.join(missing)}"


def test_banking_and_hospitality_hints_have_scripts() -> None:
    hints = json.loads(HINTS_PATH.read_text(encoding="utf-8"))["by_slug"]
    banking = hints["financial-services-banking-faq"]["variants"]["balance_lookup_complex"]
    hospitality = hints["hospitality-travel-concierge"]["variants"]["waiver_complex"]
    assert banking["script"] == "buyer-demo-banking-balance.sh"
    assert hospitality["script"] == "buyer-demo-hospitality-waiver.sh"
    assert "PCI" in banking.get("compliance_note", "")


def test_smb_civic_hr_hints_have_scripts() -> None:
    hints = json.loads(HINTS_PATH.read_text(encoding="utf-8"))["by_slug"]
    assert (
        hints["smb-franchise-location-faq"]["variants"]["lead_capture_complex"]["script"]
        == "buyer-demo-franchise-leads.sh"
    )
    assert (
        hints["public-sector-civic-services-faq"]["variants"]["permit_status_complex"]["script"]
        == "buyer-demo-civic-permits.sh"
    )
    assert (
        hints["hr-staffing-recruiting-faq"]["variants"]["application_status_complex"]["script"]
        == "buyer-demo-hr-recruiting.sh"
    )
