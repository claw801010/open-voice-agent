"""MK-01-RUBRIC: catalog/vertical-packs.json meets minimum schema for CI."""

from __future__ import annotations

import json
import re
from collections import deque
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPO_ROOT / "catalog" / "vertical-packs.json"
PACKAGED_DIR = REPO_ROOT / "catalog" / "packaged-workflows"

REQUIRED_PACK_KEYS = frozenset(
    {
        "slug",
        "pack_semver",
        "industry",
        "display_name",
        "summary",
        "use_cases",
        "languages",
        "supported_modes",
        "compliance_tags",
        "cost_latency_estimate_band",
        "runbook_path",
        "workflow_template",
        "default_template_variables",
    }
)


@pytest.fixture(scope="module")
def catalog() -> dict:
    assert CATALOG_PATH.is_file(), f"Missing catalog file: {CATALOG_PATH}"
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def test_catalog_version_and_pack_count(catalog: dict) -> None:
    assert isinstance(catalog.get("catalog_version"), int)
    packs = catalog.get("packs")
    assert isinstance(packs, list) and len(packs) >= 10


def test_each_pack_has_preview_audio_url_when_wav_on_disk(catalog: dict) -> None:
    """MK-01 depth: preview_audio_url points at hosted audio route when WAV exists."""
    from api.services.voice.profile_preview import (
        hosted_preview_audio_api_path,
        preview_audio_file_available,
    )

    for pack in catalog["packs"]:
        slug = pack["slug"]
        url = pack.get("preview_audio_url")
        if preview_audio_file_available(slug):
            assert isinstance(url, str) and url.strip(), f"{slug}: missing preview_audio_url"
            assert hosted_preview_audio_api_path(slug) in url, (
                f"{slug}: preview_audio_url must reference voice-preview/audio route"
            )


def test_each_pack_recommends_valid_voice_profile(catalog: dict) -> None:
    """MK-01 depth: every vertical pack binds a built-in vertical voice profile."""
    from api.services.voice.presets import get_builtin_profile

    for pack in catalog["packs"]:
        slug = pack["slug"]
        profile_id = pack.get("recommended_voice_profile_id")
        assert isinstance(profile_id, str) and profile_id.strip(), (
            f"{slug!r}: missing recommended_voice_profile_id"
        )
        assert get_builtin_profile(profile_id), (
            f"{slug!r}: unknown voice profile {profile_id!r}"
        )


def test_recommended_voice_profiles_enable_natural_delivery_for_consumer_verticals(
    catalog: dict,
) -> None:
    """Warm consumer verticals ship with natural delivery (short fillers, breath, key emphasis)."""
    from api.services.voice.presets import get_builtin_profile

    consumer_slugs = {
        "healthcare-clinic-screening",
        "retail-wismo-faq",
        "hospitality-travel-concierge",
        "smb-franchise-location-faq",
        "telecom-utilities-outage-faq",
        "hr-staffing-recruiting-faq",
    }
    for pack in catalog["packs"]:
        slug = pack["slug"]
        if slug not in consumer_slugs:
            continue
        profile_id = pack.get("recommended_voice_profile_id")
        profile = get_builtin_profile(profile_id)
        assert profile, f"{slug!r}: missing profile {profile_id!r}"
        layer = (profile.get("speech_settings") or {}).get("authenticity_layer") or {}
        assert layer.get("enabled") is True, (
            f"{slug!r}: expected natural delivery enabled on {profile_id!r}"
        )


_VARIANT_TOOLS_PATH = REPO_ROOT / "catalog" / "catalog-variant-http-tools.json"


def test_each_complex_variant_has_http_tool_map(catalog: dict) -> None:
    """MK-01: every non-simple workflow variant has catalog-variant-http-tools.json entry."""
    variant_tools = json.loads(_VARIANT_TOOLS_PATH.read_text(encoding="utf-8"))
    for pack in catalog["packs"]:
        slug = pack["slug"]
        for variant in pack.get("workflow_variants") or []:
            if not isinstance(variant, dict):
                continue
            vid = variant.get("variant_id")
            if not vid or vid == "simple":
                continue
            slug_map = variant_tools.get(slug) or {}
            assert vid in slug_map, (
                f"{slug!r} variant {vid!r} missing from catalog/catalog-variant-http-tools.json"
            )
            tools = slug_map[vid]
            assert isinstance(tools, list) and len(tools) >= 1, (
                f"{slug!r}:{vid!r} must list at least one HTTP tool name"
            )


# Local all-in-one POST paths (must match api/routes/local_* and ui local*ToolDefinitions).
_LOCAL_TOOL_POST_PATH: dict[str, tuple[str, str]] = {
    # scheduling — book_* / schedule_* → appointments; *reschedule* → reschedule
    "book_slot": ("scheduling", "/api/v1/appointments"),
    "book_demo": ("scheduling", "/api/v1/appointments"),
    "book_qbr": ("scheduling", "/api/v1/appointments"),
    "schedule_adjuster_callback": ("scheduling", "/api/v1/appointments"),
    "schedule_branch_appointment": ("scheduling", "/api/v1/appointments"),
    "schedule_civic_callback": ("scheduling", "/api/v1/appointments"),
    "schedule_interview": ("scheduling", "/api/v1/appointments"),
    "schedule_lead_callback": ("scheduling", "/api/v1/appointments"),
    "schedule_service_callback": ("scheduling", "/api/v1/appointments"),
    "reschedule_appointment": ("scheduling", "/api/v1/appointments/reschedule"),
    "confirm_or_reschedule_interview": ("scheduling", "/api/v1/appointments/reschedule"),
    # payments
    "capture_payment_promise": ("payments", "/api/v1/payment-promises"),
    "confirm_payment_redirect": ("payments", "/api/v1/payments/redirect/confirm"),
    "enroll_concierge_visit": ("payments", "/api/v1/visits/enroll"),
    # integrations
    "offer_warranty_addon": ("integrations", "/api/v1/offers/attach"),
    "offer_room_upgrade": ("integrations", "/api/v1/offers/attach"),
    "update_crm_deal_stage": ("integrations", "/api/v1/deals/stage"),
    "capture_quote_intent": ("integrations", "/api/v1/quotes/intent"),
    "lookup_claim_status": ("integrations", "/api/v1/claims/status"),
    "modify_reservation": ("integrations", "/api/v1/reservations/modify"),
    "apply_cancellation_waiver": ("integrations", "/api/v1/cancellations/waiver"),
    "lookup_account_balance": ("integrations", "/api/v1/accounts/balance"),
    "report_card_lost_stolen": ("integrations", "/api/v1/cards/block"),
    "capture_lead_intent": ("integrations", "/api/v1/leads/intent"),
    "route_call_to_location": ("integrations", "/api/v1/locations/route"),
    "lookup_outage_status": ("integrations", "/api/v1/outages/status"),
    "lookup_permit_status": ("integrations", "/api/v1/permits/status"),
    "route_by_language": ("integrations", "/api/v1/calls/route-by-language"),
    "lookup_application_status": ("integrations", "/api/v1/applications/status"),
    # ehr
    "lookup_patient_context": ("ehr", "/api/v1/patients/context"),
    "verify_prior_auth": ("ehr", "/api/v1/prior-auth/status"),
    "sync_chart_to_ehr": ("ehr", "/api/v1/chart/sync"),
    # messaging
    "send_confirmation_sms": ("messaging", "/api/v1/messages/sms"),
    "send_confirmation_email": ("messaging", "/api/v1/messages/email"),
}

# Tools documented as optional / stub-only in local all-in-one wiring (no POST contract here).
_LOCAL_TOOL_POST_PATH_OPTIONAL = frozenset({"lookup_availability", "reserve_pickup_slot"})


def test_each_catalog_variant_http_tool_has_local_post_path() -> None:
    """MK-01 PREBUILD: variant HTTP tools map to shipped local-scheduling/payments/integrations paths."""
    variant_tools = json.loads(_VARIANT_TOOLS_PATH.read_text(encoding="utf-8"))
    missing: list[str] = []
    for slug, variants in variant_tools.items():
        for vid, tools in variants.items():
            for tool in tools:
                if tool in _LOCAL_TOOL_POST_PATH_OPTIONAL:
                    continue
                if tool not in _LOCAL_TOOL_POST_PATH:
                    missing.append(f"{slug}:{vid}:{tool}")
    assert not missing, (
        "Add _LOCAL_TOOL_POST_PATH entries for: " + ", ".join(sorted(missing))
    )


_PREBUILD_MATRIX_PATH = REPO_ROOT / "catalog" / "recipes" / "prebuild-vertical-demo-matrix.md"


def _parse_prebuild_demo_matrix_rows() -> list[tuple[str, str, str, str]]:
    """Return (slug, variant_id, tool, endpoint_cell) from the markdown matrix table."""
    text = _PREBUILD_MATRIX_PATH.read_text(encoding="utf-8")
    rows: list[tuple[str, str, str, str]] = []
    for line in text.splitlines():
        if not line.startswith("| `"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 5:
            continue
        slug = parts[1].strip("`")
        variant_id = parts[2].strip("`")
        tool = parts[3].strip("`")
        endpoint = parts[4].strip().strip("`")
        if slug == "catalog_slug":
            continue
        rows.append((slug, variant_id, tool, endpoint))
    return rows


def test_prebuild_demo_matrix_endpoints_match_local_modules() -> None:
    """MK-01 PREBUILD: demo matrix POST paths align with local all-in-one modules."""
    assert _PREBUILD_MATRIX_PATH.is_file(), "prebuild-vertical-demo-matrix.md missing"
    mismatches: list[str] = []
    for slug, variant_id, tool, endpoint in _parse_prebuild_demo_matrix_rows():
        if tool in _LOCAL_TOOL_POST_PATH_OPTIONAL:
            continue
        expected = _LOCAL_TOOL_POST_PATH.get(tool)
        if not expected:
            mismatches.append(f"{slug}:{variant_id}:{tool}: unknown tool")
            continue
        module, path = expected
        expected_endpoint = f"POST {{{module}}}{path}"
        if endpoint != expected_endpoint:
            mismatches.append(f"{tool}: got {endpoint!r}, want {expected_endpoint!r}")
        variant_tools = json.loads(_VARIANT_TOOLS_PATH.read_text(encoding="utf-8"))
        listed = variant_tools.get(slug, {}).get(variant_id)
        if listed is not None and tool not in listed:
            mismatches.append(f"{slug}:{variant_id}: tool {tool!r} not in catalog-variant-http-tools.json")
    assert not mismatches, "prebuild matrix drift:\n" + "\n".join(mismatches)


_GTM_DECK_REQUIRED_PNGS: tuple[str, ...] = (
    "gtm-mk01-analytics-overview.png",
    "gtm-mk01-analytics-calls.png",
    "gtm-mk01-analytics-scorecard-rubric.png",
    "gtm-mk01-analytics-qm-schedule.png",
    "gtm-mk01-analytics-quality-widget.png",
    "gtm-mk01-analytics-live-workflow.png",
    "gtm-mk01-analytics-review-inbox.png",
    "gtm-mk01-analytics-call-detail-retail-collections.png",
    "gtm-mk01-analytics-call-detail-telecom-outage.png",
    "gtm-mk01-workflow-import-dialog.png",
    "gtm-mk01-settings-local-all-in-one.png",
    "gtm-mk01-settings-local-ehr-records.png",
    "gtm-mk01-settings-local-payments-collections.png",
    "gtm-mk01-settings-local-integrations-outage.png",
    "gtm-mk01-workflow-catalog-guide-wire-local.png",
    "gtm-mk01-workflow-wire-ehr-messaging.png",
    "gtm-mk01-workflow-wire-retail-payments.png",
    "gtm-mk01-workflow-wire-telecom-integrations.png",
    "gtm-we01-workflow-get-started.png",
    "gtm-we01-settings-http-cache-policy.png",
    "gtm-we01-voice-profiles-page.png",
    "gtm-we01-voice-profiles-natural-delivery.png",
    "gtm-we01-http-tool-happy-path.png",
    "gtm-we01-workflow-editor-outcome-checklist.png",
    "gtm-we01-workflow-voice-profile-quick-pick.png",
)


def test_gtm_deck_png_inventory_on_disk() -> None:
    """GTM deck: committed docs/images/gtm-*.png set matches Playwright screenshot pack."""
    images = REPO_ROOT / "docs" / "images"
    missing = [name for name in _GTM_DECK_REQUIRED_PNGS if not (images / name).is_file()]
    assert not missing, (
        "Missing docs/images GTM PNGs (run ./scripts/gtm_capture_deck.sh or "
        "python3 scripts/gen_gtm_deck_placeholder_pngs.py): "
        + ", ".join(missing)
    )


def test_each_vertical_pack_rubric_fields(catalog: dict) -> None:
    packs = catalog["packs"]
    for index, pack in enumerate(packs):
        slug = pack.get("slug", f"<pack index {index}>")
        missing = REQUIRED_PACK_KEYS - pack.keys()
        assert not missing, f"{slug!r} missing keys: {sorted(missing)}"

        assert isinstance(pack["slug"], str) and pack["slug"].strip()
        assert isinstance(pack["pack_semver"], str) and pack["pack_semver"].strip()
        assert isinstance(pack["industry"], str) and pack["industry"].strip()
        assert isinstance(pack["display_name"], str) and pack["display_name"].strip()
        assert isinstance(pack["summary"], str) and pack["summary"].strip()

        use_cases = pack["use_cases"]
        assert isinstance(use_cases, list) and len(use_cases) >= 1
        assert all(isinstance(u, str) and u.strip() for u in use_cases)

        languages = pack["languages"]
        assert isinstance(languages, list) and len(languages) >= 1
        assert all(isinstance(x, str) and x.strip() for x in languages)

        modes = pack["supported_modes"]
        assert isinstance(modes, list) and len(modes) >= 1
        for m in modes:
            assert m in ("webrtc", "pstn"), f"{slug}: unsupported mode {m!r}"

        tags = pack["compliance_tags"]
        assert isinstance(tags, list) and len(tags) >= 1
        assert all(isinstance(t, str) and t.strip() for t in tags)

        band = pack["cost_latency_estimate_band"]
        assert isinstance(band, str) and len(band.strip()) >= 8

        rb = pack["runbook_path"]
        assert isinstance(rb, str) and rb.strip()
        runbook_file = REPO_ROOT / Path(rb)
        assert runbook_file.is_file(), f"{slug}: runbook missing: {runbook_file}"

        wt = pack["workflow_template"]
        assert isinstance(wt, dict)
        assert wt.get("source") == "packaged_definition"
        ref = wt.get("packaged_definition_ref")
        assert isinstance(ref, str) and ref.endswith(".json")
        graph_path = PACKAGED_DIR / ref
        assert graph_path.is_file(), f"{slug}: packaged workflow missing: {graph_path}"

        dtv = pack["default_template_variables"]
        assert isinstance(dtv, dict) and len(dtv) >= 1
        for k, v in dtv.items():
            assert isinstance(k, str) and k.strip()
            assert isinstance(v, str)


_HAPPY_PATH_SECTION = "## Happy-path test"


def test_runbooks_document_happy_path_test(catalog: dict) -> None:
    """MK-01-RUBRIC (2–3): each pack runbook documents copy-pasteable happy-path steps + expected outcome."""
    packs = catalog["packs"]
    for pack in packs:
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _HAPPY_PATH_SECTION in text, f"{slug}: runbook missing {_HAPPY_PATH_SECTION!r} section"
        idx = text.index(_HAPPY_PATH_SECTION)
        tail = text[idx : idx + 1200]
        assert re.search(r"\n1\.\s", tail), f"{slug}: happy-path section needs numbered steps"
        assert "Expected" in tail, f"{slug}: happy-path section needs an expected outcome"


_BOOKING_COMPLEX_SECTION = "## Booking-complex happy-path test"


def test_runbooks_document_booking_complex_happy_path(catalog: dict) -> None:
    """MK-01-RUBRIC: packs with booking_complex variant document stub + tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "booking_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _BOOKING_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_BOOKING_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_BOOKING_COMPLEX_SECTION)
        tail = text[idx : idx + 2000]
        assert re.search(r"\n1\.\s", tail), f"{slug}: booking-complex section needs numbered steps"
        assert "Expected" in tail, f"{slug}: booking-complex section needs expected outcome"
        assert "booking_complex" in tail, f"{slug}: booking-complex section must name variant_id"
        assert any(
            key in tail
            for key in (
                "scheduling_api_base_url",
                "pms_api_base_url",
            )
        ), f"{slug}: booking-complex section must reference scheduling_api_base_url or pms_api_base_url"


_CONFIRM_REMIND_SECTION = "## No-show reduction happy-path test"


def test_runbooks_document_confirm_remind_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: confirm_remind variant documents reschedule stub + tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "confirm_remind" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _CONFIRM_REMIND_SECTION in text, (
            f"{slug}: runbook missing {_CONFIRM_REMIND_SECTION!r} section"
        )
        idx = text.index(_CONFIRM_REMIND_SECTION)
        tail = text[idx : idx + 2200]
        assert re.search(r"\n1\.\s", tail), f"{slug}: confirm-remind section needs numbered steps"
        assert "Expected" in tail, f"{slug}: confirm-remind section needs expected outcome"
        assert "confirm_remind" in tail, f"{slug}: confirm-remind section must name variant_id"
        assert "reschedule_appointment" in tail, (
            f"{slug}: confirm-remind section must reference reschedule_appointment tool"
        )
        assert "scheduling_api_base_url" in tail, (
            f"{slug}: confirm-remind section must reference scheduling_api_base_url"
        )


_UPSELL_COMPLEX_SECTIONS = (
    "## Paid upsell happy-path test",
    "## Loyalty room upgrade happy-path test",
)


def test_runbooks_document_upsell_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: upsell_complex variant documents offer tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "upsell_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        section = next((m for m in _UPSELL_COMPLEX_SECTIONS if m in text), None)
        assert section is not None, (
            f"{slug}: runbook missing upsell happy-path section (one of {_UPSELL_COMPLEX_SECTIONS!r})"
        )
        idx = text.index(section)
        tail = text[idx : idx + 2200]
        assert re.search(r"\n1\.\s", tail), f"{slug}: upsell section needs numbered steps"
        assert "Expected" in tail, f"{slug}: upsell section needs expected outcome"
        assert "upsell_complex" in tail, f"{slug}: upsell section must name variant_id"
        retail_upsell = "offer_warranty_addon" in tail and "product_api_base_url" in tail
        hospitality_upsell = "offer_room_upgrade" in tail and "crs_api_base_url" in tail
        assert retail_upsell or hospitality_upsell, (
            f"{slug}: upsell section must reference retail or hospitality upsell tool + API base URL"
        )


_COLLECTIONS_COMPLEX_SECTION = "## Collections / payment promise happy-path test"


def test_runbooks_document_collections_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: collections_complex variant documents promise tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "collections_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _COLLECTIONS_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_COLLECTIONS_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_COLLECTIONS_COMPLEX_SECTION)
        tail = text[idx : idx + 2400]
        assert re.search(r"\n1\.\s", tail), f"{slug}: collections section needs numbered steps"
        assert "Expected" in tail, f"{slug}: collections section needs expected outcome"
        assert "collections_complex" in tail, f"{slug}: collections section must name variant_id"
        assert "capture_payment_promise" in tail, (
            f"{slug}: collections section must reference capture_payment_promise tool"
        )
        assert "collections_api_base_url" in tail, (
            f"{slug}: collections section must reference collections_api_base_url"
        )


_RENEWAL_COMPLEX_SECTION = "## Renewal / QBR happy-path test"


def test_runbooks_document_renewal_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: renewal_complex variant documents book_qbr + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "renewal_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _RENEWAL_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_RENEWAL_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_RENEWAL_COMPLEX_SECTION)
        tail = text[idx : idx + 2400]
        assert re.search(r"\n1\.\s", tail), f"{slug}: renewal section needs numbered steps"
        assert "Expected" in tail, f"{slug}: renewal section needs expected outcome"
        assert "renewal_complex" in tail, f"{slug}: renewal section must name variant_id"
        assert "book_qbr" in tail, f"{slug}: renewal section must reference book_qbr tool"
        assert "scheduling_api_base_url" in tail, (
            f"{slug}: renewal section must reference scheduling_api_base_url"
        )


_CONVERSION_COMPLEX_SECTION = "## Trial-to-paid happy-path test"


def test_runbooks_document_conversion_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: conversion_complex variant documents CRM stage tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "conversion_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _CONVERSION_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_CONVERSION_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_CONVERSION_COMPLEX_SECTION)
        tail = text[idx : idx + 2400]
        assert re.search(r"\n1\.\s", tail), f"{slug}: conversion section needs numbered steps"
        assert "Expected" in tail, f"{slug}: conversion section needs expected outcome"
        assert "conversion_complex" in tail, f"{slug}: conversion section must name variant_id"
        assert "update_crm_deal_stage" in tail, (
            f"{slug}: conversion section must reference update_crm_deal_stage tool"
        )
        assert "crm_api_base_url" in tail, (
            f"{slug}: conversion section must reference crm_api_base_url"
        )


_CONCIERGE_COMPLEX_SECTION = "## Concierge / paid visit happy-path test"


def test_runbooks_document_concierge_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: concierge_complex variant documents billing enroll tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "concierge_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _CONCIERGE_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_CONCIERGE_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_CONCIERGE_COMPLEX_SECTION)
        tail = text[idx : idx + 2400]
        assert re.search(r"\n1\.\s", tail), f"{slug}: concierge section needs numbered steps"
        assert "Expected" in tail, f"{slug}: concierge section needs expected outcome"
        assert "concierge_complex" in tail, f"{slug}: concierge section must name variant_id"
        assert "enroll_concierge_visit" in tail, (
            f"{slug}: concierge section must reference enroll_concierge_visit tool"
        )
        assert "billing_api_base_url" in tail, (
            f"{slug}: concierge section must reference billing_api_base_url"
        )


_QUOTE_COMPLEX_SECTION = "## Quote intent happy-path test"


def test_runbooks_document_quote_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: quote_complex variant documents quoting tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "quote_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _QUOTE_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_QUOTE_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_QUOTE_COMPLEX_SECTION)
        tail = text[idx : idx + 2400]
        assert re.search(r"\n1\.\s", tail), f"{slug}: quote section needs numbered steps"
        assert "Expected" in tail, f"{slug}: quote section needs expected outcome"
        assert "quote_complex" in tail, f"{slug}: quote section must name variant_id"
        assert "capture_quote_intent" in tail, (
            f"{slug}: quote section must reference capture_quote_intent tool"
        )
        assert "quoting_api_base_url" in tail, (
            f"{slug}: quote section must reference quoting_api_base_url"
        )


_WAIVER_COMPLEX_SECTION = "## Cancellation fee waiver happy-path test"


def test_runbooks_document_waiver_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: waiver_complex variant documents waiver tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "waiver_complex" for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _WAIVER_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_WAIVER_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_WAIVER_COMPLEX_SECTION)
        tail = text[idx : idx + 2400]
        assert re.search(r"\n1\.\s", tail), f"{slug}: waiver section needs numbered steps"
        assert "Expected" in tail, f"{slug}: waiver section needs expected outcome"
        assert "waiver_complex" in tail, f"{slug}: waiver section must name variant_id"
        assert "apply_cancellation_waiver" in tail, (
            f"{slug}: waiver section must reference apply_cancellation_waiver tool"
        )
        assert "policy_api_base_url" in tail, (
            f"{slug}: waiver section must reference policy_api_base_url"
        )


_CLAIMS_LOOKUP_COMPLEX_SECTION = "## Claims status lookup happy-path test"


def test_runbooks_document_claims_lookup_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: claims_lookup_complex variant documents lookup tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "claims_lookup_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _CLAIMS_LOOKUP_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_CLAIMS_LOOKUP_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_CLAIMS_LOOKUP_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: claims lookup section needs numbered steps"
        assert "Expected" in tail, f"{slug}: claims lookup section needs expected outcome"
        assert "claims_lookup_complex" in tail, (
            f"{slug}: claims lookup section must name variant_id"
        )
        assert "lookup_claim_status" in tail, (
            f"{slug}: claims lookup section must reference lookup_claim_status tool"
        )
        assert "claims_api_base_url" in tail, (
            f"{slug}: claims lookup section must reference claims_api_base_url"
        )


_BALANCE_LOOKUP_COMPLEX_SECTION = "## Tokenized balance lookup happy-path test"


def test_runbooks_document_balance_lookup_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: balance_lookup_complex variant documents lookup tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "balance_lookup_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _BALANCE_LOOKUP_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_BALANCE_LOOKUP_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_BALANCE_LOOKUP_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: balance lookup section needs numbered steps"
        assert "Expected" in tail, f"{slug}: balance lookup section needs expected outcome"
        assert "balance_lookup_complex" in tail, (
            f"{slug}: balance lookup section must name variant_id"
        )
        assert "lookup_account_balance" in tail, (
            f"{slug}: balance lookup section must reference lookup_account_balance tool"
        )
        assert "banking_api_base_url" in tail, (
            f"{slug}: balance lookup section must reference banking_api_base_url"
        )


_CARD_BLOCK_COMPLEX_SECTION = "## Card block / fraud report happy-path test"


def test_runbooks_document_card_block_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: card_block_complex variant documents card block tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "card_block_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _CARD_BLOCK_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_CARD_BLOCK_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_CARD_BLOCK_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: card block section needs numbered steps"
        assert "Expected" in tail, f"{slug}: card block section needs expected outcome"
        assert "card_block_complex" in tail, (
            f"{slug}: card block section must name variant_id"
        )
        assert "report_card_lost_stolen" in tail, (
            f"{slug}: card block section must reference report_card_lost_stolen tool"
        )
        assert "cards_api_base_url" in tail, (
            f"{slug}: card block section must reference cards_api_base_url"
        )


_LOCATION_ROUTER_COMPLEX_SECTION = "## Talk-to-location router happy-path test"


def test_runbooks_document_location_router_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: location_router_complex variant documents routing tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "location_router_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _LOCATION_ROUTER_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_LOCATION_ROUTER_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_LOCATION_ROUTER_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: location router section needs numbered steps"
        assert "Expected" in tail, f"{slug}: location router section needs expected outcome"
        assert "location_router_complex" in tail, (
            f"{slug}: location router section must name variant_id"
        )
        assert "route_call_to_location" in tail, (
            f"{slug}: location router section must reference route_call_to_location tool"
        )
        assert "locations_api_base_url" in tail, (
            f"{slug}: location router section must reference locations_api_base_url"
        )


_LEAD_CAPTURE_COMPLEX_SECTION = "## CRM lead capture happy-path test"


def test_runbooks_document_lead_capture_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: lead_capture_complex variant documents CRM lead tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "lead_capture_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _LEAD_CAPTURE_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_LEAD_CAPTURE_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_LEAD_CAPTURE_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: lead capture section needs numbered steps"
        assert "Expected" in tail, f"{slug}: lead capture section needs expected outcome"
        assert "lead_capture_complex" in tail, (
            f"{slug}: lead capture section must name variant_id"
        )
        assert "capture_lead_intent" in tail, (
            f"{slug}: lead capture section must reference capture_lead_intent tool"
        )
        assert "crm_api_base_url" in tail, (
            f"{slug}: lead capture section must reference crm_api_base_url"
        )


_OUTAGE_STATUS_COMPLEX_SECTION = "## Live outage status lookup happy-path test"


def test_runbooks_document_outage_status_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: outage_status_complex variant documents outage lookup tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "outage_status_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _OUTAGE_STATUS_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_OUTAGE_STATUS_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_OUTAGE_STATUS_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: outage status section needs numbered steps"
        assert "Expected" in tail, f"{slug}: outage status section needs expected outcome"
        assert "outage_status_complex" in tail, (
            f"{slug}: outage status section must name variant_id"
        )
        assert "lookup_outage_status" in tail, (
            f"{slug}: outage status section must reference lookup_outage_status tool"
        )
        assert "oss_api_base_url" in tail, (
            f"{slug}: outage status section must reference oss_api_base_url"
        )


_PAYMENT_REDIRECT_COMPLEX_SECTION = "## Payment redirect confirm happy-path test"


def test_runbooks_document_payment_redirect_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: payment_redirect_complex variant documents redirect confirm tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "payment_redirect_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _PAYMENT_REDIRECT_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_PAYMENT_REDIRECT_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_PAYMENT_REDIRECT_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: payment redirect section needs numbered steps"
        assert "Expected" in tail, f"{slug}: payment redirect section needs expected outcome"
        assert "payment_redirect_complex" in tail, (
            f"{slug}: payment redirect section must name variant_id"
        )
        assert "confirm_payment_redirect" in tail, (
            f"{slug}: payment redirect section must reference confirm_payment_redirect tool"
        )
        assert "billing_api_base_url" in tail, (
            f"{slug}: payment redirect section must reference billing_api_base_url"
        )


_PERMIT_STATUS_COMPLEX_SECTION = "## Permit status lookup happy-path test"


def test_runbooks_document_permit_status_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: permit_status_complex variant documents permit lookup tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "permit_status_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _PERMIT_STATUS_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_PERMIT_STATUS_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_PERMIT_STATUS_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: permit status section needs numbered steps"
        assert "Expected" in tail, f"{slug}: permit status section needs expected outcome"
        assert "permit_status_complex" in tail, (
            f"{slug}: permit status section must name variant_id"
        )
        assert "lookup_permit_status" in tail, (
            f"{slug}: permit status section must reference lookup_permit_status tool"
        )
        assert "records_api_base_url" in tail, (
            f"{slug}: permit status section must reference records_api_base_url"
        )


_LANGUAGE_ROUTER_COMPLEX_SECTION = "## Multilingual routing happy-path test"


def test_runbooks_document_language_router_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: language_router_complex variant documents routing tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "language_router_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _LANGUAGE_ROUTER_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_LANGUAGE_ROUTER_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_LANGUAGE_ROUTER_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: language router section needs numbered steps"
        assert "Expected" in tail, f"{slug}: language router section needs expected outcome"
        assert "language_router_complex" in tail, (
            f"{slug}: language router section must name variant_id"
        )
        assert "route_by_language" in tail, (
            f"{slug}: language router section must reference route_by_language tool"
        )
        assert "routing_api_base_url" in tail, (
            f"{slug}: language router section must reference routing_api_base_url"
        )


_APPLICATION_STATUS_COMPLEX_SECTION = "## Application status lookup happy-path test"


def test_runbooks_document_application_status_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: application_status_complex variant documents ATS lookup tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "application_status_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _APPLICATION_STATUS_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_APPLICATION_STATUS_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_APPLICATION_STATUS_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: application status section needs numbered steps"
        assert "Expected" in tail, f"{slug}: application status section needs expected outcome"
        assert "application_status_complex" in tail, (
            f"{slug}: application status section must name variant_id"
        )
        assert "lookup_application_status" in tail, (
            f"{slug}: application status section must reference lookup_application_status tool"
        )
        assert "ats_api_base_url" in tail, (
            f"{slug}: application status section must reference ats_api_base_url"
        )


_INTERVIEW_CONFIRM_COMPLEX_SECTION = "## Interview confirm / reschedule happy-path test"


def test_runbooks_document_interview_confirm_happy_path(catalog: dict) -> None:
    """MK-01-PREBUILD: interview_confirm_complex variant documents reschedule tool + analytics proof."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants") or []
        if not any(
            isinstance(v, dict) and v.get("variant_id") == "interview_confirm_complex"
            for v in variants
        ):
            continue
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _INTERVIEW_CONFIRM_COMPLEX_SECTION in text, (
            f"{slug}: runbook missing {_INTERVIEW_CONFIRM_COMPLEX_SECTION!r} section"
        )
        idx = text.index(_INTERVIEW_CONFIRM_COMPLEX_SECTION)
        tail = text[idx : idx + 2600]
        assert re.search(r"\n1\.\s", tail), f"{slug}: interview confirm section needs numbered steps"
        assert "Expected" in tail, f"{slug}: interview confirm section needs expected outcome"
        assert "interview_confirm_complex" in tail, (
            f"{slug}: interview confirm section must name variant_id"
        )
        assert "confirm_or_reschedule_interview" in tail, (
            f"{slug}: interview confirm section must reference confirm_or_reschedule_interview tool"
        )
        assert "scheduling_api_base_url" in tail, (
            f"{slug}: interview confirm section must reference scheduling_api_base_url"
        )


def test_each_pack_has_analytics_hooks(catalog: dict) -> None:
    """MK-01-ANALYTICS-VERTICAL: every vertical documents how analytics pairs with the pack."""
    packs = catalog["packs"]
    for pack in packs:
        slug = pack["slug"]
        hooks = pack.get("analytics_hooks")
        assert isinstance(hooks, list) and len(hooks) >= 1, (
            f"{slug!r}: analytics_hooks must be a non-empty list of strings"
        )
        assert all(isinstance(h, str) and h.strip() for h in hooks), (
            f"{slug!r}: each analytics_hooks entry must be a non-empty string"
        )


def test_each_pack_has_roadmap_motions(catalog: dict) -> None:
    """PREBUILD: high-revenue motions documented as roadmap (not shipped in JSON)."""
    packs = catalog["packs"]
    for pack in packs:
        slug = pack["slug"]
        motions = pack.get("roadmap_motions")
        assert isinstance(motions, list), f"{slug!r}: roadmap_motions must be a list (empty when all motions shipped)"
        assert all(isinstance(m, str) and m.strip() for m in motions), (
            f"{slug!r}: each roadmap_motions entry must be a non-empty string"
        )
        assert all("(roadmap)" in m for m in motions), (
            f"{slug!r}: each roadmap_motions entry must include '(roadmap)' per rubric row 9"
        )


_PREBUILD_COMPLEX_VARIANTS: dict[str, set[str]] = {
    "healthcare-clinic-screening": {"booking_complex", "confirm_remind", "concierge_complex"},
    "retail-wismo-faq": {"booking_complex", "upsell_complex", "collections_complex"},
    "b2b-saas-trial-nurture": {"booking_complex", "renewal_complex", "conversion_complex"},
    "insurance-fnol-faq": {"booking_complex", "quote_complex", "claims_lookup_complex"},
    "hospitality-travel-concierge": {"booking_complex", "waiver_complex", "upsell_complex"},
    "financial-services-banking-faq": {"booking_complex", "balance_lookup_complex", "card_block_complex"},
    "smb-franchise-location-faq": {"booking_complex", "location_router_complex", "lead_capture_complex"},
    "telecom-utilities-outage-faq": {"booking_complex", "outage_status_complex", "payment_redirect_complex"},
    "public-sector-civic-services-faq": {"booking_complex", "permit_status_complex", "language_router_complex"},
    "hr-staffing-recruiting-faq": {"booking_complex", "application_status_complex", "interview_confirm_complex"},
}

_PREBUILD_COMPLETE_SLUGS = frozenset(
    {
        "healthcare-clinic-screening",
        "retail-wismo-faq",
        "b2b-saas-trial-nurture",
        "insurance-fnol-faq",
        "hospitality-travel-concierge",
        "financial-services-banking-faq",
        "smb-franchise-location-faq",
        "telecom-utilities-outage-faq",
        "public-sector-civic-services-faq",
        "hr-staffing-recruiting-faq",
    }
)


def test_prebuild_roadmap_motions_all_shipped(catalog: dict) -> None:
    """MK-01-PREBUILD-COMPLETE: each fully shipped vertical has empty roadmap_motions."""
    packs = {p["slug"]: p for p in catalog["packs"]}
    assert len(packs) >= 5
    for slug in _PREBUILD_COMPLETE_SLUGS:
        pack = packs.get(slug)
        assert pack is not None, f"missing pack {slug!r}"
        motions = pack.get("roadmap_motions")
        assert motions == [], f"{slug!r}: expected empty roadmap_motions when PREBUILD is complete"


def test_prebuild_complex_variants_present(catalog: dict) -> None:
    """MK-01-PREBUILD-COMPLETE: each vertical ships the expected complex variant_ids."""
    packs = {p["slug"]: p for p in catalog["packs"]}
    for slug, expected in _PREBUILD_COMPLEX_VARIANTS.items():
        pack = packs.get(slug)
        assert pack is not None, f"missing pack {slug!r}"
        variant_ids = {
            v.get("variant_id")
            for v in (pack.get("workflow_variants") or [])
            if isinstance(v, dict)
        }
        missing = expected - variant_ids
        assert not missing, f"{slug!r}: missing complex variants {sorted(missing)}"


_ROADMAP_MOTIONS_SECTION = "## High-revenue motions (roadmap)"


def test_runbooks_document_roadmap_motions(catalog: dict) -> None:
    """PREBUILD: each pack runbook links roadmap motions to vertical-packs.json."""
    packs = catalog["packs"]
    for pack in packs:
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert _ROADMAP_MOTIONS_SECTION in text, (
            f"{slug}: runbook missing {_ROADMAP_MOTIONS_SECTION!r} section"
        )
        assert "roadmap_motions" in text, (
            f"{slug}: roadmap section must reference vertical-packs.json roadmap_motions"
        )


def test_runbooks_do_not_require_booking_stub_port(catalog: dict) -> None:
    """PREBUILD all-in-one: runbooks must not point at :8765 as the default HTTP backend."""
    packs = catalog["packs"]
    for pack in packs:
        slug = pack["slug"]
        path = REPO_ROOT / Path(pack["runbook_path"])
        text = path.read_text(encoding="utf-8")
        assert "127.0.0.1:8765" not in text and ":8765" not in text, (
            f"{slug}: runbook still references optional :8765 stub; use local all-in-one recipes"
        )


_PROMPT_TEMPLATE_TOKEN = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")


def _template_var_tokens_from_voice_prompts(data: dict) -> set[str]:
    """Collect ``{{var}}`` tokens from startCall / agentNode / endCall ``data.prompt`` strings."""
    out: set[str] = set()
    for node in data.get("nodes", ()):
        if not isinstance(node, dict):
            continue
        if node.get("type") not in ("startCall", "agentNode", "endCall"):
            continue
        raw = node.get("data")
        if not isinstance(raw, dict):
            continue
        prompt = raw.get("prompt")
        if not isinstance(prompt, str):
            continue
        for m in _PROMPT_TEMPLATE_TOKEN.finditer(prompt):
            name = m.group(1).strip()
            if name:
                out.add(name)
    return out


def test_packaged_prompt_template_tokens_have_catalog_entries(catalog: dict) -> None:
    """MK-01-RUBRIC (3): every ``{{variable}}`` in default + variant packaged prompts is in ``default_template_variables``."""
    packs = catalog["packs"]
    for pack in packs:
        slug = pack["slug"]
        dtv = pack["default_template_variables"]
        assert isinstance(dtv, dict), slug
        keys = set(dtv.keys())
        refs: set[str] = set()
        wt = pack.get("workflow_template") or {}
        pr = wt.get("packaged_definition_ref")
        if isinstance(pr, str):
            refs.add(pr)
        for v in pack.get("workflow_variants") or ():
            if isinstance(v, dict):
                r = v.get("packaged_definition_ref")
                if isinstance(r, str):
                    refs.add(r)
        assert refs, f"{slug!r}: no packaged_definition_ref collected"
        all_tokens: set[str] = set()
        for ref in sorted(refs):
            path = PACKAGED_DIR / ref
            data = json.loads(path.read_text(encoding="utf-8"))
            all_tokens |= _template_var_tokens_from_voice_prompts(data)
        missing = all_tokens - keys
        assert not missing, (
            f"{slug!r}: tokens in packaged prompts missing from default_template_variables: "
            f"{sorted(missing)}"
        )


def test_workflow_variants_when_present(catalog: dict) -> None:
    """Optional workflow_variants: simple + complex graphs with valid packaged refs."""
    packs = catalog["packs"]
    for pack in packs:
        variants = pack.get("workflow_variants")
        if variants is None:
            continue
        assert isinstance(variants, list) and len(variants) >= 1
        for i, v in enumerate(variants):
            label = f'{pack.get("slug")!r} variants[{i}]'
            assert isinstance(v, dict), label
            vid = v.get("variant_id")
            assert isinstance(vid, str) and vid.strip(), f"{label} missing variant_id"
            assert v.get("complexity") in ("simple", "complex"), f"{label} bad complexity"
            ref = v.get("packaged_definition_ref")
            assert isinstance(ref, str) and ref.endswith(".json"), f"{label} bad ref"
            path = PACKAGED_DIR / ref
            assert path.is_file(), f"{label} missing file: {path}"
            vdata = json.loads(path.read_text(encoding="utf-8"))
            _assert_voice_workflow_graph_invariants(vdata, f"{path.name} ({label})")


def _assert_minimal_workflow_graph(data: dict, label: str) -> None:
    assert isinstance(data, dict), f"{label}: root must be an object"
    nodes = data.get("nodes")
    edges = data.get("edges")
    assert isinstance(nodes, list) and len(nodes) >= 1, f"{label}: nodes must be a non-empty list"
    assert isinstance(edges, list), f"{label}: edges must be a list"
    for i, node in enumerate(nodes):
        assert isinstance(node, dict), f"{label}: nodes[{i}] must be an object"
        assert node.get("id"), f"{label}: nodes[{i}] missing id"
        assert node.get("type"), f"{label}: nodes[{i}] missing type"


_VOICE_SKELETON_TYPES = frozenset({"startCall", "agentNode", "endCall"})


def _assert_directed_path_start_call_to_end_call(data: dict, label: str) -> None:
    """Exactly one start and one end; edges admit at least one directed path (happy-path spine)."""
    nodes = data["nodes"]
    edges = data["edges"]
    start_ids = [n["id"] for n in nodes if n.get("type") == "startCall"]
    end_ids = [n["id"] for n in nodes if n.get("type") == "endCall"]
    assert len(start_ids) == 1, (
        f"{label}: expected exactly one startCall node, found {len(start_ids)} ({start_ids!r})"
    )
    assert len(end_ids) == 1, (
        f"{label}: expected exactly one endCall node, found {len(end_ids)} ({end_ids!r})"
    )
    start_id = start_ids[0]
    end_id = end_ids[0]
    adj: dict[str, list[str]] = {}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if isinstance(s, str) and isinstance(t, str):
            adj.setdefault(s, []).append(t)
    q = deque([start_id])
    seen = {start_id}
    while q:
        u = q.popleft()
        if u == end_id:
            return
        for v in adj.get(u, ()):
            if v not in seen:
                seen.add(v)
                q.append(v)
    raise AssertionError(
        f"{label}: no directed path along edges from startCall id {start_id!r} to endCall id {end_id!r}"
    )


def _assert_voice_workflow_graph_invariants(data: dict, label: str) -> None:
    """MK-01-RUBRIC: every packaged graph is a valid single-flow voice skeleton (editor + Pipecat)."""
    _assert_minimal_workflow_graph(data, label)
    nodes = data["nodes"]
    edges = data["edges"]
    types = {n.get("type") for n in nodes}
    missing = _VOICE_SKELETON_TYPES - types
    assert not missing, (
        f"{label}: packaged workflow must include node types "
        f"{sorted(_VOICE_SKELETON_TYPES)} (missing: {sorted(missing)})"
    )
    node_ids = {n["id"] for n in nodes}
    assert len(node_ids) == len(nodes), f"{label}: duplicate node id in nodes[]"
    for i, edge in enumerate(edges):
        assert isinstance(edge, dict), f"{label}: edges[{i}] must be an object"
        src = edge.get("source")
        tgt = edge.get("target")
        assert src in node_ids, f"{label}: edges[{i}] source {src!r} not in node ids"
        assert tgt in node_ids, f"{label}: edges[{i}] target {tgt!r} not in node ids"
    _assert_directed_path_start_call_to_end_call(data, label)


def test_all_packaged_workflow_json_files_parse_as_graphs(catalog: dict) -> None:
    """Every *.json under packaged-workflows/ parses; catalog refs exist on disk; graph shape + happy-path spine."""
    json_files = sorted(PACKAGED_DIR.glob("*.json"))
    assert json_files, f"expected JSON graphs under {PACKAGED_DIR}"
    required_names = {
        (p.get("workflow_template") or {}).get("packaged_definition_ref")
        for p in catalog.get("packs", [])
    }
    required_names.discard(None)
    names_on_disk = {p.name for p in json_files}
    missing = required_names - names_on_disk
    assert not missing, f"catalog packaged_definition_ref missing on disk: {sorted(missing)}"
    for path in json_files:
        data = json.loads(path.read_text(encoding="utf-8"))
        _assert_voice_workflow_graph_invariants(data, path.name)
