"""MK-01 / WE-01 inference profile catalog — one-click cloud / local / hybrid model stacks."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from api.schemas.user_configuration import UserConfiguration
from api.services.configuration.merge import SERVICE_FIELDS, merge_user_configurations

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CATALOG_PATH = _REPO_ROOT / "catalog" / "inference-profiles.json"
DEFAULT_INFERENCE_PROFILE_ID = "local_edge_lean"


class InferenceProfileError(Exception):
    pass


@lru_cache(maxsize=1)
def load_inference_profiles_catalog() -> dict[str, Any]:
    if not _CATALOG_PATH.is_file():
        raise InferenceProfileError(f"Missing catalog: {_CATALOG_PATH}")
    with _CATALOG_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data.get("profiles"), list):
        raise InferenceProfileError("inference-profiles.json: profiles must be a list")
    return data


_TIER_ORDER = {"local": 0, "hybrid": 1, "cloud": 2}


def list_inference_profile_summaries() -> list[dict[str, Any]]:
    catalog = load_inference_profiles_catalog()
    out: list[dict[str, Any]] = []
    for raw in catalog["profiles"]:
        if not isinstance(raw, dict) or not raw.get("id"):
            continue
        out.append(
            {
                "id": raw["id"],
                "label": raw.get("label") or raw["id"],
                "tier": raw.get("tier") or "cloud",
                "summary": raw.get("summary") or "",
                "edge_notes": raw.get("edge_notes") or "",
                "local_models": raw.get("local_models") or [],
                "requires_api_keys": bool(raw.get("requires_api_keys", raw.get("tier") == "cloud")),
            }
        )
    out.sort(key=lambda s: (_TIER_ORDER.get(s.get("tier") or "cloud", 9), s["id"]))
    return out


def get_inference_profile(profile_id: str) -> dict[str, Any]:
    pid = (profile_id or "").strip()
    for raw in load_inference_profiles_catalog()["profiles"]:
        if isinstance(raw, dict) and raw.get("id") == pid:
            return raw
    raise InferenceProfileError(f"Unknown inference profile: {profile_id!r}")


def _enrich_patch_with_existing_keys(
    existing: UserConfiguration, patch: dict[str, Any]
) -> dict[str, Any]:
    """Preserve stored API keys when the profile omits them (provider switch friendly)."""
    existing_dump = existing.model_dump(exclude_none=True)
    enriched = dict(patch)
    for service in SERVICE_FIELDS:
        incoming = enriched.get(service)
        if not isinstance(incoming, dict):
            continue
        old = existing_dump.get(service)
        if not isinstance(old, dict):
            continue
        if incoming.get("api_key") is None and old.get("api_key") is not None:
            incoming = {**incoming, "api_key": old["api_key"]}
            enriched[service] = incoming
    return enriched


def apply_inference_profile(
    existing: UserConfiguration, profile_id: str
) -> tuple[UserConfiguration, dict[str, Any]]:
    profile = get_inference_profile(profile_id)
    patch = profile.get("configuration")
    if not isinstance(patch, dict):
        raise InferenceProfileError(f"Profile {profile_id!r} has no configuration object")
    enriched = _enrich_patch_with_existing_keys(existing, patch)
    merged = merge_user_configurations(existing, enriched)
    meta = {
        "profile_id": profile["id"],
        "label": profile.get("label"),
        "tier": profile.get("tier"),
        "local_models": profile.get("local_models") or [],
    }
    return merged, meta


def detect_active_profile_id(user_config: UserConfiguration) -> str | None:
    """Best-effort match of current user config to a catalog profile."""
    current = user_config.model_dump(exclude_none=True)
    for summary in list_inference_profile_summaries():
        try:
            profile = get_inference_profile(summary["id"])
        except InferenceProfileError:
            continue
        patch = profile.get("configuration")
        if not isinstance(patch, dict):
            continue
        if _configuration_matches(current, patch):
            return summary["id"]
    return None


def _configuration_matches(current: dict[str, Any], patch: dict[str, Any]) -> bool:
    if patch.get("is_realtime") is not None:
        if bool(current.get("is_realtime")) != bool(patch.get("is_realtime")):
            return False
    for service in SERVICE_FIELDS:
        expected = patch.get(service)
        if expected is None:
            continue
        actual = current.get(service)
        if not isinstance(expected, dict) or not isinstance(actual, dict):
            return False
        for key in ("provider", "model", "base_url", "voice", "language"):
            if key in expected and actual.get(key) != expected.get(key):
                return False
    return True
