"""Natural delivery layer — short fillers, soft breath, key projection."""

from __future__ import annotations

from api.schemas.voice_profile import AuthenticityLayerSettings

DEFAULT_ONE_WORD_FILLERS: tuple[str, ...] = (
    "Sure",
    "Okay",
    "Right",
    "Yes",
    "Gotcha",
)

DEFAULT_TWO_WORD_FILLERS: tuple[str, ...] = (
    "Got it",
    "Let me",
    "One moment",
    "Of course",
    "Fair enough",
)

DEFAULT_THREE_WORD_FILLERS: tuple[str, ...] = (
    "Let me see",
    "One sec here",
    "Just a moment",
    "Thanks for waiting",
    "Bear with me",
)


def layer_off() -> AuthenticityLayerSettings:
    return AuthenticityLayerSettings()


def layer_subtle() -> AuthenticityLayerSettings:
    return AuthenticityLayerSettings(
        enabled=True,
        filler_intensity="low",
        one_word_fillers=list(DEFAULT_ONE_WORD_FILLERS[:4]),
        two_word_fillers=list(DEFAULT_TWO_WORD_FILLERS[:3]),
        three_word_fillers=list(DEFAULT_THREE_WORD_FILLERS[:2]),
        enable_soft_breath=True,
        soft_breath_intensity="subtle",
        enable_key_projection=True,
        key_projection_intensity="light",
    )


def layer_projection_only() -> AuthenticityLayerSettings:
    """Formal verticals: emphasize key facts without short fillers or breath."""
    return AuthenticityLayerSettings(
        enabled=True,
        filler_intensity="off",
        enable_soft_breath=False,
        enable_key_projection=True,
        key_projection_intensity="light",
    )


def layer_warm() -> AuthenticityLayerSettings:
    return AuthenticityLayerSettings(
        enabled=True,
        filler_intensity="medium",
        one_word_fillers=list(DEFAULT_ONE_WORD_FILLERS),
        two_word_fillers=list(DEFAULT_TWO_WORD_FILLERS),
        three_word_fillers=list(DEFAULT_THREE_WORD_FILLERS),
        enable_soft_breath=True,
        soft_breath_intensity="natural",
        enable_key_projection=True,
        key_projection_intensity="moderate",
    )


def _phrase_sample(phrases: list[str], limit: int = 5) -> str:
    if not phrases:
        return ""
    return ", ".join(f'"{p}"' for p in phrases[:limit])


def build_authenticity_layer_prompt_block(layer: AuthenticityLayerSettings) -> str:
    """LLM instructions stacked on base VOICE DELIVERY when natural delivery is enabled."""
    if not layer.enabled:
        return ""

    lines = [
        "NATURAL DELIVERY (spoken ▸ replies — stacks with base voice settings):",
    ]

    if layer.filler_intensity != "off":
        one = layer.one_word_fillers or list(DEFAULT_ONE_WORD_FILLERS)
        two = layer.two_word_fillers or list(DEFAULT_TWO_WORD_FILLERS)
        three = layer.three_word_fillers or list(DEFAULT_THREE_WORD_FILLERS)
        lines.append(
            f"- Short fillers ({layer.filler_intensity}): sprinkle naturally — never every sentence. "
            f"1-word: {_phrase_sample(one)}; "
            f"2-word: {_phrase_sample(two)}; "
            f"3-word: {_phrase_sample(three)}."
        )

    if layer.enable_soft_breath:
        breath = (
            "Allow a soft micro-pause before important details — as if a gentle in-breath — "
            "without audible gasps or ASMR; keep it professional."
        )
        if layer.soft_breath_intensity == "natural":
            breath += " Use slightly longer clause breaks at transitions."
        lines.append(f"- Soft breath cadence: {breath}")

    if layer.enable_key_projection:
        proj = (
            "Project key terms clearly — dates, amounts, confirmation codes, policy names — "
            "with vocal weight (slightly slower and clearer on those words, never shouting)."
        )
        if layer.key_projection_intensity == "moderate":
            proj += " Pause briefly after each key fact so callers can absorb it."
        if layer.key_projection_terms:
            terms = ", ".join(f'"{t}"' for t in layer.key_projection_terms[:8])
            lines.append(f"- Key projection emphasis terms: {terms}.")
        lines.append(f"- Key projection: {proj}")

    return "\n".join(lines)


def soft_breath_stability_delta(layer: AuthenticityLayerSettings) -> float:
    """Small stability reduction for softer, more variable TTS when breath layer is on."""
    if not layer.enabled or not layer.enable_soft_breath:
        return 0.0
    return 0.04 if layer.soft_breath_intensity == "natural" else 0.02
