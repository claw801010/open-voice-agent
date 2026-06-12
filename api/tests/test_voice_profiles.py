"""Voice profile presets, org CRUD helpers, and speech delivery wiring."""

import pytest

from api.schemas.voice_profile import AuthenticityLayerSettings, SpeechDeliverySettings
from api.services.voice.authenticity_layer import (
    build_authenticity_layer_prompt_block,
    layer_warm,
)
from api.services.voice.presets import (
    DEFAULT_BUILTIN_PROFILE_ID,
    list_builtin_profiles,
)
from api.services.voice.speech_delivery import (
    apply_voice_profile_to_user_config,
    build_speech_style_prompt_block,
    resolve_voice_profile_for_run,
)
from api.services.voice.voice_profiles import (
    clone_profile,
    create_custom_profile,
    delete_custom_profile,
    list_all_profiles,
    normalize_org_document,
    set_default_profile_id,
    update_custom_profile,
)
from api.services.configuration.registry import ElevenlabsTTSConfiguration
from api.schemas.user_configuration import UserConfiguration
from api.services.configuration.registry import ServiceProviders


def test_builtin_profiles_include_authentic_natural_default():
    profiles = list_builtin_profiles()
    ids = {p["id"] for p in profiles}
    assert DEFAULT_BUILTIN_PROFILE_ID in ids
    authentic = next(p for p in profiles if p["id"] == DEFAULT_BUILTIN_PROFILE_ID)
    assert authentic["speech_settings"]["enable_professional_fillers"] is True
    assert authentic["speech_settings"]["filler_intensity"] == "medium"
    assert authentic["speech_settings"]["authenticity_layer"]["enabled"] is True


def test_authentic_natural_has_warm_authenticity_layer():
    profiles = list_builtin_profiles()
    authentic = next(p for p in profiles if p["id"] == DEFAULT_BUILTIN_PROFILE_ID)
    layer = authentic["speech_settings"]["authenticity_layer"]
    assert layer["enabled"] is True
    assert layer["filler_intensity"] == "medium"
    assert layer["enable_soft_breath"] is True
    assert layer["enable_key_projection"] is True


def test_build_authenticity_layer_prompt_short_fillers_and_projection():
    block = build_authenticity_layer_prompt_block(layer_warm())
    assert "NATURAL DELIVERY" in block
    assert "1-word" in block
    assert "2-word" in block
    assert "3-word" in block
    assert "Soft breath" in block
    assert "Key projection" in block


def test_build_speech_style_prompt_includes_authenticity_layer():
    block = build_speech_style_prompt_block(
        SpeechDeliverySettings(authenticity_layer=layer_warm())
    )
    assert "VOICE DELIVERY" in block
    assert "NATURAL DELIVERY" in block


def test_soft_breath_lowers_tts_stability():
    from api.services.voice.speech_delivery import apply_speech_settings_to_tts_overrides

    settings = SpeechDeliverySettings(
        stability=0.62,
        authenticity_layer=layer_warm(),
    )
    merged = apply_speech_settings_to_tts_overrides(settings, {})
    assert merged["stability"] == pytest.approx(0.58)


def test_authenticity_layer_disabled_emits_no_block():
    assert build_authenticity_layer_prompt_block(AuthenticityLayerSettings()) == ""


def test_create_clone_and_update_custom_profile():
    doc, created = create_custom_profile(
        None,
        name="My warm agent",
        description="Test",
        speech_settings=SpeechDeliverySettings(
            authenticity_level=0.9,
            enable_professional_fillers=True,
            filler_intensity="low",
        ),
    )
    assert created["is_builtin"] is False
    assert created["speech_settings"]["authenticity_level"] == 0.9

    doc, cloned = clone_profile(
        doc,
        "builtin:warm_conversational",
        name="Warm clone",
    )
    assert cloned["cloned_from_id"] == "builtin:warm_conversational"
    assert cloned["source"] == "clone"

    doc, updated = update_custom_profile(
        doc,
        created["id"],
        speech_settings=SpeechDeliverySettings(enable_professional_fillers=False),
    )
    assert updated["speech_settings"]["enable_professional_fillers"] is False

    doc = delete_custom_profile(doc, created["id"])
    assert all(p["id"] != created["id"] for p in doc["custom_profiles"])


def test_set_default_profile_id():
    doc, _ = create_custom_profile(None, name="Default candidate")
    pid = doc["custom_profiles"][0]["id"]
    doc = set_default_profile_id(doc, pid)
    listed = list_all_profiles(doc)
    assert listed["default_profile_id"] == pid


def test_build_speech_style_prompt_fillers_toggle():
    with_fillers = build_speech_style_prompt_block(
        SpeechDeliverySettings(
            enable_professional_fillers=True,
            filler_intensity="medium",
        )
    )
    without = build_speech_style_prompt_block(
        SpeechDeliverySettings(enable_professional_fillers=False)
    )
    assert "Professional fillers" in with_fillers
    assert "Do not use filler words" in without


def test_apply_voice_profile_merges_elevenlabs_tts():
    user_config = UserConfiguration(
        tts=ElevenlabsTTSConfiguration(
            provider=ServiceProviders.ELEVENLABS,
            api_key="test-key",
        )
    )
    profile = list_builtin_profiles()[2]  # authentic_natural
    effective = apply_voice_profile_to_user_config(user_config, profile)
    assert effective.tts.stability == pytest.approx(0.58)
    assert effective.tts.similarity_boost == pytest.approx(0.9)


def test_vertical_builtin_profiles_present():
    profiles = list_builtin_profiles()
    ids = {p["id"] for p in profiles}
    assert "builtin:vertical_healthcare" in ids
    assert "builtin:vertical_smb" in ids
    assert "builtin:vertical_telecom" in ids
    assert "builtin:vertical_gov" in ids
    assert "builtin:vertical_hr" in ids
    healthcare = next(p for p in profiles if p["id"] == "builtin:vertical_healthcare")
    ss = healthcare["speech_settings"]
    assert ss["tone"] == "empathetic"
    assert ss["enable_extended_fillers"] is True
    assert "es-US" in ss.get("multilingual_fillers", {})
    assert ss["authenticity_layer"]["enabled"] is True


def test_build_speech_style_prompt_extended_and_multilingual():
    block = build_speech_style_prompt_block(
        SpeechDeliverySettings(
            tone="warm",
            behavior="consultative",
            enable_extended_fillers=True,
            extended_filler_phrases=["One moment please"],
            multilingual_fillers={"es-US": ["Un momento"]},
        )
    )
    assert "Tone: warm" in block
    assert "Extended transition phrases" in block
    assert "Multilingual fillers" in block
    assert "es-US" in block


def test_resolve_voice_profile_workflow_override():
    doc, custom = create_custom_profile(None, name="Workflow voice")
    pid = custom["id"]
    profile, block = resolve_voice_profile_for_run(doc, pid)
    assert profile["id"] == pid
    assert block and "VOICE DELIVERY" in block

    profile2, _ = resolve_voice_profile_for_run(doc, None)
    assert profile2["id"] == doc.get("default_profile_id") or DEFAULT_BUILTIN_PROFILE_ID


def test_create_profile_with_tags():
    doc, created = create_custom_profile(
        None,
        name="Tagged",
        tags=["retail", "retail", "  demo  "],
    )
    assert created["tags"] == ["retail", "demo"]
    doc, updated = update_custom_profile(
        doc,
        created["id"],
        tags=["b2b"],
    )
    assert updated["tags"] == ["b2b"]


def test_cannot_edit_builtin():
    with pytest.raises(ValueError, match="Built-in"):
        update_custom_profile(
            normalize_org_document(None),
            DEFAULT_BUILTIN_PROFILE_ID,
            name="Nope",
        )
