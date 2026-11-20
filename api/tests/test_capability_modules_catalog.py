"""MK-01-CAPABILITY-MODULES: modular business motions catalog."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from api.services.catalog.capability_modules import (
    load_capability_modules_catalog,
    module_ids_for_pack,
    pack_slugs_matching_modules,
    validate_pack_refs_against_vertical_packs,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPO_ROOT / "catalog" / "capability-modules.json"
VERTICAL_PATH = REPO_ROOT / "catalog" / "vertical-packs.json"

REQUIRED_MODULE_KEYS = frozenset(
    {"id", "label", "category", "demand_rank", "summary", "pack_refs"}
)


@pytest.fixture(scope="module")
def capability_catalog() -> dict:
    assert CATALOG_PATH.is_file(), f"Missing {CATALOG_PATH}"
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def test_capability_module_count(capability_catalog: dict) -> None:
    modules = capability_catalog.get("modules")
    assert isinstance(modules, list) and len(modules) >= 38


def test_each_module_has_required_keys(capability_catalog: dict) -> None:
    for mod in capability_catalog["modules"]:
        missing = REQUIRED_MODULE_KEYS - set(mod.keys())
        assert not missing, f"{mod.get('id', '?')}: missing {missing}"


def test_categories_cover_module_categories(capability_catalog: dict) -> None:
    cat_ids = {c["id"] for c in capability_catalog.get("categories") or []}
    for mod in capability_catalog["modules"]:
        assert mod["category"] in cat_ids, f"{mod['id']}: unknown category {mod['category']!r}"


def test_pack_refs_validate_against_vertical_packs() -> None:
    errors = validate_pack_refs_against_vertical_packs()
    assert errors == [], "Invalid pack_refs:\n" + "\n".join(errors)


def test_high_demand_modules_include_buyer_motions(capability_catalog: dict) -> None:
    ids = {m["id"] for m in capability_catalog["modules"]}
    for required in (
        "appointment_scheduling",
        "faq_policy",
        "product_assistance",
        "lead_verification",
        "lead_qualification",
        "order_status_wismo",
        "human_handoff",
        "site_visit_scheduling",
        "salon_appointment_booking",
        "discovery_call_booking",
    ):
        assert required in ids


def test_module_ids_for_pack_round_trip() -> None:
    slug = "retail-wismo-faq"
    mids = module_ids_for_pack(slug)
    assert mids
    slugs = pack_slugs_matching_modules(set(mids))
    assert slug in slugs


def test_load_service_matches_file(capability_catalog: dict) -> None:
    loaded = load_capability_modules_catalog()
    assert loaded["catalog_version"] == capability_catalog["catalog_version"]
    assert len(loaded["modules"]) == len(capability_catalog["modules"])
