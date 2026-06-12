"""Local messaging route tests."""

from __future__ import annotations

import pytest

from api.routes.local_messaging import MessagingRequest, send_email, send_sms
from api.services.local_messaging import store


@pytest.fixture
def _enable_local_messaging(monkeypatch):
    monkeypatch.setenv("ENABLE_LOCAL_MESSAGING", "true")


@pytest.fixture
def _isolated_messaging_store(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "_PERSIST_DIR", tmp_path / "local_messaging")
    store._ROWS.clear()


@pytest.mark.asyncio
async def test_send_sms_logs(_enable_local_messaging, _isolated_messaging_store):
    out = await send_sms(
        MessagingRequest(
            to="+15550199",
            body="Your MRI is Tuesday 3pm",
            patient_name="Maria Rodriguez",
            organization_id=1,
        )
    )
    assert out["status"] == "sent"
    msgs = store.list_messages(1)
    assert len(msgs) == 1
    assert msgs[0]["channel"] == "sms"


@pytest.mark.asyncio
async def test_send_email_logs(_enable_local_messaging, _isolated_messaging_store):
    out = await send_email(
        MessagingRequest(
            to="maria@example.com",
            subject="Appointment confirmed",
            body="See you Tuesday.",
            organization_id=1,
        )
    )
    assert out["channel"] == "email"
    assert store.list_messages(1)[0]["subject"] == "Appointment confirmed"
