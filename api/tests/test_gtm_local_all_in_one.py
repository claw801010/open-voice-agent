"""API smoke aligned with scripts/gtm-local-all-in-one-demo.sh."""

from __future__ import annotations

import pytest

from api.routes.local_integrations import IntegrationRequest as IntegrationsBody
from api.routes.local_integrations import outages_status
from api.routes.local_payments import PaymentPromiseRequest, capture_payment_promise
from api.routes.local_scheduling import (
    BookSlotRequest,
    RescheduleAppointmentRequest,
    book_slot_catalog_alias,
    reschedule_appointment_alias,
)
from api.services.local_integrations import store as integrations_store
from api.services.local_payments import store as payments_store
from api.services.local_scheduling import store as scheduling_store


@pytest.fixture(autouse=True)
def _enable_flags(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_SCHEDULING", "true")
    monkeypatch.setenv("ENABLE_LOCAL_PAYMENTS", "true")
    monkeypatch.setenv("ENABLE_LOCAL_INTEGRATIONS", "true")


@pytest.fixture(autouse=True)
def _isolated_stores(tmp_path, monkeypatch):
    sched_dir = tmp_path / "sched"
    pay_dir = tmp_path / "pay"
    int_dir = tmp_path / "int"
    sched_dir.mkdir()
    pay_dir.mkdir()
    int_dir.mkdir()
    monkeypatch.setattr(scheduling_store, "_PERSIST_DIR", sched_dir)
    monkeypatch.setattr(payments_store, "_PERSIST_DIR", pay_dir)
    monkeypatch.setattr(integrations_store, "_PERSIST_DIR", int_dir)
    scheduling_store._STORE.clear()
    payments_store._STORE.clear()
    integrations_store._STORE.clear()


@pytest.mark.asyncio
async def test_gtm_local_all_in_one_book_reschedule_pay_integrate():
    booked = await book_slot_catalog_alias(
        BookSlotRequest(slot_start="2026-12-01T10:00:00Z", organization_id=901)
    )
    appt_id = booked.appointment["id"]

    rescheduled = await reschedule_appointment_alias(
        RescheduleAppointmentRequest(
            appointment_id=appt_id,
            slot_start="2026-12-01T14:00:00Z",
            organization_id=901,
        )
    )
    assert rescheduled.appointment["slot"]["start"] == "2026-12-01T14:00:00Z"

    pay = await capture_payment_promise(
        PaymentPromiseRequest(account_reference="GTM", organization_id=902)
    )
    assert pay["confirmation_code"]

    outage = await outages_status(
        IntegrationsBody(utility_name="Demo", organization_id=903)
    )
    assert outage["appointment"]["id"]
