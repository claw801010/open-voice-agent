"""Buyer demo defaults and generic catalog demo call seed (MK-01)."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from api.services.analytics.call_intel import extract_tool_spans_from_logs

_REPO = Path(__file__).resolve().parents[2]
_BUYER_DEFAULTS = _REPO / "catalog" / "buyer-demo-defaults.json"
_VARIANT_TOOLS = _REPO / "catalog" / "catalog-variant-http-tools.json"
_CATALOG_DEMO_SCRIPT = _REPO / "scripts" / "seed_gtm_catalog_demo_call.py"


def test_buyer_demo_defaults_cover_all_packs():
    catalog = json.loads((_REPO / "catalog" / "vertical-packs.json").read_text(encoding="utf-8"))
    defaults = json.loads(_BUYER_DEFAULTS.read_text(encoding="utf-8"))["defaults"]
    slugs = [p["slug"] for p in catalog["packs"]]
    missing = [s for s in slugs if s not in defaults]
    assert not missing, f"buyer-demo-defaults.json missing slugs: {missing}"


def test_buyer_demo_default_variants_exist_in_catalog_tools():
    defaults = json.loads(_BUYER_DEFAULTS.read_text(encoding="utf-8"))["defaults"]
    tools = json.loads(_VARIANT_TOOLS.read_text(encoding="utf-8"))
    mismatches: list[str] = []
    for slug, variant_id in defaults.items():
        listed = tools.get(slug, {}).get(variant_id)
        if not listed:
            mismatches.append(f"{slug}:{variant_id}")
    assert not mismatches, "default variant not in catalog-variant-http-tools.json:\n" + "\n".join(
        mismatches
    )


def test_buyer_demo_settings_sections_cover_all_packs():
    catalog = json.loads((_REPO / "catalog" / "vertical-packs.json").read_text(encoding="utf-8"))
    data = json.loads(_BUYER_DEFAULTS.read_text(encoding="utf-8"))
    sections = data.get("settings_sections") or {}
    slugs = [p["slug"] for p in catalog["packs"]]
    missing = [s for s in slugs if s not in sections]
    assert not missing, f"buyer-demo-defaults.json missing settings_sections for: {missing}"
    assert sections["retail-wismo-faq"] == "local-payments"
    assert sections["telecom-utilities-outage-faq"] == "local-integrations"
    assert sections["healthcare-clinic-screening"] == "local-ehr"


def test_gtm_catalog_demo_call_tool_spans_for_collections():
    spec = importlib.util.spec_from_file_location("seed_gtm_catalog_demo_call", _CATALOG_DEMO_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    tools = mod._load_variant_tools("retail-wismo-faq", "collections_complex")
    events = mod._tool_span_events(tools)
    spans = extract_tool_spans_from_logs({"realtime_feedback_events": events})
    assert len(spans) == 1
    assert spans[0]["tool_name"] == "capture_payment_promise"
    mapped = (spans[0].get("http") or {}).get("mapped_data") or {}
    assert mapped.get("promised_amount") == "25.00"


def test_gtm_catalog_demo_call_tool_spans_for_outage():
    spec = importlib.util.spec_from_file_location("seed_gtm_catalog_demo_call", _CATALOG_DEMO_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    tools = mod._load_variant_tools("telecom-utilities-outage-faq", "outage_status_complex")
    events = mod._tool_span_events(tools)
    spans = extract_tool_spans_from_logs({"realtime_feedback_events": events})
    assert spans[0]["tool_name"] == "lookup_outage_status"
    mapped = (spans[0].get("http") or {}).get("mapped_data") or {}
    assert mapped.get("outage_status") == "active"
