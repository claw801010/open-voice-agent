#!/usr/bin/env python3
"""Seed healthcare EHR GTM demo: analytics call with tool spans, review inbox item, local EHR sync log."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]

_MIN_GRAPH = {
    "nodes": [
        {"id": "1", "type": "startCall", "data": {"name": "Start", "prompt": "Hello"}},
        {"id": "2", "type": "endCall", "data": {"name": "End", "prompt": "Bye"}},
    ],
    "edges": [{"id": "e1", "source": "1", "target": "2", "data": {"label": "End"}}],
}

_TRANSCRIPT_EVENTS = [
    {
        "type": "rtf-user-transcription",
        "payload": {
            "final": True,
            "text": "Hi, I need to schedule my knee MRI and confirm my prior auth.",
            "timestamp": "2026-04-20T12:00:00+00:00",
        },
        "timestamp": "2026-04-20T12:00:00+00:00",
    },
    {
        "type": "rtf-bot-text",
        "payload": {
            "text": "I have Maria Rodriguez on file with Blue Cross prior auth approved. Booking Tuesday at 3pm.",
            "timestamp": "2026-04-20T12:00:01+00:00",
        },
        "timestamp": "2026-04-20T12:00:01+00:00",
    },
]


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


def _healthcare_tool_span_events() -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    events += _http_tool_events(
        "tc-ctx-1",
        "lookup_patient_context",
        start_ts="2026-04-20T12:00:02+00:00",
        end_ts="2026-04-20T12:00:03+00:00",
        mapped_data={
            "patient_token": "maria-rodriguez",
            "display_name": "Maria Rodriguez",
            "record_source": "local_and_connector",
        },
    )
    events += _http_tool_events(
        "tc-pa-1",
        "verify_prior_auth",
        start_ts="2026-04-20T12:00:04+00:00",
        end_ts="2026-04-20T12:00:05+00:00",
        mapped_data={
            "status": "approved",
            "status_code": "approved",
            "expires_at": "2026-08-01",
            "procedure_code": "73721",
        },
    )
    events += _http_tool_events(
        "tc-book-1",
        "book_slot",
        start_ts="2026-04-20T12:00:06+00:00",
        end_ts="2026-04-20T12:00:07+00:00",
        mapped_data={
            "appointment_id": "appt-gtm-mri",
            "slot_start": "2026-04-22T15:00:00Z",
            "confirmation_code": "MRI42",
        },
        status_code=201,
    )
    events += _http_tool_events(
        "tc-sms-1",
        "send_confirmation_sms",
        start_ts="2026-04-20T12:00:08+00:00",
        end_ts="2026-04-20T12:00:09+00:00",
        mapped_data={"message_id": "msg-gtm-1", "status": "queued"},
    )
    events += _http_tool_events(
        "tc-ehr-1",
        "sync_chart_to_ehr",
        start_ts="2026-04-20T12:00:10+00:00",
        end_ts="2026-04-20T12:00:11+00:00",
        mapped_data={
            "connector_sync_status": "synced",
            "ehr_vendor": "athenahealth",
            "status_code": "synced",
        },
    )
    return events


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
        raw = resp.read()
        return json.loads(raw) if raw else {}


def _seed_ehr_and_review_inbox(
    *,
    base: str,
    token: str,
    org_id: int,
    call_id: str,
) -> None:
    try:
        _request(
            "PUT",
            base,
            "/api/v1/local-ehr/connector",
            body={
                "record_keeping_mode": "local_with_connector",
                "vendor": "athenahealth",
                "connector_sync_enabled": True,
            },
            token=token,
        )
        _request(
            "POST",
            base,
            "/api/v1/local-ehr/api/v1/chart/sync",
            body={
                "organization_id": org_id,
                "patient_token": "maria-rodriguez",
                "summary": "GTM demo — MRI scheduled, prior auth verified, SMS sent.",
                "appointment_id": "appt-gtm-mri",
            },
        )
    except urllib.error.HTTPError as e:
        print(f"WARN: local EHR seed skipped (HTTP {e.code})", file=sys.stderr)

    try:
        _request(
            "POST",
            base,
            f"/api/v1/analytics/calls/{call_id}/follow-ups",
            body={
                "action_type": "sms",
                "notes": "Prior auth appeal draft — human review before send",
                "contact_hint": "Maria Rodriguez",
                "suggested_message": (
                    "We are appealing your MRI prior auth with Blue Cross. "
                    "Expect a callback within 24 hours."
                ),
                "requires_review": True,
            },
            token=token,
        )
    except urllib.error.HTTPError as e:
        print(f"WARN: review inbox seed skipped (HTTP {e.code})", file=sys.stderr)


async def main() -> int:
    email = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("E2E_EMAIL", "")).strip()
    if not email:
        print("Usage: E2E_EMAIL=… python scripts/seed_gtm_healthcare_ehr_demo.py", file=sys.stderr)
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

    async with db_client.async_session() as session:
        result = await session.execute(select(UserModel).where(UserModel.email == email))
        user = result.scalar_one_or_none()
    if not user or not user.selected_organization_id:
        print(f"No OSS user with email {email!r}", file=sys.stderr)
        return 1

    org_id = int(user.selected_organization_id)
    tool_events = _healthcare_tool_span_events()
    logs = {"realtime_feedback_events": _TRANSCRIPT_EVENTS + tool_events}

    wf = await db_client.create_workflow(
        "GTM healthcare EHR demo",
        _MIN_GRAPH,
        user.id,
        org_id,
    )
    await db_client.update_workflow(
        wf.id,
        wf.name,
        _MIN_GRAPH,
        None,
        {
            "mk01": {
                "catalog_slug": "healthcare-clinic-screening",
                "catalog_variant_id": "ehr_sync_complex",
            }
        },
        user_id=user.id,
        organization_id=org_id,
    )
    run = await db_client.create_workflow_run(
        "gtm-healthcare-ehr-run",
        wf.id,
        "smallwebrtc",
        user.id,
        call_type=CallType.INBOUND,
    )
    await db_client.update_workflow_run(
        run.id,
        gathered_context={
            "mapped_call_disposition": "completed",
            "outcome_key": "booked",
        },
        cost_info={"call_duration_seconds": 68.0},
        logs=logs,
        is_completed=True,
    )
    call_id = f"wr-{run.id}"

    password = os.environ.get("E2E_PASSWORD", "").strip()
    base = os.environ.get("E2E_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    if password:
        try:
            login = _request(
                "POST",
                base,
                "/api/v1/auth/login",
                body={"email": email, "password": password},
            )
            _seed_ehr_and_review_inbox(
                base=base,
                token=login["token"],
                org_id=org_id,
                call_id=call_id,
            )
        except urllib.error.HTTPError as e:
            print(f"WARN: API seed after DB insert failed (HTTP {e.code})", file=sys.stderr)

    print(call_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
