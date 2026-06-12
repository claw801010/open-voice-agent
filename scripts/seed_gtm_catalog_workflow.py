#!/usr/bin/env python3
"""Install a catalog workflow for GTM wire-local / voice-profile screenshots."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUYER_DEFAULTS_PATH = os.path.join(ROOT, "catalog", "buyer-demo-defaults.json")


def _request(
    method: str,
    base: str,
    path: str,
    *,
    body: dict | None = None,
    token: str | None = None,
) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def _default_variant(slug: str) -> str:
    data = json.loads(open(BUYER_DEFAULTS_PATH, encoding="utf-8").read())
    return str((data.get("defaults") or {}).get(slug) or "booking_complex")


def _workflow_name(slug: str, variant_id: str) -> str:
    custom = os.environ.get("GTM_WORKFLOW_NAME", "").strip()
    if custom:
        return custom
    return f"GTM {slug} ({variant_id})"


def main() -> int:
    email = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("E2E_EMAIL", "")).strip()
    slug = (
        sys.argv[2]
        if len(sys.argv) > 2
        else os.environ.get("GTM_CATALOG_SLUG", "healthcare-clinic-screening")
    ).strip()
    variant_id = (
        sys.argv[3]
        if len(sys.argv) > 3
        else os.environ.get("GTM_CATALOG_VARIANT", "")
    ).strip()
    if not email:
        print(
            "Usage: E2E_EMAIL=… E2E_PASSWORD=… python scripts/seed_gtm_catalog_workflow.py "
            "[email] [catalog_slug] [variant_id]",
            file=sys.stderr,
        )
        return 1
    if not variant_id:
        variant_id = _default_variant(slug)

    base = os.environ.get("E2E_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    password = os.environ.get("E2E_PASSWORD")
    if not password:
        print("E2E_PASSWORD is required", file=sys.stderr)
        return 1

    workflow_name = _workflow_name(slug, variant_id)

    try:
        login = _request(
            "POST",
            base,
            "/api/v1/auth/login",
            body={"email": email, "password": password},
        )
        token = login["token"]

        workflows = _request("GET", base, "/api/v1/workflow/fetch", token=token)
        items = workflows if isinstance(workflows, list) else workflows.get("workflows") or []
        for wf in items:
            if isinstance(wf, dict) and wf.get("name") == workflow_name:
                wf_id = wf.get("id")
                if wf_id is not None:
                    print(int(wf_id))
                    return 0

        installed = _request(
            "POST",
            base,
            "/api/v1/workflow/install-from-catalog",
            body={
                "slug": slug,
                "workflow_name": workflow_name,
                "variant_id": variant_id,
            },
            token=token,
        )
        wf_id = installed.get("id")
        if wf_id is None:
            print("install-from-catalog returned no workflow id", file=sys.stderr)
            return 1
        print(int(wf_id))
        return 0
    except urllib.error.HTTPError as e:
        print(f"seed catalog workflow failed: HTTP {e.code}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
