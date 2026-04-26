#!/usr/bin/env python3
"""
Generate full-size RGB placeholder PNGs for docs/voice-agent/tools/http-api.mdx (stdlib only).

These are **not** product screenshots — replace with real dashboard captures for GTM
(same filenames under docs/images/).

Usage (repo root): python3 scripts/gen_http_api_doc_pngs.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_solid_png(path: Path, width: int, height: int, rgb: tuple[int, int, int]) -> None:
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    r, g, b = rgb
    row = bytes([0]) + bytes([r, g, b]) * width
    raw = row * height
    body = signature + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(raw, 9)) + _chunk(b"IEND", b"")
    path.write_bytes(body)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "docs" / "images"
    out.mkdir(parents=True, exist_ok=True)
    # Distinct dark slates so placeholders are visually separable until real shots land.
    write_solid_png(out / "http-api-variable-picker-url.png", 1280, 720, (30, 36, 46))
    write_solid_png(out / "http-api-call-context-form.png", 1280, 720, (28, 46, 42))
    write_solid_png(out / "http-api-test-call-result.png", 1280, 720, (46, 36, 30))
    print("Wrote 1280×720 placeholders:", out)


if __name__ == "__main__":
    main()
