"""Org JSON for scheduled analytics QM CSV exports (MK-01 Phase D). Stored under OrganizationConfigurationKey."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

# Must match ARQ `cron(..., minute=…)` for enqueue (see api/tasks/arq.py).
QM_EXPORT_CRON_DISPATCH_MINUTE_UTC = 47

SAMPLING_MODES = frozenset({"fifo", "smart"})

DEFAULT_QM_EXPORT_SCHEDULE: dict[str, Any] = {
    "v": 1,
    "enabled": False,
    "hour_utc": 6,
    "window_days": 7,
    "max_rows": 5000,
    "sampling_mode": "smart",
    "workflow_id": None,
    "catalog_slug": None,
    "catalog_variant_id": None,
    "last_run_started_at": None,
    "last_run_finished_at": None,
    "last_run_status": None,
    "last_object_key": None,
    "last_error_message": None,
}


def org_ids_due_for_analytics_qm_export_hour(
    rows: list[dict[str, Any]],
    *,
    hour_utc: int,
) -> list[int]:
    """Pick organization ids whose stored schedule is enabled and matches ``hour_utc``."""
    out: list[int] = []
    for row in rows:
        oid = row.get("organization_id")
        if oid is None:
            continue
        val = row.get("value")
        if not isinstance(val, dict):
            continue
        if not val.get("enabled"):
            continue
        try:
            h = int(val.get("hour_utc", -1))
        except (TypeError, ValueError):
            continue
        if h == hour_utc:
            try:
                out.append(int(oid))
            except (TypeError, ValueError):
                continue
    return out


def next_analytics_qm_export_dispatch_utc(
    now: datetime,
    *,
    hour_utc: int,
    enabled: bool,
    cron_enabled: bool,
    cron_minute_utc: int = QM_EXPORT_CRON_DISPATCH_MINUTE_UTC,
) -> datetime | None:
    """
    Next UTC instant when the hourly ARQ cron may enqueue this org (same wall-clock slot as dispatch).

    Returns None when the schedule is off or deployment cron is disabled.
    """
    if not enabled or not cron_enabled:
        return None
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    if cron_minute_utc < 0 or cron_minute_utc > 59:
        raise ValueError("cron_minute_utc must be 0..59")
    now_utc = now.astimezone(timezone.utc)
    cand = now_utc.replace(hour=hour_utc, minute=cron_minute_utc, second=0, microsecond=0)
    if cand <= now_utc:
        cand += timedelta(days=1)
    return cand


def _coerce_optional_int(v: Any) -> int | None:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return None
    try:
        i = int(v)
    except (TypeError, ValueError):
        return None
    return i


def _coerce_optional_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def normalize_analytics_qm_export_schedule_document(raw: Any) -> dict[str, Any]:
    """
    Validate and return a full stored document (includes optional ``last_run_*`` audit fields).

    Raises:
        ValueError: invalid shape or out-of-range numbers.
    """
    base = dict(DEFAULT_QM_EXPORT_SCHEDULE)
    if raw is not None and raw != {}:
        if not isinstance(raw, dict):
            raise ValueError("Schedule must be a JSON object")
        base.update(raw)

    ver = base.get("v", 1)
    try:
        vi = int(ver)
    except (TypeError, ValueError) as e:
        raise ValueError("Invalid schedule version") from e
    if vi != 1:
        raise ValueError("Unsupported schedule schema version")

    enabled = bool(base.get("enabled"))

    try:
        hour_utc = int(base.get("hour_utc", 6))
    except (TypeError, ValueError) as e:
        raise ValueError("hour_utc must be an integer") from e
    if hour_utc < 0 or hour_utc > 23:
        raise ValueError("hour_utc must be between 0 and 23")

    try:
        window_days = int(base.get("window_days", 7))
    except (TypeError, ValueError) as e:
        raise ValueError("window_days must be an integer") from e
    if window_days < 1 or window_days > 366:
        raise ValueError("window_days must be between 1 and 366")

    try:
        max_rows = int(base.get("max_rows", 5000))
    except (TypeError, ValueError) as e:
        raise ValueError("max_rows must be an integer") from e
    if max_rows < 1 or max_rows > 10_000:
        raise ValueError("max_rows must be between 1 and 10000")

    wf_id = _coerce_optional_int(base.get("workflow_id"))
    catalog_slug = _coerce_optional_str(base.get("catalog_slug"))
    catalog_variant_id = _coerce_optional_str(base.get("catalog_variant_id"))

    sampling_mode = str(base.get("sampling_mode") or "smart").strip().lower()
    if sampling_mode not in SAMPLING_MODES:
        raise ValueError("sampling_mode must be 'fifo' or 'smart'")

    out: dict[str, Any] = {
        "v": 1,
        "enabled": enabled,
        "hour_utc": hour_utc,
        "window_days": window_days,
        "max_rows": max_rows,
        "sampling_mode": sampling_mode,
        "workflow_id": wf_id,
        "catalog_slug": catalog_slug,
        "catalog_variant_id": catalog_variant_id,
    }

    def _last_run_str(field: str) -> str | None:
        val = base.get(field)
        if val is None or val == "":
            return None
        return str(val)

    out["last_run_started_at"] = _last_run_str("last_run_started_at")
    out["last_run_finished_at"] = _last_run_str("last_run_finished_at")
    st = base.get("last_run_status")
    if st in (None, "", "ok", "error"):
        out["last_run_status"] = None if st in (None, "") else st
    else:
        out["last_run_status"] = None
    ok = base.get("last_object_key")
    out["last_object_key"] = None if ok in (None, "") else str(ok)
    em = base.get("last_error_message")
    out["last_error_message"] = None if em in (None, "") else str(em)[:2000]

    return out


def merge_put_into_stored_schedule(
    existing: dict[str, Any] | None,
    *,
    enabled: bool,
    hour_utc: int,
    window_days: int,
    max_rows: int,
    sampling_mode: str,
    workflow_id: int | None,
    catalog_slug: str | None,
    catalog_variant_id: str | None,
) -> dict[str, Any]:
    """Apply user-editable fields from PUT while preserving ``last_run_*`` from ``existing``."""
    prev = dict(existing or {})
    merged = {
        **DEFAULT_QM_EXPORT_SCHEDULE,
        **prev,
        "enabled": enabled,
        "hour_utc": hour_utc,
        "window_days": window_days,
        "max_rows": max_rows,
        "sampling_mode": sampling_mode,
        "workflow_id": workflow_id,
        "catalog_slug": catalog_slug,
        "catalog_variant_id": catalog_variant_id,
    }
    return normalize_analytics_qm_export_schedule_document(merged)
