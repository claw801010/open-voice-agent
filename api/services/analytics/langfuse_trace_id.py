"""Extract Langfuse trace ids from gathered_context without importing QA / gen_ai stacks."""

from __future__ import annotations

import re
from typing import Any


def extract_trace_id(gathered_context: dict[str, Any] | None) -> str | None:
    """Extract Langfuse trace_id from gathered_context trace_url.

    Supports both URL formats:
    - New: https://langfuse.example.com/trace/<trace_id>
    - Legacy: https://langfuse.example.com/project/<project_id>/traces/<trace_id>
    """
    if not isinstance(gathered_context, dict):
        return None
    trace_url = gathered_context.get("trace_url")
    if not trace_url:
        return None
    try:
        match = re.search(r"/traces?/([a-fA-F0-9]+)$", str(trace_url))
        if match:
            return match.group(1)
    except Exception:
        pass
    return None
