"""Generate hosted catalog voice preview WAV files (MK-01-VOICE-SPOKEN)."""

from __future__ import annotations

import io
import json
import os
import shutil
import struct
import subprocess
import wave
from functools import lru_cache
from pathlib import Path
from typing import Any

from api.services.voice.presets import get_builtin_profile
from api.services.voice.profile_preview import preview_script_for_catalog_slug
from api.services.voice.speech_delivery import speech_settings_from_profile_dict
from api.services.voice.vertical_presets import CATALOG_SLUG_TO_VOICE_PROFILE_ID

_REPO_ROOT = Path(__file__).resolve().parents[3]
_TTS_CONFIG_PATH = _REPO_ROOT / "catalog" / "voice-preview-tts-config.json"
_ELEVENLABS_IDS_PATH = _REPO_ROOT / "catalog" / "voice-preview-elevenlabs-ids.json"
_OUT_DIR = _REPO_ROOT / "catalog" / "voice-previews"


def silent_wav_bytes(duration_ms: int = 400, sample_rate: int = 22050) -> bytes:
    n_frames = max(1, int(sample_rate * duration_ms / 1000))
    frames = struct.pack("<" + "h" * n_frames, *([0] * n_frames))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)
    return buf.getvalue()


def pcm_to_wav_bytes(pcm: bytes, *, sample_rate: int = 24000, channels: int = 1) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


@lru_cache(maxsize=1)
def load_voice_preview_tts_config() -> dict[str, Any]:
    if not _TTS_CONFIG_PATH.is_file():
        return {}
    data = json.loads(_TTS_CONFIG_PATH.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


@lru_cache(maxsize=1)
def load_elevenlabs_voice_id_map() -> dict[str, Any]:
    if not _ELEVENLABS_IDS_PATH.is_file():
        return {}
    data = json.loads(_ELEVENLABS_IDS_PATH.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def voice_preview_output_path(slug: str) -> Path:
    return _OUT_DIR / f"{slug}.wav"


def elevenlabs_voice_settings_for_slug(slug: str) -> dict[str, float]:
    pid = CATALOG_SLUG_TO_VOICE_PROFILE_ID.get(slug)
    profile = get_builtin_profile(pid) if pid else None
    if not profile:
        return {}
    settings = speech_settings_from_profile_dict(profile)
    out: dict[str, float] = {}
    if settings.stability is not None:
        out["stability"] = float(settings.stability)
    if settings.similarity_boost is not None:
        out["similarity_boost"] = float(settings.similarity_boost)
    return out


def elevenlabs_voice_id_for_slug(slug: str) -> str:
    """Resolve ElevenLabs voice id: slug override → profile bucket → env JSON → default env."""
    id_map = load_elevenlabs_voice_id_map()
    by_slug = id_map.get("by_slug") if isinstance(id_map.get("by_slug"), dict) else {}
    if slug in by_slug and str(by_slug[slug]).strip():
        return str(by_slug[slug]).strip()

    pid = CATALOG_SLUG_TO_VOICE_PROFILE_ID.get(slug)
    by_profile = id_map.get("by_profile_id") if isinstance(id_map.get("by_profile_id"), dict) else {}
    if pid and pid in by_profile and str(by_profile[pid]).strip():
        return str(by_profile[pid]).strip()

    raw = os.getenv("ELEVENLABS_VOICE_ID_BY_SLUG", "").strip()
    if raw:
        try:
            env_by_slug = json.loads(raw)
            if isinstance(env_by_slug, dict) and slug in env_by_slug:
                return str(env_by_slug[slug]).strip()
        except json.JSONDecodeError:
            pass
    return os.getenv("ELEVENLABS_VOICE_ID", "").strip()


def _speaches_config() -> dict[str, Any]:
    cfg = load_voice_preview_tts_config().get("speaches") or {}
    return cfg if isinstance(cfg, dict) else {}


def speaches_base_url() -> str:
    spe = _speaches_config()
    env_key = str(spe.get("base_url_env") or "SPEACHES_TTS_BASE_URL")
    return os.getenv(env_key, str(spe.get("default_base_url") or "http://127.0.0.1:8100/v1")).rstrip("/")


def speaches_model_and_voice(slug: str) -> tuple[str, str, int]:
    spe = _speaches_config()
    overrides = load_voice_preview_tts_config().get("slug_overrides") or {}
    slug_cfg = overrides.get(slug) if isinstance(overrides, dict) else {}
    slug_cfg = slug_cfg if isinstance(slug_cfg, dict) else {}
    model = str(slug_cfg.get("model") or spe.get("model") or "hexgrad/Kokoro-82M")
    voice = str(slug_cfg.get("voice") or spe.get("voice") or "af_heart")
    sample_rate = int(slug_cfg.get("sample_rate") or spe.get("sample_rate") or 24000)
    return model, voice, sample_rate


def mp3_to_wav(mp3_path: Path, wav_path: Path) -> bool:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    proc = subprocess.run(
        [ffmpeg, "-y", "-i", str(mp3_path), str(wav_path)],
        capture_output=True,
        check=False,
    )
    return proc.returncode == 0 and wav_path.is_file() and wav_path.stat().st_size > 0


def synthesize_elevenlabs_wav(slug: str, out_wav: Path) -> bool:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    voice_id = elevenlabs_voice_id_for_slug(slug)
    if not api_key or not voice_id:
        return False
    try:
        import httpx
    except ImportError:
        return False

    cfg = load_voice_preview_tts_config().get("elevenlabs") or {}
    model_id = os.getenv(
        str(cfg.get("model_env") or "ELEVENLABS_MODEL_ID"),
        str(cfg.get("default_model") or "eleven_flash_v2_5"),
    )
    script = preview_script_for_catalog_slug(slug)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": api_key, "Accept": "audio/mpeg", "Content-Type": "application/json"}
    body: dict[str, Any] = {"text": script, "model_id": model_id}
    voice_settings = elevenlabs_voice_settings_for_slug(slug)
    if voice_settings:
        body["voice_settings"] = voice_settings
    with httpx.Client(timeout=60.0) as client:
        res = client.post(url, headers=headers, json=body)
    if res.status_code != 200:
        return False
    mp3_path = out_wav.with_suffix(".mp3")
    mp3_path.write_bytes(res.content)
    if mp3_to_wav(mp3_path, out_wav):
        mp3_path.unlink(missing_ok=True)
        return True
    return False


def synthesize_speaches_wav(slug: str, out_wav: Path) -> bool:
    """Synthesize via Speaches OpenAI-compatible /audio/speech (local edge TTS)."""
    try:
        import httpx
    except ImportError:
        return False

    model, voice, sample_rate = speaches_model_and_voice(slug)
    script = preview_script_for_catalog_slug(slug)
    base = speaches_base_url()
    url = f"{base}/audio/speech"
    headers = {"Authorization": "Bearer none", "Content-Type": "application/json"}

    for response_format in ("wav", "pcm"):
        body: dict[str, Any] = {
            "input": script,
            "model": model,
            "voice": voice,
            "response_format": response_format,
        }
        try:
            with httpx.Client(timeout=120.0) as client:
                res = client.post(url, headers=headers, json=body)
        except httpx.HTTPError:
            return False
        if res.status_code != 200:
            continue
        if response_format == "wav":
            out_wav.write_bytes(res.content)
            return out_wav.stat().st_size > 0
        out_wav.write_bytes(pcm_to_wav_bytes(res.content, sample_rate=sample_rate))
        return out_wav.stat().st_size > 0
    return False


def generate_voice_preview_wav(
    slug: str,
    *,
    prefer_elevenlabs: bool = True,
    allow_local_tts: bool = False,
    silent_fallback: bool = True,
) -> tuple[Path, str]:
    """
    Write catalog/voice-previews/{slug}.wav.

    Returns (path, source) where source is elevenlabs | speaches | silent.
    """
    _OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = voice_preview_output_path(slug)
    if prefer_elevenlabs and os.getenv("ELEVENLABS_API_KEY") and synthesize_elevenlabs_wav(slug, out):
        return out, "elevenlabs"
    if allow_local_tts and synthesize_speaches_wav(slug, out):
        return out, "speaches"
    if silent_fallback:
        out.write_bytes(silent_wav_bytes())
        return out, "silent"
    raise RuntimeError(f"Could not synthesize voice preview for {slug}")
