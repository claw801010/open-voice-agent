"""Every vertical pack has an industry-specific voice preview script (MK-01-VOICE-SPOKEN)."""

from __future__ import annotations

import json
from pathlib import Path

from api.services.voice.profile_preview import (
    CATALOG_VOICE_PREVIEW_SCRIPTS,
    preview_script_for_catalog_slug,
)

REPO = Path(__file__).resolve().parents[2]
CATALOG = REPO / "catalog" / "vertical-packs.json"


def test_each_vertical_pack_has_preview_script() -> None:
    slugs = [p["slug"] for p in json.loads(CATALOG.read_text(encoding="utf-8"))["packs"]]
    assert len(slugs) >= 14
    missing = [s for s in slugs if s not in CATALOG_VOICE_PREVIEW_SCRIPTS]
    assert not missing, f"Add CATALOG_VOICE_PREVIEW_SCRIPTS entries for: {missing}"


def test_field_service_preview_scripts_are_distinct() -> None:
    construction = preview_script_for_catalog_slug("construction-trades-faq")
    salon = preview_script_for_catalog_slug("barber-beauty-salon-faq")
    assert "licensed" in construction.lower() or "site" in construction.lower()
    assert "appointment" in salon.lower() or "stylist" in salon.lower()
    assert construction != salon
