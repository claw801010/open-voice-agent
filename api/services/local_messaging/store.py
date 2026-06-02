"""Local demo SMS / email outbound log (no Twilio or SendGrid required)."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from api.constants import APP_ROOT_DIR

Channel = Literal["sms", "email"]

_LOCK = threading.Lock()
_ROWS: dict[int, list[dict[str, Any]]] = {}
_PERSIST_DIR = APP_ROOT_DIR.parent / "run" / "local_messaging"


def _rows(org_id: int) -> list[dict[str, Any]]:
    if org_id not in _ROWS:
        path = _PERSIST_DIR / f"org_{org_id}.json"
        if path.is_file():
            try:
                with path.open(encoding="utf-8") as f:
                    data = json.load(f)
                _ROWS[org_id] = data if isinstance(data, list) else []
            except (json.JSONDecodeError, OSError):
                _ROWS[org_id] = []
        else:
            _ROWS[org_id] = []
    return list(_ROWS[org_id])


def _save(org_id: int, rows: list[dict[str, Any]]) -> None:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    path = _PERSIST_DIR / f"org_{org_id}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)


def list_messages(org_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        return _rows(org_id)


def send_message(
    org_id: int,
    *,
    channel: Channel,
    to_address: str,
    body: str,
    subject: str | None = None,
    patient_name: str | None = None,
) -> dict[str, Any]:
    msg_id = f"msg-{uuid.uuid4().hex[:12]}"
    row = {
        "id": msg_id,
        "channel": channel,
        "to": to_address.strip(),
        "body": body.strip(),
        "subject": (subject or "").strip() or None,
        "patient_name": (patient_name or "").strip() or None,
        "status": "queued",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    with _LOCK:
        items = _rows(org_id)
        items.append(row)
        _ROWS[org_id] = items
        _save(org_id, items)
    return {
        "message_id": msg_id,
        "channel": channel,
        "status": "sent",
        "status_code": "sent",
        "confirmation_code": msg_id[-8:].upper(),
        "sent_at": row["sent_at"],
        "to": row["to"],
    }
