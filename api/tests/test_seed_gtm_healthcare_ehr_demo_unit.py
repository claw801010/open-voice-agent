"""Unit: GTM healthcare seed tool spans parse for live workflow timeline."""

import importlib.util
import json
from pathlib import Path

from api.services.analytics.call_intel import extract_tool_spans_from_logs

_REPO = Path(__file__).resolve().parents[2]
_SCRIPT = _REPO / "scripts" / "seed_gtm_healthcare_ehr_demo.py"


def _load_seed_module():
    spec = importlib.util.spec_from_file_location("seed_gtm_healthcare_ehr_demo", _SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_gtm_healthcare_seed_tool_spans_include_ehr_sync():
    mod = _load_seed_module()
    events = mod._healthcare_tool_span_events()
    spans = extract_tool_spans_from_logs({"realtime_feedback_events": events})
    names = [s["tool_name"] for s in spans]
    assert "verify_prior_auth" in names
    assert "sync_chart_to_ehr" in names
    ehr = next(s for s in spans if s["tool_name"] == "sync_chart_to_ehr")
    mapped = (ehr.get("http") or {}).get("mapped_data") or {}
    assert mapped.get("ehr_vendor") == "athenahealth"
    assert mapped.get("connector_sync_status") == "synced"
    end_events = [ev for ev in events if ev["type"] == "rtf-function-call-end"]
    assert len(end_events) == 5
    for ev in end_events:
        payload = json.loads(ev["payload"]["result"])
        assert payload["status"] == "success"
