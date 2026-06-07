#!/usr/bin/env python3
"""Seed analytics demo calls for all buyer-demo-default variants (MK-01 GTM / Playwright).

Prints wr-* call ids mapped to E2E_GTM_* env vars used by gtm-deck-screenshots.spec.ts.

Usage (repo root, Postgres + migrated API env):
  python scripts/seed_gtm_all_buyer_demo_calls.py demo@example.com
  python scripts/seed_gtm_all_buyer_demo_calls.py demo@example.com --github-env >> "$GITHUB_ENV"
  python scripts/seed_gtm_all_buyer_demo_calls.py demo@example.com --export-lines
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULTS_PATH = REPO / "catalog" / "buyer-demo-defaults.json"

# Slug → Playwright / gtm_capture_deck env var (healthcare uses EHR demo seeder).
SLUG_ENV_KEYS: dict[str, str] = {
    "healthcare-clinic-screening": "E2E_GTM_SAMPLE_CALL_ID",
    "retail-wismo-faq": "E2E_GTM_RETAIL_CALL_ID",
    "telecom-utilities-outage-faq": "E2E_GTM_TELECOM_CALL_ID",
    "b2b-saas-trial-nurture": "E2E_GTM_B2B_CALL_ID",
    "insurance-fnol-faq": "E2E_GTM_INSURANCE_CALL_ID",
    "financial-services-banking-faq": "E2E_GTM_BANKING_CALL_ID",
    "hospitality-travel-concierge": "E2E_GTM_HOSPITALITY_CALL_ID",
    "smb-franchise-location-faq": "E2E_GTM_SMB_CALL_ID",
    "public-sector-civic-services-faq": "E2E_GTM_CIVIC_CALL_ID",
    "hr-staffing-recruiting-faq": "E2E_GTM_HR_CALL_ID",
}


def _load_defaults() -> dict[str, str]:
    data = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))
    return dict((data.get("defaults") or {}).items())


def _run_script(script: str, email: str, *extra: str) -> str | None:
    cmd = [sys.executable, str(REPO / "scripts" / script), email, *extra]
    env = {**os.environ, "PYTHONPATH": str(REPO)}
    try:
        out = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )
    except OSError:
        return None
    if out.returncode != 0:
        return None
    line = (out.stdout or "").strip().splitlines()
    return line[-1].strip() if line else None


async def _seed_slug(email: str, slug: str, variant_id: str) -> str | None:
    if slug == "healthcare-clinic-screening" and variant_id == "ehr_sync_complex":
        return _run_script("seed_gtm_healthcare_ehr_demo.py", email)
    return _run_script("seed_gtm_catalog_demo_call.py", email, slug, variant_id)


async def seed_all(email: str, *, only_unset: bool) -> dict[str, str]:
    defaults = _load_defaults()
    seeded: dict[str, str] = {}
    for slug, variant_id in sorted(defaults.items()):
        env_key = SLUG_ENV_KEYS.get(slug)
        if not env_key:
            continue
        if only_unset and os.environ.get(env_key, "").strip():
            existing = os.environ.get(env_key, "").strip()
            seeded[env_key] = existing
            continue
        call_id = await _seed_slug(email, slug, variant_id)
        if call_id:
            seeded[env_key] = call_id
    return seeded


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed all buyer-demo GTM analytics calls")
    parser.add_argument("email", help="OSS user email (same as E2E_EMAIL)")
    parser.add_argument(
        "--github-env",
        action="store_true",
        help="Print KEY=value lines suitable for appending to GITHUB_ENV",
    )
    parser.add_argument(
        "--export-lines",
        action="store_true",
        help="Print export KEY=value lines for shell eval",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON object of env_key → call_id",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-seed even when E2E_GTM_* env vars are already set",
    )
    args = parser.parse_args()

    env_file = REPO / "api" / ".env"
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    seeded = asyncio.run(seed_all(args.email, only_unset=not args.force))

    if args.json:
        print(json.dumps(seeded, indent=2, sort_keys=True))
    elif args.github_env or args.export_lines:
        for key, val in sorted(seeded.items()):
            if args.export_lines:
                print(f"export {key}={val!r}")
            else:
                print(f"{key}={val}")
    else:
        for key, val in sorted(seeded.items()):
            print(f"{key}={val}")

    return 0 if seeded else 1


if __name__ == "__main__":
    raise SystemExit(main())
