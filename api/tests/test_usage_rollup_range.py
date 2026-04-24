import pytest
from datetime import date
from fastapi import HTTPException

from api.utils.usage_rollup_range import (
    MAX_ROLLUP_RANGE_DAYS,
    parse_utc_inclusive_date_range,
    trim_rollup_bucket_window,
)


def test_parse_none_none():
    a, b, fixed = parse_utc_inclusive_date_range(None, None)
    assert a is None and b is None and fixed is False


def test_parse_requires_both():
    with pytest.raises(HTTPException) as e:
        parse_utc_inclusive_date_range(date(2025, 1, 1), None)
    assert e.value.status_code == 400


def test_parse_valid_range():
    a, b, fixed = parse_utc_inclusive_date_range(date(2025, 1, 1), date(2025, 1, 31))
    assert fixed is True
    assert a.isoformat() == "2025-01-01T00:00:00+00:00"
    assert b.isoformat() == "2025-02-01T00:00:00+00:00"


def test_parse_inclusive_until_covers_last_day():
    """until=Jan 31 means runs before Feb 1 00:00 UTC."""
    _a, until_excl, _f = parse_utc_inclusive_date_range(date(2025, 1, 1), date(2025, 1, 31))
    assert until_excl.day == 1
    assert until_excl.month == 2


def test_parse_rejects_inverted():
    with pytest.raises(HTTPException) as e:
        parse_utc_inclusive_date_range(date(2025, 2, 1), date(2025, 1, 1))
    assert e.value.status_code == 400


def test_parse_rejects_too_long():
    with pytest.raises(HTTPException) as e:
        parse_utc_inclusive_date_range(date(2024, 1, 1), date(2025, 6, 1))
    assert e.value.status_code == 400
    assert str(MAX_ROLLUP_RANGE_DAYS) in e.value.detail


def test_trim_rollup_bucket_window_rolling():
    buckets = [{"i": i} for i in range(20)]
    out = trim_rollup_bucket_window(buckets, window=7, use_fixed_range=False)
    assert len(out) == 7
    assert out[0]["i"] == 13
    assert out[-1]["i"] == 19


def test_trim_rollup_bucket_window_fixed_range_no_trim():
    buckets = [{"i": 0}]
    out = trim_rollup_bucket_window(buckets, window=30, use_fixed_range=True)
    assert out is buckets
    assert len(out) == 1
