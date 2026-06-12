"""Unit tests for GTM catalog workflow seed args."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
_SCRIPT = _REPO / "scripts" / "seed_gtm_catalog_workflow.py"


def _load():
    spec = importlib.util.spec_from_file_location("seed_gtm_catalog_workflow", _SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_workflow_name_includes_slug_and_variant():
    mod = _load()
    name = mod._workflow_name("retail-wismo-faq", "collections_complex")
    assert "retail-wismo-faq" in name
    assert "collections_complex" in name


def test_default_variant_for_telecom():
    mod = _load()
    assert mod._default_variant("telecom-utilities-outage-faq") == "outage_status_complex"
