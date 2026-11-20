"""MK-01-VOICE-SPOKEN: catalog preview audio synthesis helpers."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from api.services.voice.catalog_preview_audio import (
    elevenlabs_voice_id_for_slug,
    generate_voice_preview_wav,
    load_elevenlabs_voice_id_map,
    load_voice_preview_tts_config,
    pcm_to_wav_bytes,
    silent_wav_bytes,
    speaches_base_url,
    speaches_model_and_voice,
    synthesize_speaches_wav,
)
from api.services.voice.profile_preview import SILENT_PLACEHOLDER_WAV_MAX_BYTES


def test_load_voice_preview_tts_config_has_speaches_defaults() -> None:
    cfg = load_voice_preview_tts_config()
    assert cfg.get("speaches", {}).get("model") == "hexgrad/Kokoro-82M"
    assert cfg.get("speaches", {}).get("voice") == "af_heart"


def test_elevenlabs_voice_id_falls_back_to_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "default-voice")
    assert elevenlabs_voice_id_for_slug("healthcare-clinic-screening") == "default-voice"


def test_elevenlabs_voice_id_by_profile_from_catalog_json() -> None:
    id_map = load_elevenlabs_voice_id_map()
    assert "builtin:vertical_healthcare" in (id_map.get("by_profile_id") or {})


def test_pcm_to_wav_produces_valid_header() -> None:
    pcm = b"\x00\x00" * 100
    wav = pcm_to_wav_bytes(pcm, sample_rate=24000)
    assert wav[:4] == b"RIFF"
    assert b"fmt " in wav


def test_silent_wav_is_small_placeholder() -> None:
    assert len(silent_wav_bytes()) <= SILENT_PLACEHOLDER_WAV_MAX_BYTES


def test_speaches_model_and_voice_defaults() -> None:
    model, voice, rate = speaches_model_and_voice("retail-wismo-faq")
    assert model == "hexgrad/Kokoro-82M"
    assert voice == "af_heart"
    assert rate == 24000


def test_speaches_base_url_default() -> None:
    assert speaches_base_url().endswith("/v1")


def test_generate_voice_preview_silent_fallback(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    slug = "healthcare-clinic-screening"
    monkeypatch.setattr(
        "api.services.voice.catalog_preview_audio._OUT_DIR",
        tmp_path,
    )
    monkeypatch.setattr(
        "api.services.voice.catalog_preview_audio.voice_preview_output_path",
        lambda s: tmp_path / f"{s}.wav",
    )
    path, source = generate_voice_preview_wav(
        slug,
        prefer_elevenlabs=False,
        allow_local_tts=False,
        silent_fallback=True,
    )
    assert source == "silent"
    assert path.stat().st_size <= SILENT_PLACEHOLDER_WAV_MAX_BYTES


def test_synthesize_speaches_wav_mocked(tmp_path: Path) -> None:
    slug = "retail-wismo-faq"
    out = tmp_path / f"{slug}.wav"
    fake_wav = pcm_to_wav_bytes(b"\x01\x00" * 200, sample_rate=24000)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = fake_wav

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_response

    with patch("httpx.Client", return_value=mock_client):
        assert synthesize_speaches_wav(slug, out) is True
    assert out.is_file()
    assert out.stat().st_size > 400
