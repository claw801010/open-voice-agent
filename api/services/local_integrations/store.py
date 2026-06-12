"""Local demo integration actions (CRM, OSS, ATS, etc.) with booking-shaped JSON."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from api.constants import APP_ROOT_DIR

_LOCK = threading.Lock()
_STORE: dict[int, list[dict[str, Any]]] = {}
_PERSIST_DIR = APP_ROOT_DIR.parent / "run" / "local_integrations"


def _rows_for_org(org_id: int) -> list[dict[str, Any]]:
    if org_id not in _STORE:
        path = _PERSIST_DIR / f"org_{org_id}.json"
        if path.is_file():
            try:
                with path.open(encoding="utf-8") as f:
                    data = json.load(f)
                _STORE[org_id] = data if isinstance(data, list) else []
            except (json.JSONDecodeError, OSError):
                _STORE[org_id] = []
        else:
            _STORE[org_id] = []
    return list(_STORE[org_id])


def _save_org(org_id: int, rows: list[dict[str, Any]]) -> None:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    path = _PERSIST_DIR / f"org_{org_id}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)


def list_records(org_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        return _rows_for_org(org_id)


def _booking_compatible_response(
    record_id: str,
    *,
    slot_start: str,
    confirmation_code: str,
    status: str = "confirmed",
) -> dict[str, Any]:
    return {
        "appointment": {
            "id": record_id,
            "status": status,
            "slot": {
                "start": slot_start,
                "resource_id": "local-integrations",
            },
        },
        "confirmation_code": confirmation_code,
    }


def record_action(
    org_id: int,
    action_type: str,
    *,
    path: str,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist an integration action and return booking-compatible JSON for mapped_data."""
    body = body or {}
    record_id = f"local-{action_type}-{uuid.uuid4().hex[:12]}"
    code = (
        str(body.get("status_code") or body.get("confirmation_code") or "")
        or uuid.uuid4().hex[:6].upper()
    )
    slot = (
        body.get("slot_start")
        or body.get("follow_up_by")
        or body.get("last_updated")
        or body.get("as_of_date")
        or body.get("blocked_at")
        or body.get("stage_updated_at")
        or body.get("upgrade_effective")
        or body.get("new_check_in")
        or body.get("promised_date")
        or datetime.now(timezone.utc).isoformat()
    )
    row = {
        "id": record_id,
        "type": action_type,
        "path": path,
        "request": body,
        "confirmation_code": code,
        "slot_start": slot,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "recorded",
    }
    with _LOCK:
        rows = _rows_for_org(org_id)
        rows.append(row)
        _STORE[org_id] = rows
        _save_org(org_id, rows)
    return _booking_compatible_response(record_id, slot_start=str(slot), confirmation_code=code)
