#!/usr/bin/env python3
"""
Write 1280×720 solid-color placeholder PNGs for GTM deck filenames that are not yet captured.

Real captures: ./scripts/gtm_capture_deck.sh (API + UI + Playwright).
These placeholders keep the deck file set complete for docs/CI until a live capture run.

Usage (repo root):
  python3 scripts/gen_gtm_deck_placeholder_pngs.py
  python3 scripts/gen_gtm_deck_placeholder_pngs.py --force
"""

from __future__ import annotations

import argparse
import struct
import sys
import zlib
from pathlib import Path

# Full GTM deck inventory (see ui/e2e/gtm-deck-screenshots.spec.ts + catalog/recipes/http-api-analytics-redaction-gtm-demo.md).
GTM_DECK_REQUIRED_PNGS: tuple[str, ...] = (
    "gtm-mk01-analytics-overview.png",
    "gtm-mk01-analytics-calls.png",
    "gtm-mk01-analytics-scorecard-rubric.png",
    "gtm-mk01-analytics-qm-schedule.png",
    "gtm-mk01-analytics-quality-widget.png",
    "gtm-mk01-analytics-live-workflow.png",
    "gtm-mk01-analytics-review-inbox.png",
    "gtm-mk01-analytics-call-detail-retail-collections.png",
    "gtm-mk01-analytics-call-detail-telecom-outage.png",
    "gtm-mk01-workflow-import-dialog.png",
    "gtm-mk01-settings-local-all-in-one.png",
    "gtm-mk01-settings-local-ehr-records.png",
    "gtm-mk01-settings-local-payments-collections.png",
    "gtm-mk01-settings-local-integrations-outage.png",
    "gtm-mk01-workflow-catalog-guide-wire-local.png",
    "gtm-mk01-workflow-wire-ehr-messaging.png",
    "gtm-mk01-workflow-wire-retail-payments.png",
    "gtm-mk01-workflow-wire-telecom-integrations.png",
    "gtm-we01-workflow-get-started.png",
    "gtm-we01-settings-http-cache-policy.png",
    "gtm-we01-voice-profiles-page.png",
    "gtm-we01-voice-profiles-natural-delivery.png",
    "gtm-we01-http-tool-happy-path.png",
    "gtm-we01-workflow-editor-outcome-checklist.png",
    "gtm-we01-workflow-voice-profile-quick-pick.png",
)

# Distinct dark teals/slates — visually separable in slide decks until real UI shots land.
GTM_PLACEHOLDER_SPECS: dict[str, tuple[int, int, int]] = {
    "gtm-mk01-settings-local-all-in-one.png": (24, 52, 58),
    "gtm-mk01-settings-local-ehr-records.png": (22, 48, 56),
    "gtm-mk01-settings-local-payments-collections.png": (34, 46, 54),
    "gtm-mk01-settings-local-integrations-outage.png": (38, 50, 44),
    "gtm-mk01-analytics-live-workflow.png": (26, 54, 50),
    "gtm-mk01-analytics-review-inbox.png": (30, 44, 52),
    "gtm-mk01-analytics-call-detail-retail-collections.png": (28, 52, 46),
    "gtm-mk01-analytics-call-detail-telecom-outage.png": (32, 48, 52),
    "gtm-mk01-workflow-catalog-guide-wire-local.png": (28, 58, 52),
    "gtm-mk01-workflow-wire-ehr-messaging.png": (32, 52, 48),
    "gtm-mk01-workflow-wire-retail-payments.png": (36, 44, 50),
    "gtm-mk01-workflow-wire-telecom-integrations.png": (40, 48, 46),
    "gtm-we01-voice-profiles-natural-delivery.png": (46, 38, 58),
}


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


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate missing GTM deck placeholder PNGs")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files (default: only write when file is missing)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if any required GTM deck PNG is missing (no writes)",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    out = root / "docs" / "images"
    out.mkdir(parents=True, exist_ok=True)

    if args.check:
        missing = [n for n in GTM_DECK_REQUIRED_PNGS if not (out / n).is_file()]
        if missing:
            print("Missing GTM deck PNGs:", ", ".join(missing), file=sys.stderr)
            return 1
        print(f"OK — all {len(GTM_DECK_REQUIRED_PNGS)} GTM deck PNGs present under docs/images/")
        return 0

    wrote: list[str] = []
    skipped: list[str] = []
    for name, rgb in GTM_PLACEHOLDER_SPECS.items():
        path = out / name
        if path.is_file() and not args.force:
            skipped.append(name)
            continue
        write_solid_png(path, 1280, 720, rgb)
        wrote.append(name)

    if wrote:
        print("Wrote 1280×720 placeholders:", ", ".join(wrote))
    if skipped:
        print("Skipped (already present):", ", ".join(skipped))
    if not wrote and not skipped:
        print("No GTM placeholder specs configured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
