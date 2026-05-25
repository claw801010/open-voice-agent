"""Voice profile and speech delivery settings (authenticity, fillers, TTS tuning)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

VoiceProfileSource = Literal["builtin", "custom", "clone"]
DeliveryTone = Literal["formal", "neutral", "warm", "empathetic"]
DeliveryBehavior = Literal["concise", "balanced", "consultative"]


class SpeechDeliverySettings(BaseModel):
    """Tunable speech behavior — applied to TTS params and agent delivery instructions."""

    authenticity_level: float = Field(
        default=0.65,
        ge=0.0,
        le=1.0,
        description="0 = polished/broadcast, 1 = most conversational/natural",
    )
    tone: DeliveryTone = Field(
        default="neutral",
        description="Overall spoken tone (formal through empathetic)",
    )
    behavior: DeliveryBehavior = Field(
        default="balanced",
        description="Response shape: concise vs consultative",
    )
    enable_professional_fillers: bool = Field(
        default=False,
        description="When true, agent may use brief professional fillers (um, let me check) in spoken replies",
    )
    filler_intensity: Literal["off", "low", "medium"] = Field(
        default="off",
        description="How often fillers appear when enable_professional_fillers is true",
    )
    enable_extended_fillers: bool = Field(
        default=False,
        description="Allow longer approved transition phrases from extended_filler_phrases",
    )
    extended_filler_phrases: list[str] = Field(
        default_factory=list,
        max_length=24,
        description="Approved extended filler / transition phrases for spoken replies",
    )
    multilingual_fillers: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Locale-keyed filler phrase lists (e.g. en-US, es-US)",
    )
    enable_breath_pauses: bool = Field(
        default=False,
        description="Encourage short pauses between clauses for a more human cadence",
    )
    stability: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="ElevenLabs stability override (None = use preset/provider default)",
    )
    similarity_boost: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="ElevenLabs similarity_boost override",
    )
    speed: float | None = Field(
        default=None,
        ge=0.5,
        le=2.0,
        description="TTS speed multiplier when supported by provider",
    )


class VoiceProfileResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    source: VoiceProfileSource
    is_builtin: bool = False
    cloned_from_id: str | None = None
    tts_overrides: dict[str, Any] = Field(default_factory=dict)
    speech_settings: SpeechDeliverySettings
    tags: list[str] = Field(default_factory=list)


class VoiceProfileListResponse(BaseModel):
    profiles: list[VoiceProfileResponse]
    default_profile_id: str | None = None


class VoiceProfileCreateBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    tts_overrides: dict[str, Any] = Field(default_factory=dict)
    speech_settings: SpeechDeliverySettings | None = None
    tags: list[str] = Field(default_factory=list, max_length=12)
    clone_from_profile_id: str | None = Field(
        default=None,
        description="Builtin or custom profile id to copy settings from",
    )


class VoiceProfileUpdateBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    tts_overrides: dict[str, Any] | None = None
    speech_settings: SpeechDeliverySettings | None = None
    tags: list[str] | None = Field(default=None, max_length=12)


class VoiceProfileCloneBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class SetDefaultVoiceProfileBody(BaseModel):
    profile_id: str = Field(min_length=1)


class VoiceProfilePreviewBody(BaseModel):
    text: str | None = Field(
        default=None,
        max_length=500,
        description="Optional override sample line; default is vertical/industry script",
    )
    include_audio: bool = Field(
        default=True,
        description="When true and user has ElevenLabs TTS, synthesize MP3 preview",
    )


class VoiceProfilePreviewResponse(BaseModel):
    profile_id: str
    profile_name: str
    script: str
    speech_settings: SpeechDeliverySettings
    audio_available: bool = False
    audio_base64: str | None = None
    audio_content_type: str | None = None
    audio_skip_reason: str | None = None


class CatalogVoicePreviewResponse(BaseModel):
    catalog_slug: str
    profile_id: str
    profile_name: str
    script: str
    speech_settings: SpeechDeliverySettings
    recommended_voice_profile_id: str | None = None
