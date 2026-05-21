#!/usr/bin/env python3
"""Unlock a catalog-installed workflow editor for GTM / Playwright screenshots."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: gtm_unlock_workflow_editor.py <email> <workflow_id>", file=sys.stderr)
        return 2

    email, workflow_id = sys.argv[1], sys.argv[2]
    base = os.environ.get("E2E_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    password = os.environ.get("E2E_PASSWORD")
    if not password:
        print("E2E_PASSWORD is required", file=sys.stderr)
        return 2

    try:
        login = _request(
            "POST",
            base,
            "/api/v1/auth/login",
            body={"email": email, "password": password},
        )
        token = login["token"]
        wf = _request(
            "GET",
            base,
            f"/api/v1/workflow/fetch/{workflow_id}",
            token=token,
        )
        cfg = wf.get("workflow_configurations") or {}
        mk01 = cfg.get("mk01") if isinstance(cfg.get("mk01"), dict) else {}
        if not mk01.get("installation_locked"):
            return 0
        mk01 = {**mk01, "installation_locked": False}
        cfg = {**cfg, "mk01": mk01}
        _request(
            "PUT",
            base,
            f"/api/v1/workflow/{workflow_id}",
            body={"workflow_configurations": cfg},
            token=token,
        )
    except urllib.error.HTTPError as e:
        print(f"unlock failed: HTTP {e.code}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
