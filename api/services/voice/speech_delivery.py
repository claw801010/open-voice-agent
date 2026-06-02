"""Apply voice profiles to TTS config and spoken-response instructions."""

from __future__ import annotations

from typing import Any

from api.schemas.user_configuration import UserConfiguration
from api.schemas.voice_profile import SpeechDeliverySettings
from api.services.voice.authenticity_layer import (
    build_authenticity_layer_prompt_block,
    soft_breath_stability_delta,
)
from api.services.voice.presets import get_builtin_profile, is_builtin_profile_id


def build_speech_style_prompt_block(settings: SpeechDeliverySettings) -> str:
    """LLM instructions appended to agent system prompts for spoken (▸) replies."""
    tone_guidance = {
        "formal": "Use formal, precise phrasing suitable for regulated or enterprise callers.",
        "neutral": "Use clear, professional neutral phrasing.",
        "warm": "Sound welcoming and approachable without being casual or slangy.",
        "empathetic": "Acknowledge caller concerns briefly before answering; stay calm and supportive.",
    }
    behavior_guidance = {
        "concise": "Keep replies short; lead with the answer, then one clarifying question if needed.",
        "balanced": "Balance clarity with enough context; avoid rambling.",
        "consultative": "Guide the caller step-by-step; confirm understanding before advancing.",
    }
    lines = [
        "VOICE DELIVERY (spoken responses in ▸ mode only):",
        f"- Target authenticity level: {settings.authenticity_level:.0%} "
        "(0 = polished, 1 = conversational).",
        f"- Tone: {settings.tone} — {tone_guidance.get(settings.tone, tone_guidance['neutral'])}",
        f"- Behavior: {settings.behavior} — {behavior_guidance.get(settings.behavior, behavior_guidance['balanced'])}",
    ]
    if settings.enable_breath_pauses:
        lines.append(
            "- Use short natural pauses between ideas; avoid run-on sentences."
        )
    if settings.enable_professional_fillers and settings.filler_intensity != "off":
        intensity = settings.filler_intensity
        lines.append(
            f"- Professional fillers ({intensity}): you may use brief, natural "
            "fillers a human agent would use (e.g. “Sure,” “Let me check,” “One moment”) "
            "— never every sentence, never silly or excessive disfluency."
        )
    else:
        lines.append(
            "- Do not use filler words (um, uh, like); keep speech clean and professional."
        )
    if settings.enable_extended_fillers and settings.extended_filler_phrases:
        sample = ", ".join(f'"{p}"' for p in settings.extended_filler_phrases[:6])
        lines.append(
            f"- Extended transition phrases (use sparingly): {sample}."
        )
    if settings.multilingual_fillers:
        locale_bits = []
        for locale, phrases in list(settings.multilingual_fillers.items())[:4]:
            if phrases:
                locale_bits.append(f"{locale}: {', '.join(phrases[:3])}")
        if locale_bits:
            lines.append(
                "- Multilingual fillers: when the caller's language matches a locale below, "
                "prefer these approved phrases over literal translation of English fillers: "
                + "; ".join(locale_bits)
                + "."
            )
    if settings.authenticity_level >= 0.75:
        lines.append(
            "- Prefer contractions and plain language where appropriate; sound like a real person, not a script."
        )
    elif settings.authenticity_level <= 0.4:
        lines.append(
            "- Prefer formal, concise phrasing; avoid casual filler and slang."
        )
    layer_block = build_authenticity_layer_prompt_block(settings.authenticity_layer)
    if layer_block:
        lines.append("")
        lines.append(layer_block)
    return "\n".join(lines)


def speech_settings_from_profile_dict(profile: dict[str, Any]) -> SpeechDeliverySettings:
    raw = profile.get("speech_settings")
    if isinstance(raw, dict):
        return SpeechDeliverySettings.model_validate(raw)
    return SpeechDeliverySettings()


def apply_speech_settings_to_tts_overrides(
    settings: SpeechDeliverySettings,
    tts_overrides: dict[str, Any],
) -> dict[str, Any]:
    """Merge speech_settings TTS fields into tts_overrides dict."""
    merged = dict(tts_overrides or {})
    if settings.stability is not None:
        merged["stability"] = settings.stability
    if settings.similarity_boost is not None:
        merged["similarity_boost"] = settings.similarity_boost
    if settings.speed is not None:
        merged["speed"] = settings.speed
    delta = soft_breath_stability_delta(settings.authenticity_layer)
    if delta and "stability" in merged:
        merged["stability"] = max(0.0, float(merged["stability"]) - delta)
    elif delta and settings.stability is not None:
        merged["stability"] = max(0.0, float(settings.stability) - delta)
    return merged


def apply_voice_profile_to_user_config(
    user_config: UserConfiguration,
    profile: dict[str, Any] | None,
) -> UserConfiguration:
    """Merge profile TTS overrides onto effective user config (non-mutating)."""
    if not profile or not user_config.tts:
        return user_config

    settings = speech_settings_from_profile_dict(profile)
    overrides = apply_speech_settings_to_tts_overrides(
        settings, profile.get("tts_overrides") or {}
    )
    if not overrides:
        return user_config

    effective = user_config.model_copy(deep=True)
    if effective.tts is None:
        return effective
    effective.tts = effective.tts.model_copy(update=overrides)
    return effective


def resolve_profile_by_id(
    profile_id: str,
    org_document: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if is_builtin_profile_id(profile_id):
        return get_builtin_profile(profile_id)
    if not org_document:
        return None
    for p in org_document.get("custom_profiles") or []:
        if isinstance(p, dict) and p.get("id") == profile_id:
            return p
    return None


def resolve_voice_profile_for_run(
    org_document: dict[str, Any] | None,
    workflow_voice_profile_id: str | None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Pick workflow override, else org default; return profile dict and LLM speech block."""
    from api.services.voice.presets import DEFAULT_BUILTIN_PROFILE_ID
    from api.services.voice.voice_profiles import get_profile, normalize_org_document

    doc = normalize_org_document(org_document)
    profile_id = (
        workflow_voice_profile_id
        or doc.get("default_profile_id")
        or DEFAULT_BUILTIN_PROFILE_ID
    )
    profile = get_profile(doc, profile_id)
    if not profile:
        profile = get_profile(doc, DEFAULT_BUILTIN_PROFILE_ID)
    if not profile:
        return None, None
    settings = speech_settings_from_profile_dict(profile)
    return profile, build_speech_style_prompt_block(settings)
