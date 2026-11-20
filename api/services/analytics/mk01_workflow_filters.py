"""Shared SQL filters on ``workflow_configurations.mk01`` (MK-02 catalog lineage)."""

from __future__ import annotations

from sqlalchemy import text

_MK01_CAPABILITY_IDS_JSON = (
    "COALESCE(workflows.workflow_configurations->'mk01'->'capability_module_ids', '[]'::jsonb)"
)


def capability_module_id_sql_bindparam(capability_module_id: str):
    """SQLAlchemy ``text()`` for jsonb ``?`` member check on ``mk01.capability_module_ids``."""
    mid = capability_module_id.strip()
    return text(f"{_MK01_CAPABILITY_IDS_JSON} ? :cmid").bindparams(cmid=mid)


def append_capability_module_mix_sql(
    mix_sql_extra: str,
    mix_params: dict,
    capability_module_id: str | None,
) -> tuple[str, dict]:
    """Append raw SQL fragment for insights roll-up queries (``workflows`` join alias)."""
    if capability_module_id:
        mix_sql_extra += f" AND {_MK01_CAPABILITY_IDS_JSON} ? :cmid"
        mix_params["cmid"] = capability_module_id.strip()
    return mix_sql_extra, mix_params