"""Shared validation for weekly usage rollup optional UTC calendar ranges."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import HTTPException

# Align with UI /usage custom range cap
MAX_ROLLUP_RANGE_DAYS = 366


def trim_rollup_bucket_window(buckets: list, window: int, use_fixed_range: bool) -> list:
    """For rolling windows, keep at most the last ``window`` buckets (SQL may return extras)."""
    if not use_fixed_range and len(buckets) > window:
        return buckets[-window:]
    return buckets


def parse_utc_inclusive_date_range(
    since: Optional[date],
    until: Optional[date],
) -> Tuple[Optional[datetime], Optional[datetime], bool]:
    """Parse optional ``since`` / ``until`` calendar dates (UTC).

    Returns ``(range_since_utc, range_until_exclusive_utc, use_fixed_range)``.
    When both are ``None``, returns ``(None, None, False)`` (caller uses rolling ``weeks``).
    When only one is set, raises **400**.
    """
    if since is None and until is None:
        return None, None, False
    if since is None or until is None:
        raise HTTPException(
            status_code=400,
            detail="Both since and until are required for a custom UTC date range (YYYY-MM-DD).",
        )
    since_dt = datetime(since.year, since.month, since.day, tzinfo=timezone.utc)
    until_exclusive = datetime(until.year, until.month, until.day, tzinfo=timezone.utc) + timedelta(
        days=1
    )
    if since_dt >= until_exclusive:
        raise HTTPException(status_code=400, detail="since must be before until")
    if (until_exclusive - since_dt).days > MAX_ROLLUP_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Date range cannot exceed {MAX_ROLLUP_RANGE_DAYS} days",
        )
    return since_dt, until_exclusive, True
