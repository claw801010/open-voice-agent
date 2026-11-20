"""MK-01-REGISTRY: unified community catalog registry."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from api.services.catalog.community_registry import (
    export_registry_bundle,
    list_registry_listings,
    listing_by_id,
    load_community_registry,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "catalog" / "community-registry.json"
BUILD_SCRIPT = REPO_ROOT / "scripts" / "build_community_catalog.py"

REQUIRED_LISTING_KEYS = frozenset(
    {"id", "type", "title", "summary", "distribution", "install", "source_ref"}
)


@pytest.fixture(scope="module")
def registry() -> dict:
    assert REGISTRY_PATH.is_file(), f"Missing {REGISTRY_PATH}; run build_community_catalog.py"
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def test_registry_has_listings(registry: dict) -> None:
    listings = registry.get("listings")
    assert isinstance(listings, list) and len(listings) >= 100
    assert registry.get("listing_count") == len(listings)


def test_each_listing_has_required_keys(registry: dict) -> None:
    for row in registry["listings"]:
        missing = REQUIRED_LISTING_KEYS - set(row.keys())
        assert not missing, f"{row.get('id')}: missing {missing}"


def test_distribution_has_tier_and_license(registry: dict) -> None:
    tiers = {"free", "community", "starter", "pro", "enterprise"}
    for row in registry["listings"]:
        dist = row["distribution"]
        assert dist.get("tier") in tiers, row["id"]
        assert dist.get("license_spdx")
        assert dist.get("publisher_id")


def test_vertical_packs_indexed(registry: dict) -> None:
    vertical_ids = {r["id"] for r in registry["listings"] if r["type"] == "vertical_pack"}
    assert "vertical_pack:barber-beauty-salon-faq" in vertical_ids
    assert "vertical_pack:healthcare-clinic-screening" in vertical_ids


def test_capability_modules_indexed(registry: dict) -> None:
    cap_ids = {r["id"] for r in registry["listings"] if r["type"] == "capability_module"}
    assert "capability_module:appointment_scheduling" in cap_ids
    assert "capability_module:faq_policy" in cap_ids


def test_tool_stubs_include_book_slot(registry: dict) -> None:
    tool_ids = {r["id"] for r in registry["listings"] if r["type"] == "tool_stub"}
    assert "tool_stub:book_slot" in tool_ids


def test_list_service_filter_by_type() -> None:
    page = list_registry_listings(listing_type="recipe", limit=50)
    assert page["total"] >= 10
    assert all(r["type"] == "recipe" for r in page["listings"])


def test_list_service_filter_by_tier() -> None:
    page = list_registry_listings(tier="free", limit=500)
    assert page["total"] >= 14
    assert all(r["distribution"]["tier"] == "free" for r in page["listings"])


def test_listing_by_id_round_trip() -> None:
    row = listing_by_id("inference_profile:local_edge_lean")
    assert row is not None
    assert row["type"] == "inference_profile"
    assert row["install"]["endpoint"].endswith("/apply")


def test_export_bundle_shape() -> None:
    bundle = export_registry_bundle()
    assert bundle.get("export_format") == "dograh-community-registry-v1"
    assert bundle.get("listing_count", 0) >= 100


def test_load_service_matches_file(registry: dict) -> None:
    loaded = load_community_registry()
    assert loaded["listing_count"] == registry["listing_count"]


def test_build_script_check_passes() -> None:
    result = subprocess.run(
        [sys.executable, str(BUILD_SCRIPT), "--check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
