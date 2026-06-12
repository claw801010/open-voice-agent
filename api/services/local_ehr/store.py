"""Local EHR context, prior auth, chart sync — local records + optional connector push."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from api.constants import APP_ROOT_DIR
from api.services.local_ehr import records

EhrVendor = Literal["none", "athenahealth", "epic", "cerner", "ecw"]
RecordKeepingMode = Literal["local_only", "local_with_connector"]

_LOCK = threading.Lock()
_CONFIG: dict[int, dict[str, Any]] = {}
_SYNC_ROWS: dict[int, list[dict[str, Any]]] = {}
_PERSIST_DIR = APP_ROOT_DIR.parent / "run" / "local_ehr"

_VENDOR_LABELS = {
    "none": "Local only (no connector)",
    "athenahealth": "athenaHealth",
    "epic": "Epic",
    "cerner": "Cerner",
    "ecw": "eClinicalWorks",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_config() -> dict[str, Any]:
    return {
        "record_keeping_mode": "local_only",
        "vendor": "none",
        "display_name": _VENDOR_LABELS["none"],
        "connector_sync_enabled": False,
        "phi_minimization": True,
        "audit_enabled": True,
        "updated_at": _now(),
    }


def _load_config(org_id: int) -> dict[str, Any]:
    if org_id not in _CONFIG:
        path = _PERSIST_DIR / f"org_{org_id}_config.json"
        if path.is_file():
            try:
                with path.open(encoding="utf-8") as f:
                    data = json.load(f)
                cfg = data if isinstance(data, dict) else _default_config()
                # Migrate legacy configs without record_keeping_mode
                if "record_keeping_mode" not in cfg:
                    vendor = cfg.get("vendor") or "athenahealth"
                    sync = bool(cfg.get("sync_enabled", True))
                    cfg["record_keeping_mode"] = (
                        "local_with_connector" if vendor != "none" and sync else "local_only"
                    )
                    cfg.setdefault("vendor", vendor if vendor != "none" else "none")
                    cfg["connector_sync_enabled"] = sync and cfg["vendor"] != "none"
                _CONFIG[org_id] = cfg
            except (json.JSONDecodeError, OSError):
                _CONFIG[org_id] = _default_config()
        else:
            _CONFIG[org_id] = _default_config()
    return dict(_CONFIG[org_id])


def _save_config(org_id: int, cfg: dict[str, Any]) -> None:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    path = _PERSIST_DIR / f"org_{org_id}_config.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


def get_config(org_id: int) -> dict[str, Any]:
    records.seed_demo_patients_if_empty(org_id)
    with _LOCK:
        cfg = _load_config(org_id)
    pending = sum(1 for r in list_sync_records(org_id) if r.get("connector_sync_status") == "pending")
    return {
        **cfg,
        "connector_configured": cfg.get("vendor") not in (None, "", "none")
        and bool(cfg.get("connector_sync_enabled")),
        "pending_connector_sync_count": pending,
    }


def update_config(
    org_id: int,
    *,
    vendor: EhrVendor | None = None,
    record_keeping_mode: RecordKeepingMode | None = None,
    connector_sync_enabled: bool | None = None,
) -> dict[str, Any]:
    with _LOCK:
        cfg = _load_config(org_id)
        if vendor is not None:
            cfg["vendor"] = vendor
            cfg["display_name"] = _VENDOR_LABELS.get(vendor, vendor)
        if record_keeping_mode is not None:
            cfg["record_keeping_mode"] = record_keeping_mode
        if connector_sync_enabled is not None:
            cfg["connector_sync_enabled"] = connector_sync_enabled
        if cfg.get("vendor") == "none":
            cfg["connector_sync_enabled"] = False
            cfg["record_keeping_mode"] = "local_only"
        elif cfg.get("record_keeping_mode") == "local_with_connector":
            cfg["connector_sync_enabled"] = True
        cfg["updated_at"] = _now()
        _CONFIG[org_id] = cfg
        _save_config(org_id, cfg)
    records.append_audit(
        org_id,
        action="config_update",
        detail=f"mode={cfg.get('record_keeping_mode')} vendor={cfg.get('vendor')}",
        connector_vendor=cfg.get("vendor") if cfg.get("vendor") != "none" else None,
    )
    return get_config(org_id)


def _sync_rows(org_id: int) -> list[dict[str, Any]]:
    if org_id not in _SYNC_ROWS:
        path = _PERSIST_DIR / f"org_{org_id}_sync.json"
        if path.is_file():
            try:
                with path.open(encoding="utf-8") as f:
                    data = json.load(f)
                _SYNC_ROWS[org_id] = data if isinstance(data, list) else []
            except (json.JSONDecodeError, OSError):
                _SYNC_ROWS[org_id] = []
        else:
            _SYNC_ROWS[org_id] = []
    return list(_SYNC_ROWS[org_id])


def _save_sync(org_id: int, rows: list[dict[str, Any]]) -> None:
    _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    path = _PERSIST_DIR / f"org_{org_id}_sync.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)


def list_sync_records(org_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        return _sync_rows(org_id)


def _resolve_patient(org_id: int, *, patient_token: str | None, patient_name: str | None) -> dict[str, Any]:
    records.seed_demo_patients_if_empty(org_id)
    token = (patient_token or "").strip().lower()
    name = (patient_name or "").strip().lower()
    if token:
        found = records.get_patient(org_id, token)
        if found:
            records.append_audit(org_id, action="patient_context_lookup", patient_token=token)
            return found
    if name:
        for row in records.list_patients(org_id):
            dn = str(row.get("display_name") or "").lower()
            if name in dn or dn in name:
                records.append_audit(
                    org_id,
                    action="patient_context_lookup",
                    patient_token=row.get("patient_token"),
                )
                return row
    fallback = records.get_patient(org_id, "demo-patient") or records.list_patients(org_id)[0]
    if name and fallback:
        return {**fallback, "display_name": patient_name.strip()}
    return fallback


def lookup_patient_context(
    org_id: int,
    *,
    patient_token: str | None,
    patient_name: str | None,
) -> dict[str, Any]:
    cfg = get_config(org_id)
    patient = _resolve_patient(org_id, patient_token=patient_token, patient_name=patient_name)
    record_source = "local"
    if cfg.get("connector_configured") and patient.get("connector_external_id"):
        record_source = "local_and_connector"
    return {
        "ehr_vendor": cfg["vendor"] if cfg.get("vendor") != "none" else "local",
        "ehr_display_name": cfg["display_name"],
        "record_keeping_mode": cfg.get("record_keeping_mode", "local_only"),
        "record_source": record_source,
        "synced_at": _now(),
        "patient": patient,
        "open_care_gaps": [g for g in patient.get("care_gaps", []) if g.get("status") == "open"],
        "care_gaps_closed_count": sum(
            1 for g in patient.get("care_gaps", []) if g.get("status") != "open"
        ),
    }


def verify_prior_auth(
    org_id: int,
    *,
    patient_token: str | None,
    procedure_code: str | None,
) -> dict[str, Any]:
    ctx = lookup_patient_context(org_id, patient_token=patient_token, patient_name=None)
    patient = ctx["patient"]
    pa = dict(patient.get("prior_auth") or {})
    if procedure_code and pa.get("procedure_code") != procedure_code:
        pa["status"] = "pending_review"
    status = str(pa.get("status") or "unknown")
    records.append_audit(
        org_id,
        action="prior_auth_verify",
        patient_token=patient.get("patient_token"),
        detail=f"status={status}",
    )
    return {
        "prior_auth_id": pa.get("auth_id"),
        "status": status,
        "status_code": status,
        "procedure_code": pa.get("procedure_code"),
        "procedure_label": pa.get("procedure_label"),
        "expires_at": pa.get("expires_at"),
        "payer": pa.get("payer"),
        "confirmation_code": pa.get("auth_id") or uuid.uuid4().hex[:6].upper(),
        "ehr_vendor": ctx["ehr_vendor"],
        "record_source": ctx["record_source"],
        "verified_at": _now(),
    }


def _push_to_connector_stub(cfg: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    """Stub outbound sync — production replaces with FHIR/REST to buyer EHR."""
    vendor = cfg.get("vendor")
    if vendor in (None, "none") or not cfg.get("connector_sync_enabled"):
        return {"connector_sync_status": "local_only", "connector_external_id": None}
    ext_id = f"{vendor}-{row['id'][-8:]}"
    return {
        "connector_sync_status": "synced",
        "connector_external_id": ext_id,
        "connector_synced_at": _now(),
    }


def sync_chart_note(
    org_id: int,
    *,
    patient_token: str | None,
    summary: str | None,
    appointment_id: str | None,
) -> dict[str, Any]:
    cfg = get_config(org_id)
    token = (patient_token or "demo-patient").strip().lower()
    sync_id = f"ehr-sync-{uuid.uuid4().hex[:12]}"
    note = (summary or "Voice agent workflow completed").strip()

    row: dict[str, Any] = {
        "id": sync_id,
        "patient_token": token,
        "summary": note,
        "appointment_id": appointment_id,
        "local_record_status": "stored",
        "record_source": "local",
        "created_at": _now(),
    }

    if cfg.get("record_keeping_mode") == "local_with_connector" and cfg.get("connector_configured"):
        push = _push_to_connector_stub(cfg, row)
        row.update(push)
        row["record_source"] = "local_and_connector"
        row["ehr_vendor"] = cfg["vendor"]
        records.append_audit(
            org_id,
            action="chart_sync_connector",
            patient_token=token,
            connector_vendor=cfg.get("vendor"),
        )
    else:
        row["connector_sync_status"] = "local_only"
        row["ehr_vendor"] = "local"
        records.append_audit(org_id, action="chart_sync_local", patient_token=token)

    row["synced_at"] = _now()
    row["status"] = "synced"

    # Attach latest note reference on patient chart (local compliant record)
    patient = records.get_patient(org_id, token)
    if patient:
        chart_notes = list(patient.get("chart_notes") or [])
        chart_notes.append(
            {
                "id": sync_id,
                "summary": note[:500],
                "appointment_id": appointment_id,
                "at": row["synced_at"],
                "connector_sync_status": row.get("connector_sync_status"),
            }
        )
        records.upsert_patient(
            org_id,
            {**patient, "chart_notes": chart_notes[-20:]},
        )

    with _LOCK:
        rows = _sync_rows(org_id)
        rows.append(row)
        _SYNC_ROWS[org_id] = rows
        _save_sync(org_id, rows)

    return {
        "chart_sync_id": sync_id,
        "local_record_id": sync_id,
        "status": "synced",
        "status_code": row.get("connector_sync_status", "local_only"),
        "record_source": row.get("record_source", "local"),
        "connector_sync_status": row.get("connector_sync_status"),
        "connector_external_id": row.get("connector_external_id"),
        "ehr_vendor": row.get("ehr_vendor"),
        "ehr_display_name": cfg.get("display_name"),
        "confirmation_code": sync_id[-8:].upper(),
        "synced_at": row["synced_at"],
        "appointment_id": appointment_id,
    }


def push_pending_connector_syncs(org_id: int) -> dict[str, Any]:
    """Retry connector push for chart rows still pending (local_with_connector mode)."""
    cfg = get_config(org_id)
    if not cfg.get("connector_configured"):
        return {"pushed": 0, "message": "No connector configured"}
    pushed = 0
    with _LOCK:
        rows = _sync_rows(org_id)
        for i, row in enumerate(rows):
            if row.get("connector_sync_status") != "pending":
                continue
            push = _push_to_connector_stub(cfg, row)
            rows[i] = {**row, **push, "record_source": "local_and_connector"}
            pushed += 1
        _SYNC_ROWS[org_id] = rows
        _save_sync(org_id, rows)
    records.append_audit(org_id, action="connector_push_pending", detail=f"pushed={pushed}")
    return {"pushed": pushed}
