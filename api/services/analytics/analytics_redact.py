"""Conservative PII redaction for analytics exports and call detail (MK-01).

Applies to HTTP tool ``mapped_data``, free-text fields, and CSV string cells.
Does not remove aggregate metrics; keys matching sensitive substrings are fully redacted.
Reviewer matrix: ``catalog/ANALYTICS_REDACTION_MATRIX.md``. Roadmap: ``catalog/ANALYTICS_VERTICAL_ROADMAP.md``.
"""

from __future__ import annotations

import copy
import re
from typing import Any

REDACTED = "[redacted]"


def coerce_detail_redaction_enabled(stored: Any, *, default_when_missing: bool = True) -> bool:
    """
    Interpret org configuration value for MK01_ANALYTICS_DETAIL_REDACTION_ENABLED.

    When ``True`` (default if unset), apply ``redact_analytics_call_detail`` and CSV cell redaction.
    When ``False``, return raw analytics payloads for that org (enterprise / QM workflows — use sparingly).
    """
    if stored is None:
        return default_when_missing
    if isinstance(stored, bool):
        return stored
    if isinstance(stored, str):
        s = stored.strip().lower()
        if s in ("false", "0", "no"):
            return False
        if s in ("true", "1", "yes"):
            return True
    return default_when_missing

# Substrings on dict keys (lowercase) → subtree replaced with REDACTED (value must not leak).
_SENSITIVE_KEY_FRAGMENTS: frozenset[str] = frozenset(
    {
        "email",
        "e_mail",
        "phone",
        "mobile",
        "fax",
        "ssn",
        "password",
        "secret",
        "token",
        "api_key",
        "apikey",
        "authorization",
        "auth_header",
        "credit_card",
        "creditcard",
        "card_number",
        "iban",
        "routing",
        "account_number",
        "street",
        "address",
        "postal",
        "zipcode",
        "latitude",
        "longitude",
        "patient",
        "mrn",
        "dob",
        "date_of_birth",
        "birthdate",
        "full_name",
        "first_name",
        "last_name",
        "contact_name",
        "customer_name",
    }
)

# Final label ≥1 letter so short test domains (x@y.z) still match for QM exports.
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{1,}\b")
# US-style phones and digit runs that look like NANP (avoid short numeric codes).
_PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?1[\s.\-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}(?!\d)"
)


def _key_is_sensitive(key: str) -> bool:
    k = str(key).lower()
    for frag in _SENSITIVE_KEY_FRAGMENTS:
        if frag in k:
            return True
    return False


def redact_plain_string(s: str) -> str:
    """Mask emails and phone-like patterns embedded in free text."""
    if not s:
        return s
    out = _EMAIL_RE.sub(REDACTED, s)
    out = _PHONE_RE.sub(REDACTED, out)
    return out


def redact_mapping_tree(obj: Any, depth: int = 0) -> Any:
    """
    Recursively redact dict/list structures.

    * Keys matching sensitive fragments → value replaced with ``REDACTED`` (scalar or subtree).
    * Other string leaves → ``redact_plain_string``.
    """
    if depth > 18:
        return REDACTED
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, int | float):
        return obj
    if isinstance(obj, str):
        return redact_plain_string(obj)
    if isinstance(obj, list):
        return [redact_mapping_tree(x, depth + 1) for x in obj]
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            if _key_is_sensitive(str(k)):
                out[str(k)] = REDACTED
            else:
                out[str(k)] = redact_mapping_tree(v, depth + 1)
        return out
    return REDACTED


def redact_analytics_call_detail(detail: dict[str, Any]) -> dict[str, Any]:
    """Return a deep-copied detail dict with analytics-safe fields redacted."""
    out = copy.deepcopy(detail)

    for span in out.get("tool_spans") or []:
        if not isinstance(span, dict):
            continue
        http = span.get("http")
        if not isinstance(http, dict):
            continue
        md = http.get("mapped_data")
        if md is not None:
            http["mapped_data"] = redact_mapping_tree(md)
        err = http.get("error_message")
        if isinstance(err, str):
            http["error_message"] = redact_plain_string(err)

    oc = out.get("outcomes")
    if isinstance(oc, dict):
        out["outcomes"] = redact_mapping_tree(oc)

    summary = out.get("ai_summary")
    if isinstance(summary, str):
        out["ai_summary"] = redact_plain_string(summary)

    tr = out.get("transcript")
    if isinstance(tr, str):
        out["transcript"] = redact_plain_string(tr)

    lt = out.get("live_trace")
    if isinstance(lt, dict):
        for inv in lt.get("tool_invocations") or []:
            if not isinstance(inv, dict):
                continue
            recv = inv.get("receive")
            if isinstance(recv, dict):
                md = recv.get("mapped_data")
                if md is not None:
                    recv["mapped_data"] = redact_mapping_tree(md)
                err = recv.get("error")
                if isinstance(err, str):
                    recv["error"] = redact_plain_string(err)
            http = inv.get("http")
            if isinstance(http, dict):
                err = http.get("error_message")
                if isinstance(err, str):
                    http["error_message"] = redact_plain_string(err)
                md = http.get("mapped_data")
                if md is not None:
                    http["mapped_data"] = redact_mapping_tree(md)

    qa = out.get("qa")
    if isinstance(qa, dict):
        notes = qa.get("reviewer_notes")
        if isinstance(notes, str):
            qa["reviewer_notes"] = redact_plain_string(notes)

    return out


def redact_csv_cell(value: Any) -> str:
    """Serialize one CSV cell with plain-string redaction for defense in depth."""
    if value is None:
        return ""
    if isinstance(value, str):
        return redact_plain_string(value)
    return str(value)
