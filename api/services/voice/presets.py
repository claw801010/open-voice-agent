"""Built-in voice delivery presets (org can clone and customize)."""

from __future__ import annotations

from typing import Any

from api.schemas.voice_profile import SpeechDeliverySettings

BUILTIN_PROFILE_SLUGS = (
    "professional_clear",
    "warm_conversational",
    "authentic_natural",
    "broadcast_polished",
)

_BUILTIN_SPEECH: dict[str, SpeechDeliverySettings] = {
    "professional_clear": SpeechDeliverySettings(
        authenticity_level=0.35,
        enable_professional_fillers=False,
        filler_intensity="off",
        enable_breath_pauses=False,
        stability=0.85,
        similarity_boost=0.78,
        speed=1.0,
    ),
    "warm_conversational": SpeechDeliverySettings(
        authenticity_level=0.72,
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_breath_pauses=True,
        stability=0.72,
        similarity_boost=0.86,
        speed=0.97,
    ),
    "authentic_natural": SpeechDeliverySettings(
        authenticity_level=0.88,
        enable_professional_fillers=True,
        filler_intensity="medium",
        enable_breath_pauses=True,
        stability=0.62,
        similarity_boost=0.9,
        speed=1.0,
    ),
    "broadcast_polished": SpeechDeliverySettings(
        authenticity_level=0.2,
        enable_professional_fillers=False,
        filler_intensity="off",
        enable_breath_pauses=False,
        stability=0.92,
        similarity_boost=0.74,
        speed=1.03,
    ),
}

_BUILTIN_META: dict[str, dict[str, Any]] = {
    "professional_clear": {
        "name": "Professional — clear",
        "description": "Crisp, steady delivery for support and B2B. No fillers.",
        "tags": ["default", "support", "b2b"],
        "tts_overrides": {"speed": 1.0},
    },
    "warm_conversational": {
        "name": "Warm — conversational",
        "description": "Friendly cadence with light professional fillers and breath pauses.",
        "tags": ["healthcare", "hospitality"],
        "tts_overrides": {"speed": 0.97},
    },
    "authentic_natural": {
        "name": "Authentic — natural",
        "description": "Most human-sounding: moderate fillers, higher similarity, relaxed stability.",
        "tags": ["recommended", "retail"],
        "tts_overrides": {"speed": 1.0},
    },
    "broadcast_polished": {
        "name": "Broadcast — polished",
        "description": "High stability, slightly faster; ideal for announcements and IVR handoff.",
        "tags": ["ivr", "announcement"],
        "tts_overrides": {"speed": 1.03},
    },
}

DEFAULT_BUILTIN_PROFILE_ID = "builtin:authentic_natural"


def builtin_profile_id(slug: str) -> str:
    return f"builtin:{slug}"


def is_builtin_profile_id(profile_id: str) -> bool:
    return profile_id.startswith("builtin:")


def builtin_slug_from_id(profile_id: str) -> str | None:
    if not is_builtin_profile_id(profile_id):
        return None
    return profile_id.split(":", 1)[1]


def list_builtin_profiles() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for slug in BUILTIN_PROFILE_SLUGS:
        meta = _BUILTIN_META[slug]
        speech = _BUILTIN_SPEECH[slug]
        out.append(
            {
                "id": builtin_profile_id(slug),
                "slug": slug,
                "name": meta["name"],
                "description": meta["description"],
                "source": "builtin",
                "is_builtin": True,
                "cloned_from_id": None,
                "tts_overrides": dict(meta.get("tts_overrides") or {}),
                "speech_settings": speech.model_dump(),
                "tags": list(meta.get("tags") or []),
            }
        )
    return out


def get_builtin_profile(profile_id: str) -> dict[str, Any] | None:
    slug = builtin_slug_from_id(profile_id)
    if not slug or slug not in _BUILTIN_SPEECH:
        return None
    for p in list_builtin_profiles():
        if p["id"] == profile_id:
            return p
    return None
