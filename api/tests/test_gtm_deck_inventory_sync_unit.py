"""GTM deck PNG filename lists stay in sync across gen script, pytest, and preflight."""

from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GEN_SCRIPT = REPO / "scripts" / "gen_gtm_deck_placeholder_pngs.py"


def _load_gen_inventory() -> tuple[str, ...]:
    spec = importlib.util.spec_from_file_location("gen_gtm_deck_placeholder_pngs", GEN_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return tuple(mod.GTM_DECK_REQUIRED_PNGS)


def test_gtm_deck_inventory_matches_vertical_packs_catalog_test() -> None:
    from api.tests.test_vertical_packs_catalog import _GTM_DECK_REQUIRED_PNGS as catalog_test_pngs

    gen_pngs = _load_gen_inventory()
    assert set(gen_pngs) == set(catalog_test_pngs), (
        "gen_gtm_deck_placeholder_pngs.py and test_vertical_packs_catalog.py drift:\n"
        f"  only in gen: {sorted(set(gen_pngs) - set(catalog_test_pngs))}\n"
        f"  only in test: {sorted(set(catalog_test_pngs) - set(gen_pngs))}"
    )
    assert len(gen_pngs) == 41
