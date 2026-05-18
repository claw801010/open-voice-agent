#!/usr/bin/env python3
"""Insert one completed workflow run for GTM analytics call-detail screenshots."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

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
            "text": "I need to book an appointment.",
            "timestamp": "2026-04-20T12:00:00+00:00",
        },
        "timestamp": "2026-04-20T12:00:00+00:00",
    },
    {
        "type": "rtf-bot-text",
        "payload": {
            "text": "I can help schedule that for you.",
            "timestamp": "2026-04-20T12:00:01+00:00",
        },
        "timestamp": "2026-04-20T12:00:01+00:00",
    },
]


async def main() -> int:
    email = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("E2E_EMAIL", "")).strip()
    if not email:
        print("Usage: E2E_EMAIL=… python scripts/seed_gtm_analytics_demo_call.py", file=sys.stderr)
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

    wf = await db_client.create_workflow(
        "GTM analytics demo",
        _MIN_GRAPH,
        user.id,
        user.selected_organization_id,
    )
    await db_client.update_workflow(
        wf.id,
        wf.name,
        _MIN_GRAPH,
        None,
        {
            "mk01": {
                "catalog_slug": "healthcare-clinic-screening",
                "catalog_variant_id": "demo",
            }
        },
        user_id=user.id,
        organization_id=user.selected_organization_id,
    )
    run = await db_client.create_workflow_run(
        "gtm-demo-run",
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
        cost_info={"call_duration_seconds": 42.0},
        logs={"realtime_feedback_events": _TRANSCRIPT_EVENTS},
        is_completed=True,
    )
    call_id = f"wr-{run.id}"
    print(call_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
