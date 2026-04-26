"""Tests for HTTP tool integration cache policy stub (WE-01-DATASTORE-INTEG)."""

import importlib

import pytest

import api.services.workflow.tools.http_tool_cache_policy as policy


@pytest.fixture(autouse=True)
def reload_policy_each_test() -> None:
    importlib.reload(policy)
    yield
    importlib.reload(policy)


def test_integration_response_cache_enabled_false_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HTTP_TOOL_INTEGRATION_CACHE_ENABLED", raising=False)
    importlib.reload(policy)
    assert policy.integration_response_cache_enabled() is False


@pytest.mark.parametrize("raw", ("1", "true", "TRUE", " yes ", "on"))
def test_integration_response_cache_enabled_truthy(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    monkeypatch.setenv("HTTP_TOOL_INTEGRATION_CACHE_ENABLED", raw)
    importlib.reload(policy)
    assert policy.integration_response_cache_enabled() is True
