"""Unit tests for Langfuse engineering links on analytics call detail."""

from api.services.analytics.call_engineering_links import (
    build_engineering_links,
    resolve_langfuse_trace_url,
)


def test_resolve_langfuse_trace_url_explicit():
    url = resolve_langfuse_trace_url(
        {"trace_url": "https://langfuse.example.com/trace/abc123def456"},
        organization_id=1,
    )
    assert url == "https://langfuse.example.com/trace/abc123def456"


def test_resolve_langfuse_trace_url_from_legacy_path():
    url = resolve_langfuse_trace_url(
        {
            "trace_url": "https://langfuse.example.com/project/p/traces/deadbeefcafebabe"
        },
        organization_id=42,
    )
    assert url is not None
    assert "deadbeefcafebabe" in url


def test_build_engineering_links_empty_without_trace():
    assert build_engineering_links({}, organization_id=1) == {}
