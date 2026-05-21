"""Org-scoped custom voice profiles (built-ins are static presets)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from api.schemas.voice_profile import SpeechDeliverySettings
from api.services.voice.presets import (
    DEFAULT_BUILTIN_PROFILE_ID,
    get_builtin_profile,
    is_builtin_profile_id,
    list_builtin_profiles,
)
from api.services.voice.speech_delivery import speech_settings_from_profile_dict

VOICE_PROFILES_SCHEMA_VERSION = 1


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return s[:64] or "profile"


def empty_org_document() -> dict[str, Any]:
    return {
        "v": VOICE_PROFILES_SCHEMA_VERSION,
        "default_profile_id": DEFAULT_BUILTIN_PROFILE_ID,
        "custom_profiles": [],
    }


def normalize_org_document(raw: Any) -> dict[str, Any]:
    base = empty_org_document()
    if raw is None or raw == {}:
        return base
    if not isinstance(raw, dict):
        raise ValueError("Voice profiles document must be a JSON object")
    if int(raw.get("v", 1)) != VOICE_PROFILES_SCHEMA_VERSION:
        raise ValueError("Unsupported voice profiles schema version")
    base["default_profile_id"] = raw.get("default_profile_id") or DEFAULT_BUILTIN_PROFILE_ID
    custom: list[dict[str, Any]] = []
    for item in raw.get("custom_profiles") or []:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("id") or "").strip()
        name = str(item.get("name") or "").strip()
        if not pid or not name:
            continue
        speech_raw = item.get("speech_settings")
        speech = (
            SpeechDeliverySettings.model_validate(speech_raw)
            if isinstance(speech_raw, dict)
            else SpeechDeliverySettings()
        )
        custom.append(
            {
                "id": pid,
                "slug": str(item.get("slug") or _slugify(name)),
                "name": name,
                "description": str(item.get("description") or ""),
                "source": item.get("source") if item.get("source") in ("custom", "clone") else "custom",
                "is_builtin": False,
                "cloned_from_id": item.get("cloned_from_id"),
                "tts_overrides": dict(item.get("tts_overrides") or {}),
                "speech_settings": speech.model_dump(),
                "tags": list(item.get("tags") or []),
                "created_at": item.get("created_at")
                or datetime.now(timezone.utc).isoformat(),
            }
        )
    base["custom_profiles"] = custom
    return base


def profile_to_response(p: dict[str, Any]) -> dict[str, Any]:
    speech = speech_settings_from_profile_dict(p)
    return {
        "id": p["id"],
        "name": p["name"],
        "slug": p.get("slug") or _slugify(p["name"]),
        "description": p.get("description") or "",
        "source": p.get("source") or ("builtin" if p.get("is_builtin") else "custom"),
        "is_builtin": bool(p.get("is_builtin")),
        "cloned_from_id": p.get("cloned_from_id"),
        "tts_overrides": dict(p.get("tts_overrides") or {}),
        "speech_settings": speech.model_dump(),
        "tags": list(p.get("tags") or []),
    }


def list_all_profiles(org_document: dict[str, Any] | None) -> dict[str, Any]:
    doc = normalize_org_document(org_document)
    builtins = list_builtin_profiles()
    custom = [profile_to_response(p) for p in doc["custom_profiles"]]
    default_id = doc.get("default_profile_id") or DEFAULT_BUILTIN_PROFILE_ID
    if not any(p["id"] == default_id for p in builtins + custom):
        default_id = DEFAULT_BUILTIN_PROFILE_ID
    return {
        "profiles": builtins + custom,
        "default_profile_id": default_id,
    }


def get_profile(org_document: dict[str, Any] | None, profile_id: str) -> dict[str, Any] | None:
    if is_builtin_profile_id(profile_id):
        raw = get_builtin_profile(profile_id)
        return profile_to_response(raw) if raw else None
    doc = normalize_org_document(org_document)
    for p in doc["custom_profiles"]:
        if p["id"] == profile_id:
            return profile_to_response(p)
    return None


def _resolve_source_profile(
    org_document: dict[str, Any] | None, source_id: str
) -> dict[str, Any] | None:
    listed = list_all_profiles(org_document)
    for p in listed["profiles"]:
        if p["id"] == source_id:
            return p
    return None


def _normalize_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []
    out: list[str] = []
    for t in tags:
        s = str(t).strip()[:32]
        if s and s not in out:
            out.append(s)
        if len(out) >= 12:
            break
    return out


def create_custom_profile(
    org_document: dict[str, Any] | None,
    *,
    name: str,
    description: str = "",
    tts_overrides: dict[str, Any] | None = None,
    speech_settings: SpeechDeliverySettings | None = None,
    tags: list[str] | None = None,
    clone_from_profile_id: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    doc = normalize_org_document(org_document)
    source = None
    if clone_from_profile_id:
        source = _resolve_source_profile(org_document, clone_from_profile_id)
        if not source:
            raise ValueError(f"Unknown profile to clone: {clone_from_profile_id}")

    if source:
        speech = SpeechDeliverySettings.model_validate(source["speech_settings"])
        overrides = dict(source.get("tts_overrides") or {})
        cloned_from = source["id"]
        src_label = "clone"
    else:
        speech = speech_settings or SpeechDeliverySettings()
        overrides = dict(tts_overrides or {})
        cloned_from = None
        src_label = "custom"

    if speech_settings and source:
        speech = speech_settings

    entry = {
        "id": str(uuid.uuid4()),
        "slug": _slugify(name),
        "name": name.strip(),
        "description": description.strip(),
        "source": src_label,
        "is_builtin": False,
        "cloned_from_id": cloned_from,
        "tts_overrides": overrides,
        "speech_settings": speech.model_dump(),
        "tags": _normalize_tags(tags) if tags is not None else (_normalize_tags(source.get("tags")) if source else []),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    doc["custom_profiles"].append(entry)
    return doc, profile_to_response(entry)


def clone_profile(
    org_document: dict[str, Any] | None,
    source_id: str,
    *,
    name: str,
    description: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    source = _resolve_source_profile(org_document, source_id)
    if not source:
        raise ValueError(f"Unknown profile: {source_id}")
    desc = description if description is not None else f"Copy of {source['name']}"
    return create_custom_profile(
        org_document,
        name=name,
        description=desc,
        clone_from_profile_id=source_id,
    )


def update_custom_profile(
    org_document: dict[str, Any] | None,
    profile_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    tts_overrides: dict[str, Any] | None = None,
    speech_settings: SpeechDeliverySettings | None = None,
    tags: list[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if is_builtin_profile_id(profile_id):
        raise ValueError("Built-in presets cannot be edited; clone one to customize.")
    doc = normalize_org_document(org_document)
    for p in doc["custom_profiles"]:
        if p["id"] != profile_id:
            continue
        if name is not None:
            p["name"] = name.strip()
            p["slug"] = _slugify(p["name"])
        if description is not None:
            p["description"] = description.strip()
        if tts_overrides is not None:
            p["tts_overrides"] = dict(tts_overrides)
        if speech_settings is not None:
            p["speech_settings"] = speech_settings.model_dump()
        if tags is not None:
            p["tags"] = _normalize_tags(tags)
        return doc, profile_to_response(p)
    raise ValueError(f"Unknown profile: {profile_id}")


def delete_custom_profile(
    org_document: dict[str, Any] | None, profile_id: str
) -> dict[str, Any]:
    if is_builtin_profile_id(profile_id):
        raise ValueError("Built-in presets cannot be deleted.")
    doc = normalize_org_document(org_document)
    before = len(doc["custom_profiles"])
    doc["custom_profiles"] = [p for p in doc["custom_profiles"] if p["id"] != profile_id]
    if len(doc["custom_profiles"]) == before:
        raise ValueError(f"Unknown profile: {profile_id}")
    if doc.get("default_profile_id") == profile_id:
        doc["default_profile_id"] = DEFAULT_BUILTIN_PROFILE_ID
    return doc


def set_default_profile_id(org_document: dict[str, Any] | None, profile_id: str) -> dict[str, Any]:
    if get_profile(org_document, profile_id) is None:
        raise ValueError(f"Unknown profile: {profile_id}")
    doc = normalize_org_document(org_document)
    doc["default_profile_id"] = profile_id
    return doc
