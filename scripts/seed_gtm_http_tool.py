#!/usr/bin/env python3
"""Create or reuse a booking-style HTTP tool for GTM happy-path screenshots."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

_GTM_TOOL_NAME = "GTM book_slot demo"


def _tool_definition() -> dict:
    backend = os.environ.get("BACKEND_API_ENDPOINT", "http://127.0.0.1:8000").rstrip("/")
    url = f"{backend}/api/v1/local-scheduling/api/v1/appointments"
    return {
        "schema_version": 1,
        "type": "http_api",
        "config": {
            "method": "POST",
            "url": url,
            "parameters": [
                {
                    "name": "patient_name",
                    "type": "string",
                    "description": "Caller name for the appointment",
                    "required": True,
                },
            ],
            "response_mapping": {
                "appointment_id": "appointment.id",
                "confirmation_code": "confirmation_code",
                "slot_start": "appointment.slot.start",
            },
            "body_template": '{"slot_start": "2026-12-15T10:00:00Z", "patient_name": "{{conversation.caller_name}}", "organization_id": 1}',
        },
    }


async def main() -> int:
    email = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("E2E_EMAIL", "")).strip()
    if not email:
        print("Usage: E2E_EMAIL=… python scripts/seed_gtm_http_tool.py", file=sys.stderr)
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
    from api.enums import ToolCategory

    async with db_client.async_session() as session:
        result = await session.execute(select(UserModel).where(UserModel.email == email))
        user = result.scalar_one_or_none()
    if not user or not user.selected_organization_id:
        print(f"No OSS user with email {email!r}", file=sys.stderr)
        return 1

    org_id = user.selected_organization_id
    existing = await db_client.get_tools_for_organization(org_id, category=ToolCategory.HTTP_API.value)
    for tool in existing:
        if tool.name == _GTM_TOOL_NAME:
            print(tool.tool_uuid)
            return 0

    tool = await db_client.create_tool(
        organization_id=org_id,
        user_id=user.id,
        name=_GTM_TOOL_NAME,
        definition=_tool_definition(),
        category=ToolCategory.HTTP_API.value,
        description="GTM demo — local scheduling book with response_mapping for analytics proof.",
        icon="globe",
        icon_color="#3B82F6",
    )
    print(tool.tool_uuid)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
