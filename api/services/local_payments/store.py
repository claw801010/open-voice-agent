"""Local demo payment promises + redirect confirms (MK-01 all-in-one)."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from api.constants import APP_ROOT_DIR

_LOCK = threading.Lock()
_STORE: dict[int, list[dict[str, Any]]] = {}
_PERSIST_DIR = APP_ROOT_DIR.parent / "run" / "local_payments"


def _persist_path(org_id: int) -> str:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    return str(_PERSIST_DIR / f"org_{org_id}.json")


def _load_org(org_id: int) -> list[dict[str, Any]]:
    path = _PERSIST_DIR / f"org_{org_id}.json"
    if not path.is_file():
        return []
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_org(org_id: int, rows: list[dict[str, Any]]) -> None:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    path = _PERSIST_DIR / f"org_{org_id}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)


def _rows_for_org(org_id: int) -> list[dict[str, Any]]:
    if org_id not in _STORE:
        _STORE[org_id] = _load_org(org_id)
    return list(_STORE[org_id])


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
                "resource_id": "local-payments",
            },
        },
        "confirmation_code": confirmation_code,
    }


def capture_payment_promise(
    org_id: int,
    *,
    account_reference: str | None = None,
    promised_amount: str | None = None,
    promised_date: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    record_id = f"local-promise-{uuid.uuid4().hex[:12]}"
    code = uuid.uuid4().hex[:6].upper()
    slot = promised_date or datetime.now(timezone.utc).isoformat()
    row = {
        "id": record_id,
        "type": "payment_promise",
        "account_reference": account_reference,
        "promised_amount": promised_amount,
        "promised_date": promised_date,
        "notes": notes,
        "confirmation_code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "recorded",
    }
    with _LOCK:
        rows = _rows_for_org(org_id)
        rows.append(row)
        _STORE[org_id] = rows
        _save_org(org_id, rows)
    return _booking_compatible_response(record_id, slot_start=slot, confirmation_code=code)


def confirm_payment_redirect(
    org_id: int,
    *,
    account_reference: str | None = None,
    redirect_url: str | None = None,
    reason_code: str | None = None,
) -> dict[str, Any]:
    record_id = f"local-redirect-{uuid.uuid4().hex[:12]}"
    code = uuid.uuid4().hex[:6].upper()
    slot = datetime.now(timezone.utc).isoformat()
    row = {
        "id": record_id,
        "type": "payment_redirect",
        "account_reference": account_reference,
        "redirect_url": redirect_url,
        "reason_code": reason_code,
        "confirmation_code": code,
        "created_at": slot,
        "status": "confirmed",
    }
    with _LOCK:
        rows = _rows_for_org(org_id)
        rows.append(row)
        _STORE[org_id] = rows
        _save_org(org_id, rows)
    payload = _booking_compatible_response(record_id, slot_start=slot, confirmation_code=code)
    payload["redirect_id"] = record_id
    payload["portal_url"] = redirect_url or "https://pay.local.dograh.demo/redirect"
    payload["expires_at"] = slot
    return payload


def enroll_concierge_visit(
    org_id: int,
    *,
    visit_type: str | None = None,
    slot_start: str | None = None,
    patient_name: str | None = None,
) -> dict[str, Any]:
    record_id = f"local-enroll-{uuid.uuid4().hex[:12]}"
    code = uuid.uuid4().hex[:6].upper()
    slot = slot_start or datetime.now(timezone.utc).isoformat()
    row = {
        "id": record_id,
        "type": "concierge_enroll",
        "visit_type": visit_type,
        "slot_start": slot,
        "patient_name": patient_name,
        "confirmation_code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "enrolled",
    }
    with _LOCK:
        rows = _rows_for_org(org_id)
        rows.append(row)
        _STORE[org_id] = rows
        _save_org(org_id, rows)
    return _booking_compatible_response(record_id, slot_start=slot, confirmation_code=code)
