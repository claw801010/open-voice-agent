#!/usr/bin/env python3
"""Generate hosted catalog voice preview WAV files (MK-01 depth).

Default: write short silent WAV placeholders for every pack slug (stdlib only).
Optional: set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID to synthesize speech via ElevenLabs
and convert MP3 → WAV with ffmpeg when available.

  python scripts/generate_catalog_voice_preview_audio.py
  python scripts/generate_catalog_voice_preview_audio.py --slug healthcare-clinic-screening
  ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... python scripts/generate_catalog_voice_preview_audio.py
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
_CATALOG = _REPO / "catalog" / "vertical-packs.json"
_OUT_DIR = _REPO / "catalog" / "voice-previews"


def _silent_wav_bytes(duration_ms: int = 400, sample_rate: int = 22050) -> bytes:
    n_frames = max(1, int(sample_rate * duration_ms / 1000))
    frames = struct.pack("<" + "h" * n_frames, *([0] * n_frames))
    import io

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)
    return buf.getvalue()


def _catalog_slugs() -> list[str]:
    data = json.loads(_CATALOG.read_text(encoding="utf-8"))
    return [str(p["slug"]) for p in data.get("packs", []) if p.get("slug")]


def _preview_script(slug: str) -> str:
    sys.path.insert(0, str(_REPO / "api"))
    try:
        from api.services.voice.profile_preview import preview_script_for_catalog_slug

        return preview_script_for_catalog_slug(slug)
    finally:
        if sys.path[0] == str(_REPO / "api"):
            sys.path.pop(0)


def _mp3_to_wav(mp3_path: Path, wav_path: Path) -> bool:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    proc = subprocess.run(
        [ffmpeg, "-y", "-i", str(mp3_path), str(wav_path)],
        capture_output=True,
        check=False,
    )
    return proc.returncode == 0 and wav_path.is_file() and wav_path.stat().st_size > 0


def _synthesize_elevenlabs(slug: str, out_wav: Path) -> bool:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    if not api_key or not voice_id:
        return False
    try:
        import httpx
    except ImportError:
        print("httpx not installed; skipping ElevenLabs synthesis", file=sys.stderr)
        return False

    script = _preview_script(slug)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": api_key, "Accept": "audio/mpeg", "Content-Type": "application/json"}
    body = {"text": script, "model_id": os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")}
    with httpx.Client(timeout=60.0) as client:
        res = client.post(url, headers=headers, json=body)
    if res.status_code != 200:
        print(f"ElevenLabs failed for {slug}: HTTP {res.status_code}", file=sys.stderr)
        return False
    mp3_path = out_wav.with_suffix(".mp3")
    mp3_path.write_bytes(res.content)
    if _mp3_to_wav(mp3_path, out_wav):
        mp3_path.unlink(missing_ok=True)
        return True
    print(f"ffmpeg conversion failed for {slug}; keep MP3 at {mp3_path}", file=sys.stderr)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate catalog voice preview WAV files")
    parser.add_argument("--slug", action="append", help="Only generate for this slug (repeatable)")
    parser.add_argument(
        "--silent-only",
        action="store_true",
        help="Skip ElevenLabs even when API key is set",
    )
    args = parser.parse_args()
    slugs = args.slug or _catalog_slugs()
    if not slugs:
        print("No catalog slugs found", file=sys.stderr)
        return 1
    _OUT_DIR.mkdir(parents=True, exist_ok=True)
    silent = _silent_wav_bytes()
    use_elevenlabs = not args.silent_only and bool(os.getenv("ELEVENLABS_API_KEY"))
    for slug in slugs:
        out = _OUT_DIR / f"{slug}.wav"
        if use_elevenlabs and _synthesize_elevenlabs(slug, out):
            print(f"wrote {out.relative_to(_REPO)} ({out.stat().st_size} bytes, ElevenLabs)")
            continue
        out.write_bytes(silent)
        print(f"wrote {out.relative_to(_REPO)} ({len(silent)} bytes, silent placeholder)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
