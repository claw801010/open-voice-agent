"""Unit tests: inference profile catalog and apply."""

import pytest

from api.schemas.user_configuration import UserConfiguration
from api.services.configuration.inference_profiles import (
    apply_inference_profile,
    detect_active_profile_id,
    get_inference_profile,
    list_inference_profile_summaries,
)
from api.services.configuration.registry import (
    OpenAILLMService,
    ServiceProviders,
    SpeachesLLMConfiguration,
    SpeachesSTTConfiguration,
    SpeachesTTSConfiguration,
)


def test_catalog_lists_three_profiles():
    summaries = list_inference_profile_summaries()
    ids = {s["id"] for s in summaries}
    assert "cloud_balanced" in ids
    assert "local_edge_lean" in ids
    assert "hybrid_edge" in ids
    assert summaries[0]["tier"] == "local"
    assert summaries[0]["requires_api_keys"] is False


def test_local_edge_profile_uses_speaches_stack():
    profile = get_inference_profile("local_edge_lean")
    cfg = profile["configuration"]
    assert cfg["llm"]["provider"] == ServiceProviders.SPEACHES.value
    assert cfg["stt"]["provider"] == ServiceProviders.SPEACHES.value
    assert cfg["tts"]["provider"] == ServiceProviders.SPEACHES.value
    assert profile.get("local_models")


def test_apply_local_profile_preserves_existing_openai_key():
    existing = UserConfiguration(
        llm=OpenAILLMService(provider=ServiceProviders.OPENAI, model="gpt-4o-mini", api_key="sk-test"),
        stt=SpeachesSTTConfiguration(
            provider=ServiceProviders.SPEACHES,
            model="Systran/faster-distil-whisper-small.en",
            base_url="http://localhost:8100/v1",
            language="en",
        ),
        tts=SpeachesTTSConfiguration(
            provider=ServiceProviders.SPEACHES,
            model="kokoro",
            voice="af_heart",
            base_url="http://localhost:8100/v1",
        ),
    )
    merged, meta = apply_inference_profile(existing, "local_edge_lean")
    assert meta["profile_id"] == "local_edge_lean"
    assert merged.llm is not None
    assert merged.llm.provider == ServiceProviders.SPEACHES
    assert merged.stt is not None
    assert merged.stt.provider == ServiceProviders.SPEACHES


def test_local_profile_speaches_on_port_8100():
    merged, _ = apply_inference_profile(UserConfiguration(), "local_edge_lean")
    assert merged.stt is not None
    assert merged.stt.base_url == "http://localhost:8100/v1"
    assert merged.tts is not None
    assert merged.tts.base_url == "http://localhost:8100/v1"


def test_detect_active_profile_after_local_apply():
    merged, _ = apply_inference_profile(UserConfiguration(), "local_edge_lean")
    assert detect_active_profile_id(merged) == "local_edge_lean"


def test_apply_unknown_profile_raises():
    with pytest.raises(Exception, match="Unknown inference profile"):
        apply_inference_profile(UserConfiguration(), "does-not-exist")
