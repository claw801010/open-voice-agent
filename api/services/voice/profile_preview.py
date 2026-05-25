"""Sample scripts and optional TTS preview for voice delivery profiles (MK-01 depth)."""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

import httpx

from api.schemas.user_configuration import UserConfiguration
from api.schemas.voice_profile import SpeechDeliverySettings
from api.services.configuration.registry import ServiceProviders
from api.services.voice.speech_delivery import (
    apply_voice_profile_to_user_config,
    speech_settings_from_profile_dict,
)
from api.services.voice.vertical_presets import (
    CATALOG_SLUG_TO_VOICE_PROFILE_ID,
    recommended_voice_profile_id_for_catalog_slug,
)

# Industry sample lines for catalog / profile preview (spoken ▸ style).
CATALOG_VOICE_PREVIEW_SCRIPTS: dict[str, str] = {
    "healthcare-clinic-screening": (
        "I understand you'd like to schedule a visit. "
        "One moment while I check availability for you."
    ),
    "retail-wismo-faq": (
        "Sure thing — let me check on that order for you. "
        "One moment while I pull up the details."
    ),
    "b2b-saas-trial-nurture": (
        "Thanks for calling. I can help with your trial account "
        "or schedule a demo with our team."
    ),
    "insurance-fnol-faq": (
        "Thank you for calling. I can walk you through first-notice guidance "
        "or help schedule an adjuster callback."
    ),
    "hospitality-travel-concierge": (
        "Happy to help with your reservation. "
        "Let me look into that for you."
    ),
    "financial-services-banking-faq": (
        "For your security, I will need to verify a few details. "
        "I can guide you through card safety or branch options."
    ),
    "smb-franchise-location-faq": (
        "Great question — let me find the right location for you. "
        "One moment while I check store hours."
    ),
    "telecom-utilities-outage-faq": (
        "I can help with outage information for your area. "
        "One moment while I check the latest service status."
    ),
    "public-sector-civic-services-faq": (
        "I can help with permit and licensing questions. "
        "One moment while I look up the information for you."
    ),
    "hr-staffing-recruiting-faq": (
        "Thanks for your interest in joining our team. "
        "I can help with your application or schedule an interview."
    ),
}

_DEFAULT_PREVIEW_SCRIPT = (
    "Thanks for calling. One moment while I look that up for you."
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
VOICE_PREVIEWS_DIR = _REPO_ROOT / "catalog" / "voice-previews"


def hosted_preview_audio_api_path(slug: str) -> str:
    return f"/api/v1/catalog/vertical-packs/{slug}/voice-preview/audio"


def catalog_voice_preview_audio_path(slug: str) -> Path:
    return VOICE_PREVIEWS_DIR / f"{slug}.wav"


def preview_audio_file_available(slug: str) -> bool:
    path = catalog_voice_preview_audio_path(slug)
    return path.is_file() and path.stat().st_size > 0


def preview_script_for_catalog_slug(slug: str) -> str:
    return CATALOG_VOICE_PREVIEW_SCRIPTS.get(slug, _DEFAULT_PREVIEW_SCRIPT)


def preview_script_for_profile(profile: dict[str, Any], *, override_text: str | None = None) -> str:
    if override_text and override_text.strip():
        return override_text.strip()
    tags = profile.get("tags") or []
    for tag, slug in (
        ("healthcare", "healthcare-clinic-screening"),
        ("retail", "retail-wismo-faq"),
        ("b2b", "b2b-saas-trial-nurture"),
        ("insurance", "insurance-fnol-faq"),
        ("hospitality", "hospitality-travel-concierge"),
        ("financial", "financial-services-banking-faq"),
        ("smb", "smb-franchise-location-faq"),
        ("telecom", "telecom-utilities-outage-faq"),
        ("gov", "public-sector-civic-services-faq"),
        ("public", "public-sector-civic-services-faq"),
        ("hr", "hr-staffing-recruiting-faq"),
        ("staffing", "hr-staffing-recruiting-faq"),
        ("recruiting", "hr-staffing-recruiting-faq"),
        ("vertical", None),
    ):
        if tag in tags and slug:
            return preview_script_for_catalog_slug(slug)
    slug = profile.get("slug") or ""
    if slug.startswith("vertical_"):
        for catalog_slug, pid in CATALOG_SLUG_TO_VOICE_PROFILE_ID.items():
            if pid == profile.get("id"):
                return preview_script_for_catalog_slug(catalog_slug)
    return _DEFAULT_PREVIEW_SCRIPT


def build_catalog_voice_preview(slug: str, profile: dict[str, Any]) -> dict[str, Any]:
    settings = speech_settings_from_profile_dict(profile)
    return {
        "catalog_slug": slug,
        "profile_id": profile["id"],
        "profile_name": profile["name"],
        "script": preview_script_for_catalog_slug(slug),
        "speech_settings": settings.model_dump(),
        "recommended_voice_profile_id": recommended_voice_profile_id_for_catalog_slug(slug),
        "preview_audio_url": hosted_preview_audio_api_path(slug)
        if preview_audio_file_available(slug)
        else None,
    }


def _elevenlabs_voice_id(user_config: UserConfiguration) -> str | None:
    if not user_config.tts or user_config.tts.provider != ServiceProviders.ELEVENLABS.value:
        return None
    raw = user_config.tts.voice or ""
    try:
        return raw.split(" - ")[1]
    except IndexError:
        return raw or None


async def synthesize_elevenlabs_preview_mp3(
    user_config: UserConfiguration,
    profile: dict[str, Any],
    text: str,
    *,
    timeout_s: float = 25.0,
) -> bytes | None:
    """Return MP3 bytes when org user has ElevenLabs configured; else None."""
    voice_id = _elevenlabs_voice_id(user_config)
    api_key = user_config.tts.api_key if user_config.tts else None
    if not voice_id or not api_key:
        return None

    effective = apply_voice_profile_to_user_config(user_config, profile)
    settings = speech_settings_from_profile_dict(profile)
    stability = getattr(effective.tts, "stability", None)
    if stability is None and settings.stability is not None:
        stability = settings.stability
    similarity = getattr(effective.tts, "similarity_boost", None)
    if similarity is None and settings.similarity_boost is not None:
        similarity = settings.similarity_boost
    model_id = effective.tts.model if effective.tts else "eleven_flash_v2_5"

    payload: dict[str, Any] = {
        "text": text,
        "model_id": model_id or "eleven_flash_v2_5",
    }
    voice_settings: dict[str, Any] = {}
    if stability is not None:
        voice_settings["stability"] = stability
    if similarity is not None:
        voice_settings["similarity_boost"] = similarity
    if voice_settings:
        payload["voice_settings"] = voice_settings

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            res = await client.post(
                url,
                headers={
                    "xi-api-key": api_key,
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if res.status_code != 200:
            return None
        return res.content
    except httpx.HTTPError:
        return None


async def build_voice_profile_preview(
    profile: dict[str, Any],
    user_config: UserConfiguration | None,
    *,
    override_text: str | None = None,
    include_audio: bool = True,
) -> dict[str, Any]:
    script = preview_script_for_profile(profile, override_text=override_text)
    settings = speech_settings_from_profile_dict(profile)
    out: dict[str, Any] = {
        "profile_id": profile["id"],
        "profile_name": profile["name"],
        "script": script,
        "speech_settings": settings.model_dump(),
        "audio_available": False,
        "audio_base64": None,
        "audio_content_type": None,
        "audio_skip_reason": None,
    }
    if not include_audio or user_config is None:
        out["audio_skip_reason"] = "no_user_tts_config"
        return out
    if user_config.tts.provider != ServiceProviders.ELEVENLABS.value:
        out["audio_skip_reason"] = "preview_audio_requires_elevenlabs"
        return out
    mp3 = await synthesize_elevenlabs_preview_mp3(user_config, profile, script)
    if mp3:
        out["audio_available"] = True
        out["audio_base64"] = base64.b64encode(mp3).decode("ascii")
        out["audio_content_type"] = "audio/mpeg"
    else:
        out["audio_skip_reason"] = "tts_synthesis_failed"
    return out
