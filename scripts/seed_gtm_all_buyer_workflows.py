#!/usr/bin/env python3
"""Install catalog workflows for all buyer-demo-default variants (MK-01 GTM / Playwright).

Prints numeric workflow ids mapped to E2E_GTM_*_WORKFLOW_ID env vars for gtm-deck-screenshots.spec.ts.

Usage:
  E2E_EMAIL=… E2E_PASSWORD=… python scripts/seed_gtm_all_buyer_workflows.py
  python scripts/seed_gtm_all_buyer_workflows.py demo@example.com --github-env >> "$GITHUB_ENV"
  python scripts/seed_gtm_all_buyer_workflows.py demo@example.com --unlock
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULTS_PATH = REPO / "catalog" / "buyer-demo-defaults.json"

SLUG_WORKFLOW_ENV_KEYS: dict[str, str] = {
    "healthcare-clinic-screening": "E2E_GTM_WORKFLOW_ID",
    "retail-wismo-faq": "E2E_GTM_RETAIL_WORKFLOW_ID",
    "telecom-utilities-outage-faq": "E2E_GTM_TELECOM_WORKFLOW_ID",
    "b2b-saas-trial-nurture": "E2E_GTM_B2B_WORKFLOW_ID",
    "insurance-fnol-faq": "E2E_GTM_INSURANCE_WORKFLOW_ID",
    "financial-services-banking-faq": "E2E_GTM_BANKING_WORKFLOW_ID",
    "hospitality-travel-concierge": "E2E_GTM_HOSPITALITY_WORKFLOW_ID",
    "smb-franchise-location-faq": "E2E_GTM_SMB_WORKFLOW_ID",
    "public-sector-civic-services-faq": "E2E_GTM_CIVIC_WORKFLOW_ID",
    "hr-staffing-recruiting-faq": "E2E_GTM_HR_WORKFLOW_ID",
}


def _load_defaults() -> dict[str, str]:
    data = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))
    return dict((data.get("defaults") or {}).items())


def _run_seed_workflow(email: str, slug: str, variant_id: str) -> str | None:
    env = {
        **os.environ,
        "PYTHONPATH": str(REPO),
        "GTM_CATALOG_SLUG": slug,
        "GTM_CATALOG_VARIANT": variant_id,
    }
    try:
        out = subprocess.run(
            [sys.executable, str(REPO / "scripts" / "seed_gtm_catalog_workflow.py"), email],
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )
    except OSError:
        return None
    if out.returncode != 0:
        return None
    lines = (out.stdout or "").strip().splitlines()
    return lines[-1].strip() if lines else None


def _unlock(email: str, workflow_id: str) -> None:
    env = {**os.environ, "PYTHONPATH": str(REPO)}
    subprocess.run(
        [
            sys.executable,
            str(REPO / "scripts" / "gtm_unlock_workflow_editor.py"),
            email,
            workflow_id,
        ],
        capture_output=True,
        check=False,
        env=env,
    )


def seed_all(email: str, *, only_unset: bool, unlock: bool) -> dict[str, str]:
    defaults = _load_defaults()
    seeded: dict[str, str] = {}
    for slug, variant_id in sorted(defaults.items()):
        env_key = SLUG_WORKFLOW_ENV_KEYS.get(slug)
        if not env_key:
            continue
        if only_unset and os.environ.get(env_key, "").strip():
            seeded[env_key] = os.environ.get(env_key, "").strip()
            continue
        wf_id = _run_seed_workflow(email, slug, variant_id)
        if wf_id:
            seeded[env_key] = wf_id
            if unlock:
                _unlock(email, wf_id)
    return seeded


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed all buyer-demo catalog workflows")
    parser.add_argument("email", nargs="?", default=os.environ.get("E2E_EMAIL", ""))
    parser.add_argument("--github-env", action="store_true")
    parser.add_argument("--export-lines", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--force", action="store_true", help="Re-install even when env vars set")
    parser.add_argument(
        "--unlock",
        action="store_true",
        help="Run gtm_unlock_workflow_editor.py on each seeded workflow",
    )
    args = parser.parse_args()
    email = (args.email or "").strip()
    if not email:
        print("email or E2E_EMAIL required", file=sys.stderr)
        return 1
    if not os.environ.get("E2E_PASSWORD", "").strip():
        print("E2E_PASSWORD is required", file=sys.stderr)
        return 1

    seeded = seed_all(email, only_unset=not args.force, unlock=args.unlock)

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
