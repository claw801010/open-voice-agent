"""HTTP API tool config — response_storage_mode authoring field (WE-01-DATASTORE-INTEG)."""

import pytest
from pydantic import ValidationError

from api.schemas.http_api_tool import HttpApiConfig


def test_response_storage_mode_defaults_to_live_only() -> None:
    c = HttpApiConfig(method="GET", url="https://example.com/api")
    assert c.response_storage_mode == "live_only"


def test_response_storage_mode_org_cache_when_enabled() -> None:
    c = HttpApiConfig(
        method="POST",
        url="https://example.com/hook",
        response_storage_mode="org_cache_when_enabled",
    )
    assert c.response_storage_mode == "org_cache_when_enabled"


def test_response_storage_mode_rejects_unknown() -> None:
    with pytest.raises(ValidationError):
        HttpApiConfig(
            method="GET",
            url="https://example.com",
            response_storage_mode="invalid",  # type: ignore[arg-type]
        )
