"""Local EHR route tests — local records + optional connector sync."""

from __future__ import annotations

import pytest

from api.routes.local_ehr import EhrRequest, chart_sync, patients_context, prior_auth_status
from api.services.local_ehr import records, store


@pytest.fixture
def _enable_local_ehr(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_EHR", "true")


@pytest.fixture
def _isolated_ehr_store(tmp_path, monkeypatch):
    persist = tmp_path / "local_ehr"
    monkeypatch.setattr(store, "_PERSIST_DIR", persist)
    monkeypatch.setattr(records, "_PERSIST_DIR", persist)
    store._CONFIG.clear()
    store._SYNC_ROWS.clear()
    records._PATIENTS.clear()
    records._AUDIT.clear()


@pytest.mark.asyncio
async def test_patients_context_maria_demo(_enable_local_ehr, _isolated_ehr_store):
    out = await patients_context(EhrRequest(patient_token="maria-rodriguez", organization_id=1))
    assert out["record_keeping_mode"] == "local_only"
    assert out["record_source"] == "local"
    assert out["patient"]["display_name"] == "Maria Rodriguez"
    assert len(out["open_care_gaps"]) >= 1


@pytest.mark.asyncio
async def test_prior_auth_approved(_enable_local_ehr, _isolated_ehr_store):
    out = await prior_auth_status(
        EhrRequest(patient_token="maria-rodriguez", procedure_code="73721", organization_id=1)
    )
    assert out["status"] == "approved"
    assert out["prior_auth_id"] == "PA-99281"


@pytest.mark.asyncio
async def test_chart_sync_local_only(_enable_local_ehr, _isolated_ehr_store):
    out = await chart_sync(
        EhrRequest(
            patient_token="maria-rodriguez",
            appointment_id="appt-1",
            summary="Knee MRI rescheduled",
            organization_id=1,
        )
    )
    assert out["connector_sync_status"] == "local_only"
    assert out["record_source"] == "local"
    rows = store.list_sync_records(1)
    assert len(rows) == 1
    patient = records.get_patient(1, "maria-rodriguez")
    assert patient is not None
    assert len(patient.get("chart_notes") or []) == 1


@pytest.mark.asyncio
async def test_chart_sync_with_connector(_enable_local_ehr, _isolated_ehr_store):
    store.update_config(
        1,
        vendor="athenahealth",
        record_keeping_mode="local_with_connector",
        connector_sync_enabled=True,
    )
    out = await chart_sync(
        EhrRequest(
            patient_token="maria-rodriguez",
            summary="Synced note",
            organization_id=1,
        )
    )
    assert out["connector_sync_status"] == "synced"
    assert out["record_source"] == "local_and_connector"
    assert out["connector_external_id"]
    assert out["ehr_vendor"] == "athenahealth"


@pytest.mark.asyncio
async def test_audit_trail_on_lookup(_enable_local_ehr, _isolated_ehr_store):
    await patients_context(EhrRequest(patient_token="maria-rodriguez", organization_id=1))
    entries = records.list_audit(1)
    assert any(e["action"] == "patient_context_lookup" for e in entries)
