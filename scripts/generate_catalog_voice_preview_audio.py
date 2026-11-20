#!/usr/bin/env python3
"""Generate hosted catalog voice preview WAV files (MK-01-VOICE-SPOKEN).

Fallback chain: ElevenLabs (when ELEVENLABS_API_KEY) → Speaches (--local-tts) → silent placeholder.

  python scripts/generate_catalog_voice_preview_audio.py
  python scripts/generate_catalog_voice_preview_audio.py --slug healthcare-clinic-screening
  python scripts/generate_catalog_voice_preview_audio.py --local-tts
  python scripts/generate_catalog_voice_preview_audio.py --check
  ./scripts/regen_catalog_voice_previews.sh
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
_CATALOG = _REPO / "catalog" / "vertical-packs.json"


def _catalog_slugs() -> list[str]:
    data = json.loads(_CATALOG.read_text(encoding="utf-8"))
    return [str(p["slug"]) for p in data.get("packs", []) if p.get("slug")]


def main() -> int:
    sys.path.insert(0, str(_REPO))
    from api.services.voice.catalog_preview_audio import (
        generate_voice_preview_wav,
        voice_preview_output_path,
    )
    from api.services.voice.profile_preview import (
        SILENT_PLACEHOLDER_WAV_MAX_BYTES,
        hosted_preview_is_silent_placeholder,
    )

    parser = argparse.ArgumentParser(description="Generate catalog voice preview WAV files")
    parser.add_argument("--slug", action="append", help="Only generate for this slug (repeatable)")
    parser.add_argument(
        "--silent-only",
        action="store_true",
        help="Skip ElevenLabs and Speaches; write silent placeholders only",
    )
    parser.add_argument(
        "--local-tts",
        action="store_true",
        help="Try Speaches local TTS when ElevenLabs is unavailable (needs Speaches on :8100)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if any catalog slug is missing catalog/voice-previews/{slug}.wav",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Print per-slug WAV size and silent vs spoken classification",
    )
    args = parser.parse_args()
    slugs = args.slug or _catalog_slugs()
    if not slugs:
        print("No catalog slugs found", file=sys.stderr)
        return 1

    if args.check:
        missing = [s for s in slugs if not voice_preview_output_path(s).is_file()]
        if missing:
            print("Missing voice preview WAVs:", ", ".join(missing), file=sys.stderr)
            return 1
        print(f"OK — all {len(slugs)} catalog voice preview WAVs present")
        return 0

    if args.report:
        silent_count = 0
        for slug in slugs:
            wav = voice_preview_output_path(slug)
            if not wav.is_file():
                print(f"{slug}: missing")
                continue
            size = wav.stat().st_size
            kind = (
                "silent-placeholder"
                if hosted_preview_is_silent_placeholder(slug)
                else "spoken-or-custom"
            )
            if kind == "silent-placeholder":
                silent_count += 1
            print(f"{slug}: {size} bytes ({kind})")
        print(
            f"Summary: {len(slugs)} slugs, {silent_count} silent (≤{SILENT_PLACEHOLDER_WAV_MAX_BYTES} bytes)"
        )
        return 0

    allow_local = args.local_tts or os.getenv("CATALOG_VOICE_REGEN_LOCAL_TTS", "").strip() in (
        "1",
        "true",
        "yes",
    )
    prefer_elevenlabs = not args.silent_only

    for slug in slugs:
        if args.silent_only:
            path, source = generate_voice_preview_wav(
                slug,
                prefer_elevenlabs=False,
                allow_local_tts=False,
                silent_fallback=True,
            )
        else:
            path, source = generate_voice_preview_wav(
                slug,
                prefer_elevenlabs=prefer_elevenlabs,
                allow_local_tts=allow_local,
                silent_fallback=True,
            )
        print(f"wrote {path.relative_to(_REPO)} ({path.stat().st_size} bytes, {source})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
