"""Persist and query omnichannel interaction timeline per org."""

from __future__ import annotations

from typing import Any

from api.db import db_client
from api.db.models import WorkflowRunModel
from api.enums import OrganizationConfigurationKey
from api.services.analytics.interaction_timeline import (
    append_event,
    build_messaging_event,
    build_voice_event,
    empty_timeline,
    list_events,
    normalize_timeline,
)


async def _load(org_id: int) -> dict[str, Any]:
    raw = await db_client.get_configuration_value(
        org_id,
        OrganizationConfigurationKey.MK01_INTERACTION_TIMELINE.value,
        default=None,
    )
    return normalize_timeline(raw)


async def _save(org_id: int, doc: dict[str, Any]) -> None:
    await db_client.upsert_configuration(
        org_id,
        OrganizationConfigurationKey.MK01_INTERACTION_TIMELINE.value,
        normalize_timeline(doc),
    )


async def record_voice_completion(
    org_id: int,
    run: WorkflowRunModel,
) -> dict[str, Any] | None:
    wf = run.workflow
    catalog_slug = None
    if wf and isinstance(wf.workflow_configurations, dict):
        mk01 = wf.workflow_configurations.get("mk01") or {}
        if isinstance(mk01, dict):
            catalog_slug = mk01.get("catalog_slug")
    ctx = run.gathered_context or {}
    event = build_voice_event(
        workflow_run_id=run.id,
        workflow_id=run.workflow_id,
        workflow_name=wf.name if wf else None,
        catalog_slug=str(catalog_slug) if catalog_slug else None,
        mode=str(run.mode) if run.mode else None,
        disposition=str(ctx.get("mapped_call_disposition") or "") or None,
        outcome_key=str(ctx.get("outcome_key") or ctx.get("customer_outcome") or "") or None,
    )
    store = await _load(org_id)
    store = append_event(store, event)
    await _save(org_id, store)
    return event


async def record_messaging_send(org_id: int, message: dict[str, Any]) -> dict[str, Any]:
    event = build_messaging_event(message=message)
    store = await _load(org_id)
    store = append_event(store, event)
    await _save(org_id, store)
    return event


async def fetch_interaction_timeline(
    org_id: int,
    *,
    channel: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    store = await _load(org_id)
    return {
        "events": list_events(store, channel=channel, limit=limit),
        "total": len(normalize_timeline(store)["events"]),
    }


async def reset_interaction_timeline(org_id: int) -> None:
    await _save(org_id, empty_timeline())
