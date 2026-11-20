"""MK-01-CAPABILITY-MODULES slice 4: multi-pack compose plan."""

from __future__ import annotations

import pytest

from api.services.catalog.capability_modules import (
    compose_capability_install_plan,
    resolve_install_target_for_modules,
)


def test_compose_single_pack_when_modules_share_vertical() -> None:
    plan = compose_capability_install_plan(["salon_appointment_booking", "service_area_faq"])
    assert plan["single_pack_sufficient"] is True
    assert len(plan["installs"]) == 1
    assert plan["installs"][0]["slug"] == "barber-beauty-salon-faq"


def test_compose_multi_pack_when_modules_span_verticals() -> None:
    plan = compose_capability_install_plan(
        ["salon_appointment_booking", "site_visit_scheduling"],
    )
    assert plan["single_pack_sufficient"] is False
    assert len(plan["installs"]) >= 2
    slugs = {i["slug"] for i in plan["installs"]}
    assert "barber-beauty-salon-faq" in slugs
    assert "construction-trades-faq" in slugs or "handyman-home-services-faq" in slugs


def test_compose_primary_matches_resolve() -> None:
    mids = ["discovery_call_booking", "solopreneur_client_intake"]
    plan = compose_capability_install_plan(mids)
    primary = resolve_install_target_for_modules(mids)
    assert plan["primary"]["slug"] == primary["slug"]


def test_compose_greedy_picks_max_coverage_per_round() -> None:
    """Regression: max(-len, slug) wrongly picked minimum coverage; use min(-len, slug)."""
    plan = compose_capability_install_plan(["site_visit_scheduling", "order_status_wismo"])
    assert plan["single_pack_sufficient"] is False
    assert len(plan["installs"]) == 2
    slugs = {i["slug"] for i in plan["installs"]}
    assert "construction-trades-faq" in slugs
    assert "retail-wismo-faq" in slugs


def test_compose_empty_raises() -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        compose_capability_install_plan([])
