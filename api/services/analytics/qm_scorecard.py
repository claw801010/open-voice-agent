"""Org QM scorecard rubric + per-call pass/fail grid from QA node results."""

from __future__ import annotations

from typing import Any

DEFAULT_QM_SCORECARD: dict[str, Any] = {
    "v": 1,
    "criteria": [
        {
            "id": "greeting",
            "label": "Professional greeting",
            "description": "Agent identified the business and set a helpful tone.",
        },
        {
            "id": "intent_understood",
            "label": "Intent understood",
            "description": "Caller need was acknowledged before tools or transfers.",
        },
        {
            "id": "outcome_achieved",
            "label": "Outcome achieved",
            "description": "Business outcome (booked, resolved, qualified) was reached or clearly declined.",
        },
        {
            "id": "tool_accuracy",
            "label": "Tool / API accuracy",
            "description": "HTTP tools succeeded and mapped fields match the conversation.",
        },
        {
            "id": "compliance",
            "label": "Compliance & safety",
            "description": "No unsafe advice; required disclaimers when applicable.",
        },
        {
            "id": "tone",
            "label": "Tone & empathy",
            "description": "Calm, respectful, appropriate for the vertical.",
        },
    ],
}

SCORECARD_CRITERIA_JSON_HINT = (
    'Include a "criteria" array: [{"criterion_id": "<id>", "pass": true|false, "note": "brief"}] '
    "for each rubric criterion you can evaluate from the transcript."
)


def normalize_qm_scorecard_document(raw: Any) -> dict[str, Any]:
    base = dict(DEFAULT_QM_SCORECARD)
    if raw is not None and raw != {}:
        if not isinstance(raw, dict):
            raise ValueError("Scorecard must be a JSON object")
        base.update(raw)
    ver = base.get("v", 1)
    if int(ver) != 1:
        raise ValueError("Unsupported scorecard schema version")
    raw_criteria = base.get("criteria")
    if not isinstance(raw_criteria, list) or not raw_criteria:
        raise ValueError("criteria must be a non-empty array")
    criteria: list[dict[str, Any]] = []
    seen: set[str] = set()
    for c in raw_criteria:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or "").strip()
        label = str(c.get("label") or "").strip()
        if not cid or not label or cid in seen:
            continue
        seen.add(cid)
        criteria.append(
            {
                "id": cid,
                "label": label,
                "description": str(c.get("description") or "").strip() or None,
            }
        )
    if not criteria:
        raise ValueError("At least one valid criterion required")
    return {"v": 1, "criteria": criteria}


def _coerce_pass(val: Any) -> bool | None:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        s = val.strip().lower()
        if s in ("true", "pass", "yes", "1"):
            return True
        if s in ("false", "fail", "no", "0"):
            return False
    return None


def _collect_criteria_results(annotations: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    """Merge criterion results from all QA node_results (last write wins per id)."""
    out: dict[str, dict[str, Any]] = {}
    if not annotations or not isinstance(annotations, dict):
        return out
    node_results = annotations.get("node_results")
    if not isinstance(node_results, dict):
        return out
    for _nid, nr in node_results.items():
        if not isinstance(nr, dict):
            continue
        raw_list = nr.get("criteria")
        if not isinstance(raw_list, list):
            continue
        for row in raw_list:
            if not isinstance(row, dict):
                continue
            cid = str(row.get("criterion_id") or row.get("id") or "").strip()
            if not cid:
                continue
            passed = _coerce_pass(row.get("pass"))
            out[cid] = {
                "pass": passed,
                "note": str(row.get("note") or "").strip() or None,
                "source_node": nr.get("node_name"),
            }
    return out


def build_call_scorecard(
    *,
    rubric: dict[str, Any],
    annotations: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build pass/fail grid for call detail from org rubric + QA annotations."""
    criteria = rubric.get("criteria") or []
    results = _collect_criteria_results(annotations)
    rows: list[dict[str, Any]] = []
    passed = 0
    evaluated = 0
    for c in criteria:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or "")
        hit = results.get(cid)
        p = hit.get("pass") if hit else None
        if p is True:
            passed += 1
            evaluated += 1
        elif p is False:
            evaluated += 1
        rows.append(
            {
                "criterion_id": cid,
                "label": c.get("label"),
                "description": c.get("description"),
                "pass": p,
                "note": hit.get("note") if hit else None,
                "source_node": hit.get("source_node") if hit else None,
            }
        )
    total = len(rows)
    return {
        "rubric_version": rubric.get("v", 1),
        "criteria": rows,
        "summary": {
            "evaluated_count": evaluated,
            "passed_count": passed,
            "pass_rate": round(passed / evaluated, 2) if evaluated else None,
            "total_criteria": total,
        },
    }


def build_qa_criteria_prompt_hint(rubric: dict[str, Any]) -> str:
    """Snippet for QA node system prompt — lists criterion ids the LLM should score."""
    criteria = rubric.get("criteria") or []
    if not criteria:
        return SCORECARD_CRITERIA_JSON_HINT
    lines = [
        "Score each rubric criterion in your JSON response under `criteria`:",
    ]
    for c in criteria:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or "").strip()
        label = str(c.get("label") or "").strip()
        if cid:
            lines.append(f'- "{cid}": {label}')
    lines.append(
        'Example: "criteria": [{"criterion_id": "greeting", "pass": true, "note": "…"}]'
    )
    return "\n".join(lines)


def parse_criteria_from_qa_parsed(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize criteria array from QA LLM JSON."""
    raw = parsed.get("criteria")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("criterion_id") or row.get("id") or "").strip()
        if not cid:
            continue
        p = _coerce_pass(row.get("pass"))
        out.append(
            {
                "criterion_id": cid,
                "pass": p if p is not None else False,
                "note": str(row.get("note") or "").strip() or None,
            }
        )
    return out
