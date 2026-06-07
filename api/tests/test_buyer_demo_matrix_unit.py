"""Buyer demo matrix: defaults, hints, scripts, and primary HTTP tools stay aligned."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DEFAULTS_PATH = REPO / "catalog" / "buyer-demo-defaults.json"
HINTS_PATH = REPO / "catalog" / "buyer-demo-hints.json"
VARIANT_TOOLS_PATH = REPO / "catalog" / "catalog-variant-http-tools.json"
SCRIPTS_DIR = REPO / "scripts"
PACKS_PATH = REPO / "catalog" / "vertical-packs.json"
VOICE_PREVIEWS_DIR = REPO / "catalog" / "voice-previews"

def test_buyer_demo_shortcut_scripts_exist_and_are_executable() -> None:
    hints = json.loads(HINTS_PATH.read_text(encoding="utf-8"))
    defaults = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))["defaults"]
    missing: list[str] = []
    for slug, variant_id in defaults.items():
        script = (
            (hints.get("by_slug") or {})
            .get(slug, {})
            .get("variants", {})
            .get(variant_id, {})
            .get("script")
        )
        if not script:
            missing.append(f"{slug}:{variant_id}:no_script")
            continue
        path = SCRIPTS_DIR / script
        if not path.is_file():
            missing.append(str(path.relative_to(REPO)))
    assert not missing, "buyer-demo shortcut scripts missing:\n" + "\n".join(missing)


def test_buyer_demo_hints_primary_tool_listed_in_variant_tools() -> None:
    hints = json.loads(HINTS_PATH.read_text(encoding="utf-8"))["by_slug"]
    defaults = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))["defaults"]
    tools = json.loads(VARIANT_TOOLS_PATH.read_text(encoding="utf-8"))
    mismatches: list[str] = []
    for slug, variant_id in defaults.items():
        hint_tool = (
            hints.get(slug, {}).get("variants", {}).get(variant_id, {}).get("primary_tool")
        )
        listed = tools.get(slug, {}).get(variant_id) or []
        if not hint_tool or hint_tool not in listed:
            mismatches.append(f"{slug}:{variant_id} primary_tool={hint_tool!r} tools={listed}")
    assert not mismatches, "primary_tool not in catalog-variant-http-tools:\n" + "\n".join(
        mismatches
    )


def test_catalog_voice_preview_wavs_committed_for_all_packs() -> None:
    slugs = [p["slug"] for p in json.loads(PACKS_PATH.read_text(encoding="utf-8"))["packs"]]
    missing = [s for s in slugs if not (VOICE_PREVIEWS_DIR / f"{s}.wav").is_file()]
    assert not missing, (
        "Missing catalog/voice-previews WAVs — run ./scripts/regen_catalog_voice_previews.sh: "
        + ", ".join(missing)
    )


def test_seed_gtm_call_and_workflow_env_keys_align_per_slug() -> None:
    calls_spec = importlib.util.spec_from_file_location(
        "seed_gtm_all_buyer_demo_calls",
        SCRIPTS_DIR / "seed_gtm_all_buyer_demo_calls.py",
    )
    wf_spec = importlib.util.spec_from_file_location(
        "seed_gtm_all_buyer_workflows",
        SCRIPTS_DIR / "seed_gtm_all_buyer_workflows.py",
    )
    calls_mod = importlib.util.module_from_spec(calls_spec)
    wf_mod = importlib.util.module_from_spec(wf_spec)
    assert calls_spec.loader is not None and wf_spec.loader is not None
    calls_spec.loader.exec_module(calls_mod)
    wf_spec.loader.exec_module(wf_mod)
    assert set(calls_mod.SLUG_ENV_KEYS.keys()) == set(wf_mod.SLUG_WORKFLOW_ENV_KEYS.keys())


def test_seed_gtm_all_buyer_workflows_env_map_covers_defaults() -> None:
    spec = importlib.util.spec_from_file_location(
        "seed_gtm_all_buyer_workflows",
        SCRIPTS_DIR / "seed_gtm_all_buyer_workflows.py",
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    defaults = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))["defaults"]
    assert set(mod.SLUG_WORKFLOW_ENV_KEYS.keys()) == set(defaults.keys())


def test_seed_gtm_all_buyer_demo_calls_env_map_covers_defaults() -> None:
    spec = importlib.util.spec_from_file_location(
        "seed_gtm_all_buyer_demo_calls",
        SCRIPTS_DIR / "seed_gtm_all_buyer_demo_calls.py",
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    defaults = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))["defaults"]
    assert set(mod.SLUG_ENV_KEYS.keys()) == set(defaults.keys())


def test_buyer_demo_seeded_calls_ts_env_map_matches_python() -> None:
    """Playwright buyerDemoSeededCalls.ts stays aligned with seed_gtm_all_buyer_demo_calls.py."""
    import re

    calls_spec = importlib.util.spec_from_file_location(
        "seed_gtm_all_buyer_demo_calls",
        SCRIPTS_DIR / "seed_gtm_all_buyer_demo_calls.py",
    )
    calls_mod = importlib.util.module_from_spec(calls_spec)
    assert calls_spec.loader is not None
    calls_spec.loader.exec_module(calls_mod)

    ts_path = REPO / "ui" / "src" / "lib" / "catalog" / "buyerDemoSeededCalls.ts"
    text = ts_path.read_text(encoding="utf-8")
    ts_map = dict(re.findall(r"'([^']+)':\s*'(E2E_GTM_[^']+)'", text))
    assert ts_map == calls_mod.SLUG_ENV_KEYS
