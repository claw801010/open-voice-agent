"""Unit tests for catalog install variant resolution (MK-01)."""

import pytest

from api.utils.catalog_install import resolve_packaged_definition_ref

_HEALTHCARE_PACK = {
    "slug": "healthcare-clinic-screening",
    "workflow_template": {
        "source": "packaged_definition",
        "packaged_definition_ref": "healthcare-clinic-screening.json",
    },
    "workflow_variants": [
        {
            "variant_id": "simple",
            "complexity": "simple",
            "packaged_definition_ref": "healthcare-clinic-screening.json",
        },
        {
            "variant_id": "booking_complex",
            "complexity": "complex",
            "packaged_definition_ref": "healthcare-triage-booking-complex.json",
        },
    ],
}


def test_resolve_default_without_variant_uses_template_ref() -> None:
    ref, vid = resolve_packaged_definition_ref(
        _HEALTHCARE_PACK,
        template_packaged_ref="healthcare-clinic-screening.json",
        variant_id=None,
    )
    assert ref == "healthcare-clinic-screening.json"
    assert vid is None


def test_resolve_simple_explicit() -> None:
    ref, vid = resolve_packaged_definition_ref(
        _HEALTHCARE_PACK,
        template_packaged_ref="healthcare-clinic-screening.json",
        variant_id="simple",
    )
    assert ref == "healthcare-clinic-screening.json"
    assert vid == "simple"


def test_resolve_complex_variant() -> None:
    ref, vid = resolve_packaged_definition_ref(
        _HEALTHCARE_PACK,
        template_packaged_ref="healthcare-clinic-screening.json",
        variant_id="booking_complex",
    )
    assert ref == "healthcare-triage-booking-complex.json"
    assert vid == "booking_complex"


def test_resolve_unknown_variant_raises() -> None:
    with pytest.raises(ValueError, match="unknown catalog variant_id"):
        resolve_packaged_definition_ref(
            _HEALTHCARE_PACK,
            template_packaged_ref="healthcare-clinic-screening.json",
            variant_id="nope",
        )


def test_variant_requires_variants_list() -> None:
    with pytest.raises(ValueError, match="no workflow_variants"):
        resolve_packaged_definition_ref(
            {"slug": "x", "workflow_template": {}},
            template_packaged_ref="a.json",
            variant_id="simple",
        )
