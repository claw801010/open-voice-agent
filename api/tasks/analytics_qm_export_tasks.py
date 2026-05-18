"""Scheduled analytics QM CSV uploads to object storage (MinIO/S3)."""

from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone
from typing import Any

from loguru import logger

from api.constants import ENABLE_ANALYTICS_QM_EXPORT_CRON
from api.db import db_client
from api.enums import OrganizationConfigurationKey
from api.tasks.function_names import FunctionNames
from api.services.analytics.analytics_calls_csv import analytics_call_rows_to_csv_bytes
from api.services.analytics.analytics_qm_export_schedule import (
    normalize_analytics_qm_export_schedule_document,
    org_ids_due_for_analytics_qm_export_hour,
)
from api.services.storage import storage_fs


async def cron_enqueue_analytics_qm_exports(ctx: dict[str, Any]) -> None:
    """Hourly (ARQ cron): enqueue per-org export jobs matching configured UTC hour."""
    if not ENABLE_ANALYTICS_QM_EXPORT_CRON:
        logger.debug("analytics QM export cron skipped (ENABLE_ANALYTICS_QM_EXPORT_CRON=false)")
        return

    now = datetime.now(timezone.utc)
    hour = now.hour
    redis = ctx.get("redis")
    if redis is None:
        logger.warning("analytics QM export cron: missing redis on ctx")
        return

    rows = await db_client.get_all_configurations_by_key(
        OrganizationConfigurationKey.MK01_ANALYTICS_QM_EXPORT_SCHEDULE.value
    )
    org_ids = org_ids_due_for_analytics_qm_export_hour(rows, hour_utc=hour)
    for oid in org_ids:
        await redis.enqueue_job(FunctionNames.RUN_ANALYTICS_QM_EXPORT_FOR_ORG.value, oid)
        logger.info(f"Enqueued analytics QM export for organization_id={oid}")


async def run_analytics_qm_export_for_org(_ctx: dict[str, Any], organization_id: int) -> None:
    """Generate QM CSV for org (rolling window) and upload to object storage."""
    key = OrganizationConfigurationKey.MK01_ANALYTICS_QM_EXPORT_SCHEDULE.value
    raw = await db_client.get_configuration_value(organization_id, key, default=None)
    try:
        doc = normalize_analytics_qm_export_schedule_document(raw or {})
    except ValueError as e:
        logger.warning(f"org {organization_id}: invalid QM export schedule: {e}")
        return

    if not doc.get("enabled"):
        logger.debug(f"org {organization_id}: QM export schedule disabled, skipping")
        return

    started = datetime.now(timezone.utc).isoformat()
    doc["last_run_started_at"] = started
    doc["last_run_finished_at"] = None
    doc["last_run_status"] = None
    doc["last_object_key"] = None
    doc["last_error_message"] = None
    await db_client.upsert_configuration(organization_id, key, doc)

    finished_status = "error"
    finished_msg: str | None = None
    object_key: str | None = None

    try:
        until = datetime.now(timezone.utc)
        since = until - timedelta(days=int(doc["window_days"]))
        rows_flat, redact_cells = await db_client.export_analytics_calls_flat(
            organization_id,
            workflow_id=doc.get("workflow_id"),
            catalog_slug=doc.get("catalog_slug"),
            catalog_variant_id=doc.get("catalog_variant_id"),
            since=since,
            until=until,
            disposition=None,
            outcome_key=None,
            tool_name=None,
            max_rows=int(doc["max_rows"]),
            sampling_mode=str(doc.get("sampling_mode") or "smart"),
        )
        body = analytics_call_rows_to_csv_bytes(rows_flat, redact_cells=redact_cells)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        object_key = f"analytics-qm-exports/org-{organization_id}/qm-{stamp}.csv"
        buf = io.BytesIO(body)
        ok = await storage_fs.acreate_file(object_key, buf)
        if not ok:
            raise RuntimeError("object storage upload failed")
        finished_status = "ok"
        logger.info(
            f"analytics QM export ok org={organization_id} key={object_key} rows={len(rows_flat)}"
        )
    except Exception as e:
        finished_msg = str(e)[:2000]
        logger.exception(f"analytics QM export failed org={organization_id}: {e}")

    finished = datetime.now(timezone.utc).isoformat()
    raw2 = await db_client.get_configuration_value(organization_id, key, default=None)
    try:
        latest = normalize_analytics_qm_export_schedule_document(raw2 or {})
    except ValueError:
        latest = normalize_analytics_qm_export_schedule_document(doc)

    latest["last_run_started_at"] = doc.get("last_run_started_at")
    latest["last_run_finished_at"] = finished
    latest["last_run_status"] = finished_status
    latest["last_object_key"] = object_key
    latest["last_error_message"] = finished_msg
    await db_client.upsert_configuration(organization_id, key, latest)
