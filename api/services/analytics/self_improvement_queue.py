"""Agent self-improvement queue — enqueue, policy, approve, auto-apply (MK-01-SELFIMPROVE)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from api.db import db_client
from api.enums import OrganizationConfigurationKey
from api.services.analytics.apply_workflow_improvement import (
    append_improvement_to_workflow_definition,
)
from api.services.analytics.self_improvement_policy import (
    ImprovementProposal,
    classify_improvement,
    evaluate_proposal,
    load_policy_catalog,
    resolve_effective_policy,
)
from api.services.analytics.self_improvement_rollup import rollup_pending_proposals
from api.services.analytics.self_improvement_store import (
    append_proposal,
    auto_apply_stats_for_today,
    count_supporting_calls,
    empty_store,
    find_proposal,
    list_proposals_by_status,
    new_proposal_id,
    normalize_store,
    record_auto_apply,
    update_proposal,
)


async def _load_store(org_id: int) -> dict[str, Any]:
    raw = await db_client.get_configuration_value(
        org_id,
        OrganizationConfigurationKey.MK01_AGENT_SELF_IMPROVEMENT.value,
        default=None,
    )
    return normalize_store(raw)


async def _save_store(org_id: int, store: dict[str, Any]) -> None:
    await db_client.upsert_configuration(
        org_id,
        OrganizationConfigurationKey.MK01_AGENT_SELF_IMPROVEMENT.value,
        normalize_store(store),
    )


def policy_api_payload(org_id: int, store: dict[str, Any]) -> dict[str, Any]:
    del org_id  # reserved for future org-specific catalog overrides
    catalog = load_policy_catalog()
    effective = resolve_effective_policy(store.get("policy_overrides"))
    return {
        "mode": effective.mode,
        "evidence_gates": {
            "min_supporting_calls": effective.gates.min_supporting_calls,
            "max_quality_score_to_trigger": effective.gates.max_quality_score_to_trigger,
            "min_confidence": effective.gates.min_confidence,
            "cooldown_hours": effective.gates.cooldown_hours,
            "max_auto_applies_per_day": effective.gates.max_auto_applies_per_day,
        },
        "category_decisions": dict(effective.category_decisions),
        "catalog_version": int(catalog.get("version") or 1),
    }


def proposal_to_api(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("id") or ""),
        "status": row.get("status") or "pending",
        "title": str(row.get("title") or "Improvement"),
        "text": str(row.get("text") or ""),
        "category": str(row.get("category") or "unknown"),
        "risk_tier": str(row.get("risk_tier") or "medium"),
        "requires_human": bool(row.get("requires_human")),
        "auto_eligible": bool(row.get("auto_eligible")),
        "decision": str(row.get("decision") or "queue"),
        "reasons": list(row.get("reasons") or []),
        "call_id": row.get("call_id"),
        "workflow_id": row.get("workflow_id"),
        "workflow_name": row.get("workflow_name"),
        "catalog_slug": row.get("catalog_slug"),
        "recommendation_index": row.get("recommendation_index"),
        "applied_node_id": row.get("applied_node_id"),
        "created_at": str(row.get("created_at") or ""),
        "resolved_at": row.get("resolved_at"),
        "resolved_by_user_id": row.get("resolved_by_user_id"),
    }


async def get_self_improvement_policy(org_id: int) -> dict[str, Any]:
    store = await _load_store(org_id)
    return policy_api_payload(org_id, store)


async def put_self_improvement_policy(
    org_id: int,
    *,
    mode: str | None = None,
    evidence_gates: dict[str, Any] | None = None,
    category_decisions: dict[str, str] | None = None,
) -> dict[str, Any]:
    store = await _load_store(org_id)
    overrides = dict(store.get("policy_overrides") or {})
    if mode is not None:
        overrides["mode"] = mode
    if evidence_gates is not None:
        overrides["evidence_gates"] = {
            **(overrides.get("evidence_gates") or {}),
            **evidence_gates,
        }
    if category_decisions is not None:
        overrides["category_decisions"] = {
            **(overrides.get("category_decisions") or {}),
            **category_decisions,
        }
    store["policy_overrides"] = overrides
    await _save_store(org_id, store)
    return policy_api_payload(org_id, store)


async def list_improvement_queue(
    org_id: int,
    *,
    status: str | None = "pending",
) -> dict[str, Any]:
    store = await _load_store(org_id)
    items = [proposal_to_api(r) for r in list_proposals_by_status(store, status)]
    pending = list_proposals_by_status(store, "pending")
    return {
        "items": items,
        "pending_count": len(pending),
        "policy": policy_api_payload(org_id, store),
    }


async def _apply_improvement_to_workflow(
    org_id: int,
    workflow_id: int,
    improvement: str,
) -> str | None:
    workflow = await db_client.get_workflow(workflow_id, organization_id=org_id)
    if not workflow:
        raise ValueError("Workflow not found")
    draft = await db_client.get_draft_version(workflow_id)
    base_def = (
        draft.workflow_json
        if draft
        else workflow.released_definition.workflow_json
    )
    new_def, node_id = append_improvement_to_workflow_definition(base_def, improvement)
    template_vars = (
        draft.template_context_variables
        if draft
        else workflow.released_definition.template_context_variables
    )
    await db_client.update_workflow(
        workflow_id=workflow_id,
        name=workflow.name,
        workflow_definition=new_def,
        template_context_variables=template_vars,
        workflow_configurations=workflow.workflow_configurations,
        organization_id=org_id,
    )
    return node_id


async def enqueue_from_call_review(
    org_id: int,
    *,
    call_id: str,
    workflow_id: int,
    workflow_name: str | None,
    catalog_slug: str | None,
    review: dict[str, Any],
    quality_score: float | None = None,
) -> list[dict[str, Any]]:
    """Evaluate each AI recommendation and queue or auto-apply per org policy."""
    store = await _load_store(org_id)
    effective = resolve_effective_policy(store.get("policy_overrides"))
    if effective.mode == "off":
        return []

    auto_today, hours_since = auto_apply_stats_for_today(store)
    created: list[dict[str, Any]] = []

    for idx, rec in enumerate(review.get("recommendations") or []):
        if not isinstance(rec, dict):
            continue
        text = str(rec.get("prompt_snippet") or rec.get("detail") or "").strip()
        if not text:
            continue
        title = str(rec.get("title") or "Improvement")
        category_probe = ImprovementProposal(text=text, title=title)
        category_id = classify_improvement(category_probe.classification_text())

        supporting = count_supporting_calls(store, category_id)
        decision = evaluate_proposal(
            ImprovementProposal(
                text=text,
                title=title,
                confidence=0.85 if review.get("source") == "llm" else 0.55,
                supporting_calls=supporting,
                quality_score=quality_score,
                auto_applies_today=auto_today,
                hours_since_last_auto_apply=hours_since,
            ),
            policy=effective,
        )

        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": new_proposal_id(),
            "status": "pending",
            "title": title,
            "text": text,
            "category": decision.category,
            "risk_tier": decision.risk_tier,
            "requires_human": decision.requires_human,
            "auto_eligible": decision.auto_eligible,
            "decision": decision.decision,
            "reasons": decision.reasons,
            "call_id": call_id,
            "workflow_id": workflow_id,
            "workflow_name": workflow_name,
            "catalog_slug": catalog_slug,
            "recommendation_index": idx,
            "applied_node_id": None,
            "created_at": now,
            "resolved_at": None,
            "resolved_by_user_id": None,
        }

        if decision.decision == "auto_apply":
            try:
                node_id = await _apply_improvement_to_workflow(org_id, workflow_id, text)
                row["status"] = "auto_applied"
                row["applied_node_id"] = node_id
                row["resolved_at"] = now
                store = record_auto_apply(store)
                auto_today, hours_since = auto_apply_stats_for_today(store)
            except Exception:
                row["status"] = "pending"
                row["requires_human"] = True
                row["reasons"] = [*decision.reasons, "auto-apply failed; queued for human review"]
        elif decision.decision == "reject":
            continue

    store = append_proposal(store, row)
        created.append(proposal_to_api(row))

    store, _rollup_stats = rollup_pending_proposals(store)
    await _save_store(org_id, store)
    return created


async def approve_improvement_proposal(
    org_id: int,
    user_id: int,
    proposal_id: str,
) -> tuple[dict[str, Any], str, str | None]:
    store = await _load_store(org_id)
    row = find_proposal(store, proposal_id)
    if not row:
        raise LookupError("Proposal not found")
    if row.get("status") not in ("pending",):
        raise ValueError(f"Proposal is already {row.get('status')}")

    workflow_id = row.get("workflow_id")
    if not workflow_id:
        raise ValueError("Proposal has no workflow_id")

    node_id = await _apply_improvement_to_workflow(org_id, int(workflow_id), str(row.get("text") or ""))
    now = datetime.now(timezone.utc).isoformat()
    store, updated = update_proposal(
        store,
        proposal_id,
        {
            "status": "approved",
            "applied_node_id": node_id,
            "resolved_at": now,
            "resolved_by_user_id": user_id,
        },
    )
    await _save_store(org_id, store)
    if not updated:
        raise LookupError("Proposal not found")
    return proposal_to_api(updated), "Improvement applied to agent prompt.", node_id


async def reject_improvement_proposal(
    org_id: int,
    user_id: int,
    proposal_id: str,
) -> tuple[dict[str, Any], str]:
    store = await _load_store(org_id)
    row = find_proposal(store, proposal_id)
    if not row:
        raise LookupError("Proposal not found")
    if row.get("status") not in ("pending",):
        raise ValueError(f"Proposal is already {row.get('status')}")

    now = datetime.now(timezone.utc).isoformat()
    store, updated = update_proposal(
        store,
        proposal_id,
        {
            "status": "rejected",
            "resolved_at": now,
            "resolved_by_user_id": user_id,
        },
    )
    await _save_store(org_id, store)
    if not updated:
        raise LookupError("Proposal not found")
    return proposal_to_api(updated), "Proposal dismissed."


async def reset_self_improvement_store(org_id: int) -> None:
    """Testing helper — clear queue for org."""
    await _save_store(org_id, empty_store())
