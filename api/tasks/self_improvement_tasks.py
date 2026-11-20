"""ARQ tasks for agent self-improvement rollup (MK-01-SELFIMPROVE)."""

from __future__ import annotations

from typing import Any

from loguru import logger

from api.db import db_client
from api.enums import OrganizationConfigurationKey
from api.services.analytics.self_improvement_queue import _load_store, _save_store
from api.services.analytics.self_improvement_rollup import rollup_pending_proposals
from api.services.analytics.self_improvement_store import normalize_store


async def rollup_self_improvement_for_org(_ctx: dict[str, Any], organization_id: int) -> dict[str, int]:
    """Dedupe pending improvement proposals and re-evaluate auto-apply eligibility."""
    store = await _load_store(organization_id)
    updated, stats = rollup_pending_proposals(store)
    await _save_store(organization_id, updated)
    logger.info(
        f"Self-improvement rollup org={organization_id}: "
        f"removed={stats['duplicates_removed']} pending {stats['pending_before']}→{stats['pending_after']}"
    )
    return stats


async def rollup_self_improvement_all_orgs(_ctx: dict[str, Any]) -> int:
    """Hourly sweep: rollup pending proposals for every org with a queue."""
    rows = await db_client.get_all_configurations_by_key(
        OrganizationConfigurationKey.MK01_AGENT_SELF_IMPROVEMENT.value
    )
    count = 0
    for row in rows:
        org_id = int(row["organization_id"])
        store = normalize_store(row.get("value"))
        pending = [p for p in store.get("proposals") or [] if p.get("status") == "pending"]
        if len(pending) < 2:
            continue
        await rollup_self_improvement_for_org(_ctx, org_id)
        count += 1
    return count
