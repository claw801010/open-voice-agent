"""MK-01 vertical voice delivery presets — behavior, tone, fillers per industry row."""

from __future__ import annotations

from typing import Any

from api.schemas.voice_profile import SpeechDeliverySettings

VERTICAL_BUILTIN_SLUGS = (
    "vertical_healthcare",
    "vertical_retail",
    "vertical_b2b",
    "vertical_insurance",
    "vertical_hospitality",
    "vertical_financial",
    "vertical_smb",
    "vertical_telecom",
    "vertical_gov",
    "vertical_hr",
)

# Catalog slug → built-in vertical profile id
CATALOG_SLUG_TO_VOICE_PROFILE_ID: dict[str, str] = {
    "healthcare-clinic-screening": "builtin:vertical_healthcare",
    "retail-wismo-faq": "builtin:vertical_retail",
    "b2b-saas-trial-nurture": "builtin:vertical_b2b",
    "insurance-fnol-faq": "builtin:vertical_insurance",
    "hospitality-travel-concierge": "builtin:vertical_hospitality",
    "financial-services-banking-faq": "builtin:vertical_financial",
    "smb-franchise-location-faq": "builtin:vertical_smb",
    "telecom-utilities-outage-faq": "builtin:vertical_telecom",
    "public-sector-civic-services-faq": "builtin:vertical_gov",
    "hr-staffing-recruiting-faq": "builtin:vertical_hr",
}

_COMMON_EXTENDED_EN = (
    "One moment while I check that for you",
    "Let me pull that up",
    "Thanks for your patience",
)

_VERTICAL_SPEECH: dict[str, SpeechDeliverySettings] = {
    "vertical_healthcare": SpeechDeliverySettings(
        authenticity_level=0.78,
        tone="empathetic",
        behavior="consultative",
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "I understand",
            "Let me confirm that for you",
            "One moment while I review your information",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["I understand", "One moment please", "Let me verify that"],
            "es-US": [
                "Entiendo",
                "Un momento por favor",
                "Permítame verificar",
            ],
        },
        enable_breath_pauses=True,
        stability=0.74,
        similarity_boost=0.88,
        speed=0.96,
    ),
    "vertical_retail": SpeechDeliverySettings(
        authenticity_level=0.82,
        tone="warm",
        behavior="balanced",
        enable_professional_fillers=True,
        filler_intensity="medium",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "Let me check on that order",
            "Sure thing",
            "One sec while I look that up",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["Sure thing", "One moment", "Let me check that order"],
            "es-US": ["Claro", "Un momento", "Déjeme revisar su pedido"],
        },
        enable_breath_pauses=True,
        stability=0.66,
        similarity_boost=0.9,
        speed=1.0,
    ),
    "vertical_b2b": SpeechDeliverySettings(
        authenticity_level=0.42,
        tone="formal",
        behavior="concise",
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_extended_fillers=False,
        extended_filler_phrases=["Let me confirm", "One moment"],
        multilingual_fillers={},
        enable_breath_pauses=False,
        stability=0.86,
        similarity_boost=0.8,
        speed=1.02,
    ),
    "vertical_insurance": SpeechDeliverySettings(
        authenticity_level=0.48,
        tone="formal",
        behavior="balanced",
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "Let me note that for your file",
            "One moment while I review policy guidance",
            "Thank you for that information",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["One moment", "Let me review that", "Thank you for calling"],
        },
        enable_breath_pauses=True,
        stability=0.8,
        similarity_boost=0.82,
        speed=0.98,
    ),
    "vertical_hospitality": SpeechDeliverySettings(
        authenticity_level=0.76,
        tone="warm",
        behavior="consultative",
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "Absolutely",
            "Let me look into that for you",
            "Happy to help with that",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["Happy to help", "One moment", "Let me check on that"],
            "es-US": ["Con gusto", "Un momento", "Permítame revisar"],
        },
        enable_breath_pauses=True,
        stability=0.7,
        similarity_boost=0.87,
        speed=0.97,
    ),
    "vertical_financial": SpeechDeliverySettings(
        authenticity_level=0.38,
        tone="formal",
        behavior="concise",
        enable_professional_fillers=False,
        filler_intensity="off",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "One moment while I verify",
            "For your security, I will need to confirm",
        ],
        multilingual_fillers={
            "en-US": ["One moment while I verify", "For your security"],
        },
        enable_breath_pauses=False,
        stability=0.88,
        similarity_boost=0.78,
        speed=0.99,
    ),
    "vertical_smb": SpeechDeliverySettings(
        authenticity_level=0.7,
        tone="warm",
        behavior="balanced",
        enable_professional_fillers=True,
        filler_intensity="medium",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "Great question",
            "Let me find the right location for you",
            "One moment while I check store hours",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["Great question", "One moment", "Let me find that store"],
            "es-US": ["Buena pregunta", "Un momento", "Déjeme buscar esa sucursal"],
        },
        enable_breath_pauses=True,
        stability=0.72,
        similarity_boost=0.86,
        speed=1.0,
    ),
    "vertical_telecom": SpeechDeliverySettings(
        authenticity_level=0.68,
        tone="formal",
        behavior="concise",
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "One moment while I check outage status",
            "Let me look up your service area",
            "Thanks for your patience during the outage",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["One moment while I check", "Let me verify your service address"],
            "es-US": ["Un momento mientras verifico", "Permítame revisar su zona de servicio"],
        },
        enable_breath_pauses=False,
        stability=0.85,
        similarity_boost=0.82,
        speed=0.98,
    ),
    "vertical_gov": SpeechDeliverySettings(
        authenticity_level=0.72,
        tone="neutral",
        behavior="concise",
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "One moment while I look that up",
            "Let me confirm the department for you",
            "Thank you for your patience",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["One moment please", "Let me find that information"],
            "es-US": ["Un momento por favor", "Permítame buscar esa información"],
        },
        enable_breath_pauses=False,
        stability=0.84,
        similarity_boost=0.84,
        speed=0.97,
    ),
    "vertical_hr": SpeechDeliverySettings(
        authenticity_level=0.74,
        tone="warm",
        behavior="consultative",
        enable_professional_fillers=True,
        filler_intensity="low",
        enable_extended_fillers=True,
        extended_filler_phrases=[
            "Thanks for your interest in joining us",
            "Let me check that for you",
            "One moment while I look up your application",
            *_COMMON_EXTENDED_EN,
        ],
        multilingual_fillers={
            "en-US": ["Thanks for calling", "One moment", "Let me check your application status"],
            "es-US": ["Gracias por llamar", "Un momento", "Permítame revisar su solicitud"],
        },
        enable_breath_pauses=True,
        stability=0.76,
        similarity_boost=0.86,
        speed=0.98,
    ),
}

_VERTICAL_META: dict[str, dict[str, Any]] = {
    "vertical_healthcare": {
        "name": "Vertical — healthcare & clinics",
        "description": "Empathetic, consultative delivery with extended and bilingual fillers for triage and scheduling.",
        "tags": ["vertical", "healthcare", "mk01"],
    },
    "vertical_retail": {
        "name": "Vertical — retail & WISMO",
        "description": "Warm, natural cadence with order-status fillers; good for e-commerce and store FAQ.",
        "tags": ["vertical", "retail", "mk01"],
    },
    "vertical_b2b": {
        "name": "Vertical — B2B SaaS",
        "description": "Formal, concise delivery for demos, trials, and pipeline voice.",
        "tags": ["vertical", "b2b", "mk01"],
    },
    "vertical_insurance": {
        "name": "Vertical — insurance FNOL",
        "description": "Formal, script-safe tone with measured fillers for FNOL and policy FAQ.",
        "tags": ["vertical", "insurance", "mk01"],
    },
    "vertical_hospitality": {
        "name": "Vertical — hospitality & travel",
        "description": "Warm concierge cadence with guest-recovery extended fillers.",
        "tags": ["vertical", "hospitality", "mk01"],
    },
    "vertical_financial": {
        "name": "Vertical — financial services",
        "description": "Formal, security-aware delivery; minimal disfluency for card and branch FAQ.",
        "tags": ["vertical", "financial", "mk01"],
    },
    "vertical_smb": {
        "name": "Vertical — SMB & franchises",
        "description": "Friendly multi-location FAQ with location-routing extended fillers.",
        "tags": ["vertical", "smb", "mk01"],
    },
    "vertical_telecom": {
        "name": "Vertical — telecom & utilities",
        "description": "Formal, concise outage and billing FAQ delivery; minimal disfluency for status updates.",
        "tags": ["vertical", "telecom", "mk01"],
    },
    "vertical_gov": {
        "name": "Vertical — public sector & civic services",
        "description": "Neutral, accessible delivery for permits, office hours, and civic FAQ.",
        "tags": ["vertical", "gov", "public", "mk01"],
    },
    "vertical_hr": {
        "name": "Vertical — HR & staffing",
        "description": "Warm, encouraging delivery for candidate FAQ, application status, and interview scheduling.",
        "tags": ["vertical", "hr", "staffing", "recruiting", "mk01"],
    },
}


def list_vertical_builtin_profiles() -> list[dict[str, Any]]:
    from api.services.voice.presets import builtin_profile_id

    out: list[dict[str, Any]] = []
    for slug in VERTICAL_BUILTIN_SLUGS:
        meta = _VERTICAL_META[slug]
        speech = _VERTICAL_SPEECH[slug]
        out.append(
            {
                "id": builtin_profile_id(slug),
                "slug": slug,
                "name": meta["name"],
                "description": meta["description"],
                "source": "builtin",
                "is_builtin": True,
                "cloned_from_id": None,
                "tts_overrides": {"speed": speech.speed or 1.0},
                "speech_settings": speech.model_dump(),
                "tags": list(meta.get("tags") or []),
            }
        )
    return out


def get_vertical_builtin_profile(profile_id: str) -> dict[str, Any] | None:
    from api.services.voice.presets import builtin_slug_from_id

    slug = builtin_slug_from_id(profile_id)
    if not slug or slug not in _VERTICAL_SPEECH:
        return None
    for p in list_vertical_builtin_profiles():
        if p["id"] == profile_id:
            return p
    return None


def recommended_voice_profile_id_for_catalog_slug(slug: str) -> str | None:
    return CATALOG_SLUG_TO_VOICE_PROFILE_ID.get(slug)
