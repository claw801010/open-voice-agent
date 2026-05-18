"""Unit tests: QM export schedule normalization (no DB)."""

from datetime import datetime, timezone

import pytest

from api.services.analytics.analytics_qm_export_schedule import (
    merge_put_into_stored_schedule,
    next_analytics_qm_export_dispatch_utc,
    normalize_analytics_qm_export_schedule_document,
    org_ids_due_for_analytics_qm_export_hour,
)


def test_normalize_defaults():
    doc = normalize_analytics_qm_export_schedule_document(None)
    assert doc["v"] == 1
    assert doc["enabled"] is False
    assert doc["hour_utc"] == 6
    assert doc["window_days"] == 7
    assert doc["max_rows"] == 5000
    assert doc["sampling_mode"] == "smart"


def test_normalize_sampling_mode():
    doc = normalize_analytics_qm_export_schedule_document({"sampling_mode": "fifo"})
    assert doc["sampling_mode"] == "fifo"
    with pytest.raises(ValueError, match="sampling_mode"):
        normalize_analytics_qm_export_schedule_document({"sampling_mode": "random"})


def test_normalize_rejects_bad_hour():
    with pytest.raises(ValueError, match="hour_utc"):
        normalize_analytics_qm_export_schedule_document({"hour_utc": 24})


def test_next_dispatch_disabled_or_cron_off():
    now = datetime(2026, 5, 8, 12, 0, tzinfo=timezone.utc)
    assert (
        next_analytics_qm_export_dispatch_utc(
            now, hour_utc=6, enabled=False, cron_enabled=True
        )
        is None
    )
    assert (
        next_analytics_qm_export_dispatch_utc(now, hour_utc=6, enabled=True, cron_enabled=False)
        is None
    )


def test_next_dispatch_same_hour_before_slot():
    now = datetime(2026, 5, 8, 6, 30, tzinfo=timezone.utc)
    nxt = next_analytics_qm_export_dispatch_utc(
        now, hour_utc=6, enabled=True, cron_enabled=True, cron_minute_utc=47
    )
    assert nxt == datetime(2026, 5, 8, 6, 47, tzinfo=timezone.utc)


def test_next_dispatch_same_hour_after_slot():
    now = datetime(2026, 5, 8, 6, 48, tzinfo=timezone.utc)
    nxt = next_analytics_qm_export_dispatch_utc(
        now, hour_utc=6, enabled=True, cron_enabled=True, cron_minute_utc=47
    )
    assert nxt == datetime(2026, 5, 9, 6, 47, tzinfo=timezone.utc)


def test_next_dispatch_later_hour_same_day():
    now = datetime(2026, 5, 8, 5, 50, tzinfo=timezone.utc)
    nxt = next_analytics_qm_export_dispatch_utc(
        now, hour_utc=6, enabled=True, cron_enabled=True, cron_minute_utc=47
    )
    assert nxt == datetime(2026, 5, 8, 6, 47, tzinfo=timezone.utc)


def test_org_ids_due_filters_hour():
    rows = [
        {"organization_id": 1, "value": {"enabled": True, "hour_utc": 5}},
        {"organization_id": 2, "value": {"enabled": True, "hour_utc": 6}},
        {"organization_id": 3, "value": {"enabled": False, "hour_utc": 5}},
    ]
    assert org_ids_due_for_analytics_qm_export_hour(rows, hour_utc=5) == [1]


def test_merge_preserves_last_run():
    existing = {
        "v": 1,
        "enabled": False,
        "hour_utc": 3,
        "window_days": 7,
        "max_rows": 5000,
        "workflow_id": None,
        "catalog_slug": None,
        "catalog_variant_id": None,
        "last_run_status": "ok",
        "last_object_key": "analytics-qm-exports/org-9/qm-old.csv",
        "last_run_started_at": "2026-01-01T00:00:00+00:00",
        "last_run_finished_at": "2026-01-01T00:01:00+00:00",
        "last_error_message": None,
    }
    out = merge_put_into_stored_schedule(
        existing,
        enabled=True,
        hour_utc=4,
        window_days=14,
        max_rows=1000,
        sampling_mode="smart",
        workflow_id=99,
        catalog_slug="retail-wismo",
        catalog_variant_id=None,
    )
    assert out["enabled"] is True
    assert out["hour_utc"] == 4
    assert out["window_days"] == 14
    assert out["max_rows"] == 1000
    assert out["workflow_id"] == 99
    assert out["catalog_slug"] == "retail-wismo"
    assert out["last_run_status"] == "ok"
    assert out["last_object_key"] == "analytics-qm-exports/org-9/qm-old.csv"
