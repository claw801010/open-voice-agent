"""Unit tests for omnichannel interaction timeline helpers."""

from api.services.analytics.interaction_timeline import (
    append_event,
    build_messaging_event,
    build_voice_event,
    empty_timeline,
    list_events,
)


def test_voice_event_shape():
    evt = build_voice_event(
        workflow_run_id=42,
        workflow_id=7,
        workflow_name="Salon",
        catalog_slug="barber-beauty-salon-faq",
        mode="smallwebrtc",
        disposition="completed",
        outcome_key="booked",
    )
    assert evt["channel"] == "voice"
    assert evt["call_id"] == "wr-42"
    assert "booked" in evt["summary"]


def test_append_and_filter():
    store = empty_timeline()
    store = append_event(store, build_voice_event(workflow_run_id=1, workflow_id=1, workflow_name="A", catalog_slug=None, mode="pstn"))
    store = append_event(
        store,
        build_messaging_event(
            message={"id": "msg-1", "channel": "sms", "to": "+1555", "body": "Hi", "sent_at": "2026-01-01T00:00:00+00:00"},
        ),
    )
    voice_only = list_events(store, channel="voice")
    assert len(voice_only) == 1
    assert len(list_events(store, channel="all", limit=10)) == 2
