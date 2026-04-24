from typing import List, Optional

from pydantic import BaseModel


class WeeklyRollupBucket(BaseModel):
    week_start: str
    run_count: int
    """Runs with ``call_type`` inbound / outbound (sums to ``run_count`` for enum-backed rows)."""
    runs_inbound: int = 0
    runs_outbound: int = 0
    dograh_tokens: Optional[float] = None


class WeeklyRollupResponse(BaseModel):
    buckets: List[WeeklyRollupBucket]


class DailyRollupBucket(BaseModel):
    """UTC calendar day (``YYYY-MM-DD``) aggregates for usage charts."""

    day_start: str
    run_count: int
    runs_inbound: int = 0
    runs_outbound: int = 0
    dograh_tokens: Optional[float] = None


class DailyRollupResponse(BaseModel):
    buckets: List[DailyRollupBucket]
