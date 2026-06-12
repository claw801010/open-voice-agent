"""API smoke aligned with scripts/gtm-local-all-in-one-demo.sh."""

from __future__ import annotations

import pytest

from api.routes.local_ehr import EhrRequest, patients_context, prior_auth_status
from api.routes.local_integrations import IntegrationRequest as IntegrationsBody
from api.routes.local_messaging import MessagingRequest, send_sms
from api.routes.local_integrations import (
    accounts_balance,
    applications_status,
    cancellations_waiver,
    claims_status,
    deals_stage,
    leads_intent,
    outages_status,
    permits_status,
)
from api.routes.local_payments import PaymentPromiseRequest, capture_payment_promise
from api.routes.local_scheduling import (
    BookSlotRequest,
    RescheduleAppointmentRequest,
    book_slot_catalog_alias,
    reschedule_appointment_alias,
)
from api.services.local_ehr import store as ehr_store
from api.services.local_integrations import store as integrations_store
from api.services.local_messaging import store as messaging_store
from api.services.local_payments import store as payments_store
from api.services.local_scheduling import store as scheduling_store


@pytest.fixture(autouse=True)
def _enable_flags(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_SCHEDULING", "true")
    monkeypatch.setenv("ENABLE_LOCAL_PAYMENTS", "true")
    monkeypatch.setenv("ENABLE_LOCAL_INTEGRATIONS", "true")
    monkeypatch.setenv("ENABLE_LOCAL_EHR", "true")
    monkeypatch.setenv("ENABLE_LOCAL_MESSAGING", "true")


@pytest.fixture(autouse=True)
def _isolated_stores(tmp_path, monkeypatch):
    sched_dir = tmp_path / "sched"
    pay_dir = tmp_path / "pay"
    int_dir = tmp_path / "int"
    ehr_dir = tmp_path / "ehr"
    msg_dir = tmp_path / "msg"
    for d in (sched_dir, pay_dir, int_dir, ehr_dir, msg_dir):
        d.mkdir()
    monkeypatch.setattr(scheduling_store, "_PERSIST_DIR", sched_dir)
    monkeypatch.setattr(payments_store, "_PERSIST_DIR", pay_dir)
    monkeypatch.setattr(integrations_store, "_PERSIST_DIR", int_dir)
    monkeypatch.setattr(ehr_store, "_PERSIST_DIR", ehr_dir)
    monkeypatch.setattr(messaging_store, "_PERSIST_DIR", msg_dir)
    scheduling_store._STORE.clear()
    payments_store._STORE.clear()
    integrations_store._STORE.clear()
    ehr_store._CONFIG.clear()
    ehr_store._SYNC_ROWS.clear()
    messaging_store._ROWS.clear()


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

    deal = await deals_stage(
        IntegrationsBody(deal_id="GTM-DEAL-1", deal_stage="closed_won", organization_id=904)
    )
    assert deal["appointment"]["id"]

    claim = await claims_status(
        IntegrationsBody(claim_id="CLM-GTM-1", policy_token="tok-demo", organization_id=905)
    )
    assert claim["appointment"]["id"]

    waiver = await cancellations_waiver(
        IntegrationsBody(
            reservation_id="RES-GTM-1", waiver_reason="weather", organization_id=906
        )
    )
    assert waiver["appointment"]["id"]

    balance = await accounts_balance(
        IntegrationsBody(account_token="acct-demo", organization_id=907)
    )
    assert balance["appointment"]["id"]

    lead = await leads_intent(
        IntegrationsBody(location_id="store-42", intent="catering", organization_id=908)
    )
    assert lead["appointment"]["id"]

    permit = await permits_status(
        IntegrationsBody(permit_id="PER-GTM-1", organization_id=909)
    )
    assert permit["appointment"]["id"]

    application = await applications_status(
        IntegrationsBody(application_id="APP-GTM-1", organization_id=910)
    )
    assert application["appointment"]["id"]

    ctx = await patients_context(
        EhrRequest(patient_token="maria-rodriguez", organization_id=911)
    )
    assert ctx["patient"]["patient_token"] == "maria-rodriguez"

    prior = await prior_auth_status(
        EhrRequest(
            patient_token="maria-rodriguez",
            procedure_code="73721",
            organization_id=911,
        )
    )
    assert prior["status"] == "approved"

    sms = await send_sms(
        MessagingRequest(
            to="+15550199",
            body="GTM demo SMS",
            patient_name="Maria Rodriguez",
            organization_id=912,
        )
    )
    assert sms["message_id"]
