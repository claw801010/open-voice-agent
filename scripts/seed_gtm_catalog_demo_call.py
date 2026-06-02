#!/usr/bin/env python3
"""Seed one completed analytics call with HTTP tool spans for any catalog slug + variant (MK-01)."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
VARIANT_TOOLS_PATH = REPO_ROOT / "catalog" / "catalog-variant-http-tools.json"
BUYER_DEFAULTS_PATH = REPO_ROOT / "catalog" / "buyer-demo-defaults.json"

_MIN_GRAPH = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {"id": "2", "type": "endCall", "data": {"name": "End", "prompt": "Bye"}},
    ],
    "edges": [{"id": "e1", "source": "1", "target": "2", "data": {"label": "End"}}],
}

_TRANSCRIPT_BY_SLUG: dict[str, list[dict[str, Any]]] = {
    "retail-wismo-faq": [
        {
            "type": "rtf-user-transcription",
            "payload": {
                "final": True,
                "text": "I want to set up a payment plan on my balance.",
                "timestamp": "2026-04-20T12:00:00+00:00",
            },
            "timestamp": "2026-04-20T12:00:00+00:00",
        },
        {
            "type": "rtf-bot-text",
            "payload": {
                "text": "I can capture a payment promise for twenty-five dollars per month.",
                "timestamp": "2026-04-20T12:00:01+00:00",
            },
            "timestamp": "2026-04-20T12:00:01+00:00",
        },
    ],
    "telecom-utilities-outage-faq": [
        {
            "type": "rtf-user-transcription",
            "payload": {
                "final": True,
                "text": "Is there an outage in my area? Zip 90210.",
                "timestamp": "2026-04-20T12:00:00+00:00",
            },
            "timestamp": "2026-04-20T12:00:00+00:00",
        },
        {
            "type": "rtf-bot-text",
            "payload": {
                "text": "There is an active outage. Crews estimate restore by six p.m. today.",
                "timestamp": "2026-04-20T12:00:01+00:00",
            },
            "timestamp": "2026-04-20T12:00:01+00:00",
        },
    ],
}

_DEFAULT_TRANSCRIPT = [
    {
        "type": "rtf-user-transcription",
        "payload": {
            "final": True,
            "text": "I need help with my account.",
            "timestamp": "2026-04-20T12:00:00+00:00",
        },
        "timestamp": "2026-04-20T12:00:00+00:00",
    },
    {
        "type": "rtf-bot-text",
        "payload": {
            "text": "One moment while I run that through our system.",
            "timestamp": "2026-04-20T12:00:01+00:00",
        },
        "timestamp": "2026-04-20T12:00:01+00:00",
    },
]

_TOOL_MAPPED: dict[str, dict[str, Any]] = {
    "capture_payment_promise": {
        "promised_amount": "25.00",
        "confirmation_code": "PROM-GTM",
        "payment_plan_id": "pp-gtm-1",
    },
    "lookup_outage_status": {
        "outage_status": "active",
        "customers_affected": 1200,
        "eta_restore": "2026-04-21T18:00:00Z",
    },
    "update_crm_deal_stage": {
        "deal_stage": "closed_won",
        "deal_id": "deal-gtm-1",
    },
    "book_qbr": {
        "appointment_id": "qbr-gtm-1",
        "slot_start": "2026-05-01T14:00:00Z",
        "confirmation_code": "QBR42",
    },
    "lookup_claim_status": {
        "claim_status": "in_review",
        "claim_id": "clm-gtm-1",
    },
    "apply_cancellation_waiver": {
        "waiver_status": "approved",
        "credit_amount": "75.00",
    },
    "lookup_account_balance": {
        "available_balance": "1240.50",
        "account_token": "acct-gtm",
    },
    "capture_lead_intent": {
        "intent_id": "lead-gtm-1",
        "confirmation_code": "LEAD99",
    },
    "lookup_permit_status": {
        "permit_status": "approved",
        "permit_id": "per-gtm-1",
    },
    "lookup_application_status": {
        "application_status": "interview_scheduled",
        "application_id": "app-gtm-1",
    },
    "book_slot": {
        "appointment_id": "appt-gtm-1",
        "slot_start": "2026-04-22T15:00:00Z",
        "confirmation_code": "BK42",
    },
}


def _load_variant_tools(slug: str, variant_id: str) -> list[str]:
    data = json.loads(VARIANT_TOOLS_PATH.read_text(encoding="utf-8"))
    tools = data.get(slug, {}).get(variant_id)
    if not isinstance(tools, list):
        return []
    return [str(t) for t in tools if t]


def _default_variant(slug: str) -> str:
    data = json.loads(BUYER_DEFAULTS_PATH.read_text(encoding="utf-8"))
    defaults = data.get("defaults") or {}
    return str(defaults.get(slug) or "booking_complex")


def _http_tool_events(
    tool_call_id: str,
    function_name: str,
    *,
    start_ts: str,
    end_ts: str,
    mapped_data: dict[str, Any],
    status_code: int = 200,
) -> list[dict[str, Any]]:
    payload = {
        "status": "success",
        "status_code": status_code,
        "mapped_data": mapped_data,
    }
    result = json.dumps(payload)
    return [
        {
            "type": "rtf-function-call-start",
            "payload": {"function_name": function_name, "tool_call_id": tool_call_id},
            "timestamp": start_ts,
        },
        {
            "type": "rtf-function-call-end",
            "payload": {
                "function_name": function_name,
                "tool_call_id": tool_call_id,
                "result": result,
            },
            "timestamp": end_ts,
        },
    ]


def _tool_span_events(tools: list[str]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for i, name in enumerate(tools):
        base_sec = 2 + i * 2
        mapped = dict(_TOOL_MAPPED.get(name) or {"confirmation_code": f"GTM{i}", "status": "success"})
        events += _http_tool_events(
            f"tc-{name}-{i}",
            name,
            start_ts=f"2026-04-20T12:00:{base_sec:02d}+00:00",
            end_ts=f"2026-04-20T12:00:{base_sec + 1:02d}+00:00",
            mapped_data=mapped,
            status_code=201 if name.startswith("book_") or name.startswith("capture_") else 200,
        )
    return events


async def main() -> int:
    email = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("E2E_EMAIL", "")).strip()
    slug = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get("BUYER_DEMO_SLUG", "")).strip()
    variant_id = (
        sys.argv[3] if len(sys.argv) > 3 else os.environ.get("BUYER_DEMO_VARIANT", "")
    ).strip()
    if not email:
        print(
            "Usage: E2E_EMAIL=… python scripts/seed_gtm_catalog_demo_call.py <email> <slug> [variant_id]",
            file=sys.stderr,
        )
        return 1
    if not slug:
        print("catalog slug is required", file=sys.stderr)
        return 1
    if not variant_id:
        variant_id = _default_variant(slug)

    if slug == "healthcare-clinic-screening" and variant_id == "ehr_sync_complex":
        print("Use seed_gtm_healthcare_ehr_demo.py for ehr_sync_complex", file=sys.stderr)
        return 1

    env_file = REPO_ROOT / "api" / ".env"
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    sys.path.insert(0, str(REPO_ROOT))
    os.environ.setdefault("LOG_LEVEL", "WARNING")

    from sqlalchemy import select

    from api.db import db_client
    from api.db.models import UserModel
    from api.enums import CallType

    tools = _load_variant_tools(slug, variant_id)
    if not tools:
        print(f"No tools for {slug}:{variant_id}", file=sys.stderr)
        return 1

    async with db_client.async_session() as session:
        result = await session.execute(select(UserModel).where(UserModel.email == email))
        user = result.scalar_one_or_none()
    if not user or not user.selected_organization_id:
        print(f"No OSS user with email {email!r}", file=sys.stderr)
        return 1

    org_id = int(user.selected_organization_id)
    transcript = _TRANSCRIPT_BY_SLUG.get(slug, _DEFAULT_TRANSCRIPT)
    tool_events = _tool_span_events(tools)
    logs = {"realtime_feedback_events": transcript + tool_events}

    wf = await db_client.create_workflow(
        f"GTM {slug} demo",
        _MIN_GRAPH,
        user.id,
        org_id,
    )
    await db_client.update_workflow(
        wf.id,
        wf.name,
        _MIN_GRAPH,
        None,
        {"mk01": {"catalog_slug": slug, "catalog_variant_id": variant_id}},
        user_id=user.id,
        organization_id=org_id,
    )
    run = await db_client.create_workflow_run(
        f"gtm-{slug}-run",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.INBOUND,
    )
    await db_client.update_workflow_run(
        run.id,
        gathered_context={"mapped_call_disposition": "completed", "outcome_key": "completed"},
        cost_info={"call_duration_seconds": 38.0 + len(tools) * 4},
        logs=logs,
        is_completed=True,
    )
    print(f"wr-{run.id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
