"""Org-scoped local EHR patient records and audit trail (PHI-minimized persistence)."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from api.constants import APP_ROOT_DIR

_LOCK = threading.Lock()
_PATIENTS: dict[int, dict[str, dict[str, Any]]] = {}
_AUDIT: dict[int, list[dict[str, Any]]] = {}
_PERSIST_DIR = APP_ROOT_DIR.parent / "run" / "local_ehr"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _patients_path(org_id: int):
    return _PERSIST_DIR / f"org_{org_id}_patients.json"


def _audit_path(org_id: int):
    return _PERSIST_DIR / f"org_{org_id}_audit.json"


def _load_patients(org_id: int) -> dict[str, dict[str, Any]]:
    if org_id not in _PATIENTS:
        path = _patients_path(org_id)
        if path.is_file():
            try:
                with path.open(encoding="utf-8") as f:
                    data = json.load(f)
                _PATIENTS[org_id] = data if isinstance(data, dict) else {}
            except (json.JSONDecodeError, OSError):
                _PATIENTS[org_id] = {}
        else:
            _PATIENTS[org_id] = {}
    return dict(_PATIENTS[org_id])


def _save_patients(org_id: int, rows: dict[str, dict[str, Any]]) -> None:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    with _patients_path(org_id).open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)


def _load_audit(org_id: int) -> list[dict[str, Any]]:
    if org_id not in _AUDIT:
        path = _audit_path(org_id)
        if path.is_file():
            try:
                with path.open(encoding="utf-8") as f:
                    data = json.load(f)
                _AUDIT[org_id] = data if isinstance(data, list) else []
            except (json.JSONDecodeError, OSError):
                _AUDIT[org_id] = []
        else:
            _AUDIT[org_id] = []
    return list(_AUDIT[org_id])


def _save_audit(org_id: int, rows: list[dict[str, Any]]) -> None:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    trimmed = rows[-500:]
    with _audit_path(org_id).open("w", encoding="utf-8") as f:
        json.dump(trimmed, f, indent=2)


def append_audit(
    org_id: int,
    *,
    action: str,
    patient_token: str | None = None,
    detail: str | None = None,
    connector_vendor: str | None = None,
) -> None:
    """Append PHI-minimized audit entry (token + action only — no clinical text)."""
    entry = {
        "id": f"audit-{uuid.uuid4().hex[:10]}",
        "action": action,
        "patient_token": patient_token,
        "detail": detail,
        "connector_vendor": connector_vendor,
        "at": _now(),
    }
    with _LOCK:
        rows = _load_audit(org_id)
        rows.append(entry)
        _AUDIT[org_id] = rows
        _save_audit(org_id, rows)


def list_audit(org_id: int, *, limit: int = 50) -> list[dict[str, Any]]:
    with _LOCK:
        rows = _load_audit(org_id)
    return list(reversed(rows[-limit:]))


def list_patients(org_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        rows = _load_patients(org_id)
    return sorted(rows.values(), key=lambda p: p.get("updated_at") or "", reverse=True)


def get_patient(org_id: int, patient_token: str) -> dict[str, Any] | None:
    token = patient_token.strip().lower()
    if not token:
        return None
    with _LOCK:
        return _load_patients(org_id).get(token)


def upsert_patient(org_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    token = str(payload.get("patient_token") or payload.get("patient_id") or "").strip().lower()
    if not token:
        token = f"pt-{uuid.uuid4().hex[:10]}"
    now = _now()
    with _LOCK:
        rows = _load_patients(org_id)
        existing = rows.get(token, {})
        row = {
            **existing,
            **{k: v for k, v in payload.items() if v is not None and k != "organization_id"},
            "patient_id": token,
            "patient_token": token,
            "record_source": payload.get("record_source") or existing.get("record_source") or "local",
            "updated_at": now,
            "created_at": existing.get("created_at") or now,
        }
        rows[token] = row
        _PATIENTS[org_id] = rows
        _save_patients(org_id, rows)
    append_audit(org_id, action="patient_upsert", patient_token=token, detail="local_record")
    return row


def seed_demo_patients_if_empty(org_id: int) -> None:
    """Bootstrap Maria + demo patient for GTM when org has no local chart yet."""
    with _LOCK:
        rows = _load_patients(org_id)
        if rows:
            return
    demos = [
        {
            "patient_token": "maria-rodriguez",
            "display_name": "Maria Rodriguez",
            "mrn_token": "MRN-8842",
            "date_of_birth": "1978-04-12",
            "primary_insurance": "Blue Cross PPO",
            "active_medications": ["Meloxicam 7.5mg", "Vitamin D3"],
            "care_gaps": [
                {"gap_id": "gap-knee-mri", "label": "Knee MRI follow-up", "status": "open"},
                {"gap_id": "gap-a1c", "label": "A1c screening overdue", "status": "open"},
            ],
            "next_appointment": {
                "procedure": "Knee MRI",
                "location": "MetroWest Imaging",
                "slot_start": "2026-03-18T15:00:00Z",
            },
            "prior_auth": {
                "auth_id": "PA-99281",
                "procedure_code": "73721",
                "procedure_label": "MRI knee without contrast",
                "status": "approved",
                "expires_at": "2026-03-15T23:59:59Z",
                "payer": "Blue Cross",
            },
            "record_source": "local",
        },
        {
            "patient_token": "demo-patient",
            "display_name": "Demo Patient",
            "mrn_token": "MRN-DEMO",
            "date_of_birth": "1985-01-01",
            "primary_insurance": "Demo Payer",
            "active_medications": [],
            "care_gaps": [{"gap_id": "gap-annual", "label": "Annual wellness visit", "status": "open"}],
            "prior_auth": {
                "auth_id": "PA-DEMO",
                "procedure_code": "99213",
                "procedure_label": "Office visit",
                "status": "approved",
                "expires_at": "2026-12-31T23:59:59Z",
                "payer": "Demo Payer",
            },
            "record_source": "local",
        },
    ]
    for demo in demos:
        upsert_patient(org_id, demo)


def public_patient_view(patient: dict[str, Any]) -> dict[str, Any]:
    """API-safe patient row (no raw DOB in list views when redaction requested)."""
    return {
        "patient_id": patient.get("patient_id"),
        "patient_token": patient.get("patient_token"),
        "display_name": patient.get("display_name"),
        "mrn_token": patient.get("mrn_token"),
        "primary_insurance": patient.get("primary_insurance"),
        "open_care_gaps": [
            g for g in (patient.get("care_gaps") or []) if g.get("status") == "open"
        ],
        "record_source": patient.get("record_source", "local"),
        "connector_external_id": patient.get("connector_external_id"),
        "updated_at": patient.get("updated_at"),
    }
