"""MK-01-CAPABILITY-MODULES slice 3: resolve install target from module ids."""

from __future__ import annotations

import pytest

from api.services.catalog.capability_modules import resolve_install_target_for_modules


def test_resolve_salon_appointment_modules() -> None:
    res = resolve_install_target_for_modules(
        ["salon_appointment_booking", "service_area_faq"],
    )
    assert res["slug"] == "barber-beauty-salon-faq"
    assert res["variant_id"] == "booking_complex"
    assert "salon_appointment_booking" in res["matched_module_ids"]


def test_resolve_construction_site_visit() -> None:
    res = resolve_install_target_for_modules(["site_visit_scheduling"])
    assert res["slug"] == "construction-trades-faq"
    assert res["variant_id"] == "booking_complex"


def test_resolve_solopreneur_discovery_and_intake_prefers_intake_variant() -> None:
    res = resolve_install_target_for_modules(
        ["discovery_call_booking", "solopreneur_client_intake"],
    )
    assert res["slug"] == "solopreneur-coach-faq"
    assert res["variant_id"] in ("lead_capture_complex", "booking_complex")
    assert res["coverage_score"] >= 2


def test_resolve_empty_module_ids_raises() -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        resolve_install_target_for_modules([])


def test_resolve_unknown_module_raises() -> None:
    with pytest.raises(ValueError, match="unknown capability module"):
        resolve_install_target_for_modules(["not_a_real_module"])
