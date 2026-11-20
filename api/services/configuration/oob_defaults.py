"""Out-of-box defaults — local OSS inference without cloud API keys."""

from __future__ import annotations

import os

from api.constants import AUTH_PROVIDER, ENVIRONMENT, Environment
from api.schemas.user_configuration import UserConfiguration
from api.services.configuration.inference_profiles import (
    DEFAULT_INFERENCE_PROFILE_ID,
    apply_inference_profile,
)

_CLOUD_KEY_ENV_VARS = (
    "OPENAI_API_KEY",
    "DEEPGRAM_API_KEY",
    "ELEVENLABS_API_KEY",
)


def cloud_api_keys_in_environment() -> bool:
    return any(os.getenv(k) for k in _CLOUD_KEY_ENV_VARS)


def is_user_configuration_unset(config: UserConfiguration) -> bool:
    return config.llm is None and config.stt is None and config.tts is None


def prefer_local_oob_defaults() -> bool:
    """OSS / local installs should not depend on cloud keys for core voice."""
    if ENVIRONMENT == Environment.LOCAL.value:
        return True
    if AUTH_PROVIDER == "local":
        return True
    if os.getenv("PREFER_LOCAL_INFERENCE", "").lower() in ("1", "true", "yes"):
        return True
    return not cloud_api_keys_in_environment()


def build_oob_user_configuration() -> UserConfiguration:
    """Lean local edge stack — no API keys required."""
    merged, _ = apply_inference_profile(UserConfiguration(), DEFAULT_INFERENCE_PROFILE_ID)
    return merged


def ensure_oob_user_configuration(config: UserConfiguration) -> UserConfiguration:
    if not is_user_configuration_unset(config):
        return config
    if not prefer_local_oob_defaults():
        return config
    return build_oob_user_configuration()
