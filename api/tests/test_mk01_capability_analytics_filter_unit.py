"""Unit tests for MK-02 capability_module_id analytics SQL helpers."""

from api.services.analytics.mk01_workflow_filters import (
    append_capability_module_mix_sql,
    capability_module_id_sql_bindparam,
)


def test_capability_module_id_sql_bindparam_strips_whitespace():
    clause = capability_module_id_sql_bindparam("  site_visit_scheduling  ")
    compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
    assert "capability_module_ids" in compiled
    assert "site_visit_scheduling" in compiled


def test_append_capability_module_mix_sql_noop_when_empty():
    extra, params = append_capability_module_mix_sql(" AND x = 1", {"oid": 1}, None)
    assert extra == " AND x = 1"
    assert "cmid" not in params


def test_append_capability_module_mix_sql_adds_jsonb_member_check():
    extra, params = append_capability_module_mix_sql("", {}, "appointment_booking")
    assert "capability_module_ids" in extra
    assert "? :cmid" in extra
    assert params["cmid"] == "appointment_booking"
