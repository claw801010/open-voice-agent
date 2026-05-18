"""Engineering deep links for analytics call detail (Langfuse, etc.)."""

from __future__ import annotations

from typing import Any

from api.services.analytics.langfuse_trace_id import extract_trace_id
from api.services.pipecat.tracing_config import get_trace_url


def resolve_langfuse_trace_url(
    gathered_context: dict[str, Any] | None,
    *,
    organization_id: int,
) -> str | None:
    """
    Prefer explicit ``trace_url`` on gathered_context; else build from trace id + org host.
    """
    gc = gathered_context if isinstance(gathered_context, dict) else {}
    explicit = gc.get("trace_url")
    if isinstance(explicit, str) and explicit.strip().startswith("http"):
        return explicit.strip()
    trace_id = extract_trace_id(gc)
    if not trace_id:
        return None
    return get_trace_url(trace_id, org_id=organization_id)


def build_engineering_links(
    gathered_context: dict[str, Any] | None,
    *,
    organization_id: int,
) -> dict[str, Any]:
    langfuse = resolve_langfuse_trace_url(
        gathered_context, organization_id=organization_id
    )
    out: dict[str, Any] = {}
    if langfuse:
        out["langfuse_trace_url"] = langfuse
    return out
