"""Out-of-box local inference defaults — no cloud API keys required."""

from api.schemas.user_configuration import UserConfiguration
from api.services.configuration.inference_profiles import DEFAULT_INFERENCE_PROFILE_ID
from api.services.configuration.oob_defaults import (
    build_oob_user_configuration,
    ensure_oob_user_configuration,
    is_user_configuration_unset,
)
from api.services.configuration.registry import ServiceProviders


def test_empty_config_is_unset():
    assert is_user_configuration_unset(UserConfiguration()) is True


def test_build_oob_uses_local_edge_profile():
    cfg = build_oob_user_configuration()
    assert cfg.llm is not None
    assert cfg.stt is not None
    assert cfg.tts is not None
    assert cfg.stt.provider == ServiceProviders.SPEACHES.value
    assert cfg.stt.base_url == "http://localhost:8100/v1"


def test_ensure_oob_fills_empty_config(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    out = ensure_oob_user_configuration(UserConfiguration())
    assert out.llm is not None
    assert DEFAULT_INFERENCE_PROFILE_ID == "local_edge_lean"
