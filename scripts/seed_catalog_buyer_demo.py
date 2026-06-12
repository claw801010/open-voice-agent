#!/usr/bin/env python3
"""Install a catalog workflow variant and print buyer-demo URLs (MK-01).

High-value sales / SE path: install complex variant → workflow editor + analytics proof links.

Usage:
  E2E_EMAIL=… E2E_PASSWORD=… python scripts/seed_catalog_buyer_demo.py \\
    healthcare-clinic-screening booking_complex

Optional env:
  E2E_BACKEND_URL   (default http://127.0.0.1:8000)
  UI_BASE_URL       (default http://127.0.0.1:3000)
  BUYER_DEMO_NAME   (default "<display> buyer demo")
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VARIANT_TOOLS_PATH = os.path.join(ROOT, "catalog", "catalog-variant-http-tools.json")
PACKS_PATH = os.path.join(ROOT, "catalog", "vertical-packs.json")
BUYER_DEFAULTS_PATH = os.path.join(ROOT, "catalog", "buyer-demo-defaults.json")

_SKIP_PRIMARY_TOOLS = frozenset({"lookup_availability", "reserve_pickup_slot"})


def _request(
    method: str,
    base: str,
    path: str,
    *,
    body: dict | None = None,
    token: str | None = None,
) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def _load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _display_name_for_slug(slug: str) -> str:
    packs = _load_json(PACKS_PATH).get("packs") or []
    for pack in packs:
        if isinstance(pack, dict) and pack.get("slug") == slug:
            name = (pack.get("display_name") or "").strip()
            if name:
                return name
    return slug


def _primary_tool(slug: str, variant_id: str) -> str | None:
    variant_tools = _load_json(VARIANT_TOOLS_PATH)
    tools = variant_tools.get(slug, {}).get(variant_id)
    if not tools:
        return None
    for name in tools:
        if name not in _SKIP_PRIMARY_TOOLS:
            return name
    return tools[0]


def _analytics_calls_href(
    ui_base: str,
    *,
    slug: str,
    variant_id: str,
    tool_name: str | None,
) -> str:
    q: dict[str, str] = {"catalog_slug": slug, "catalog_variant_id": variant_id}
    if tool_name:
        q["tool_name"] = tool_name
    return f"{ui_base.rstrip('/')}/analytics/calls?{urllib.parse.urlencode(q)}"


def _analytics_overview_href(ui_base: str, *, slug: str, variant_id: str) -> str:
    q = {"catalog_slug": slug, "catalog_variant_id": variant_id, "days": "7"}
    return f"{ui_base.rstrip('/')}/analytics?{urllib.parse.urlencode(q)}"


def _review_inbox_href(ui_base: str) -> str:
    return f"{ui_base.rstrip('/')}/analytics/review"


def _settings_href(ui_base: str, slug: str) -> str | None:
    data = _load_json(BUYER_DEFAULTS_PATH)
    section = (data.get("settings_sections") or {}).get(slug)
    if not section:
        return None
    return f"{ui_base.rstrip('/')}/settings#{section}"


def _is_ehr_sync_variant(variant_id: str) -> bool:
    return variant_id.strip() == "ehr_sync_complex"


def _buyer_default_variant(slug: str) -> str:
    data = _load_json(BUYER_DEFAULTS_PATH)
    return str((data.get("defaults") or {}).get(slug) or "booking_complex")


def _resolve_variant_id(slug: str, argv_variant: str | None) -> str:
    if argv_variant and argv_variant.strip():
        return argv_variant.strip()
    env_variant = os.environ.get("BUYER_DEMO_VARIANT", "").strip()
    if env_variant:
        return env_variant
    return _buyer_default_variant(slug) if slug else "booking_complex"


def _seed_demo_call(
    *,
    slug: str,
    variant_id: str,
    email: str,
    password: str,
    base: str,
) -> str:
    import subprocess

    if _is_ehr_sync_variant(variant_id):
        seed_script = os.path.join(ROOT, "scripts", "seed_gtm_healthcare_ehr_demo.py")
        cmd = [sys.executable, seed_script, email]
    else:
        seed_script = os.path.join(ROOT, "scripts", "seed_gtm_catalog_demo_call.py")
        cmd = [sys.executable, seed_script, email, slug, variant_id]
    env = {**os.environ, "E2E_EMAIL": email, "E2E_PASSWORD": password, "E2E_BACKEND_URL": base}
    proc = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd=ROOT)
    if proc.returncode != 0:
        return ""
    lines = [ln.strip() for ln in (proc.stdout or "").splitlines() if ln.strip()]
    call_id = lines[-1] if lines else ""
    return call_id if call_id.startswith("wr-") else ""


def main() -> int:
    slug = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BUYER_DEMO_SLUG", "")).strip()
    argv_variant = sys.argv[2].strip() if len(sys.argv) > 2 else None
    variant_id = _resolve_variant_id(slug, argv_variant)
    if not slug:
        print(
            "Usage: E2E_EMAIL=… E2E_PASSWORD=… python scripts/seed_catalog_buyer_demo.py "
            "<catalog_slug> [variant_id]",
            file=sys.stderr,
        )
        return 1

    email = os.environ.get("E2E_EMAIL", "").strip()
    password = os.environ.get("E2E_PASSWORD", "").strip()
    if not email or not password:
        print("E2E_EMAIL and E2E_PASSWORD are required", file=sys.stderr)
        return 1

    base = os.environ.get("E2E_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    ui_base = os.environ.get("UI_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
    display = _display_name_for_slug(slug)
    workflow_name = (os.environ.get("BUYER_DEMO_NAME") or f"{display} buyer demo").strip()
    primary_tool = _primary_tool(slug, variant_id)

    try:
        login = _request("POST", base, "/api/v1/auth/login", body={"email": email, "password": password})
        token = login["token"]

        workflows = _request("GET", base, "/api/v1/workflow/fetch", token=token)
        items = workflows if isinstance(workflows, list) else workflows.get("workflows") or []
        wf_id: int | None = None
        for wf in items:
            if isinstance(wf, dict) and wf.get("name") == workflow_name:
                raw = wf.get("id")
                if raw is not None:
                    wf_id = int(raw)
                    break

        if wf_id is None:
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
            raw = installed.get("id")
            if raw is None:
                print("install-from-catalog returned no workflow id", file=sys.stderr)
                return 1
            wf_id = int(raw)

        out = {
            "workflow_id": wf_id,
            "catalog_slug": slug,
            "catalog_variant_id": variant_id,
            "primary_tool_name": primary_tool,
            "workflow_editor_url": f"{ui_base}/workflow/{wf_id}",
            "analytics_overview_url": _analytics_overview_href(ui_base, slug=slug, variant_id=variant_id),
            "analytics_calls_proof_url": _analytics_calls_href(
                ui_base,
                slug=slug,
                variant_id=variant_id,
                tool_name=primary_tool,
            ),
            "catalog_url": f"{ui_base}/workflow/catalog",
        }
        if _is_ehr_sync_variant(variant_id):
            out["review_inbox_url"] = _review_inbox_href(ui_base)
            out["buyer_story"] = (
                "Saga-style: patient context before hello, prior auth, book, SMS, chart sync, review inbox"
            )
        settings_url = _settings_href(ui_base, slug)
        if settings_url:
            out["settings_local_module_url"] = settings_url

        if os.environ.get("BUYER_DEMO_SEED_CALL", "").strip() == "1":
            call_id = _seed_demo_call(
                slug=slug,
                variant_id=variant_id,
                email=email,
                password=password,
                base=base,
            )
            if call_id:
                out["demo_call_id"] = call_id
                out["analytics_call_detail_url"] = (
                    f"{ui_base.rstrip('/')}/analytics/calls/{urllib.parse.quote(call_id, safe='')}"
                )
        print(json.dumps(out, indent=2))
        return 0
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"seed catalog buyer demo failed: HTTP {e.code} {body}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
