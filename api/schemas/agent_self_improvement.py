"""Agent self-improvement queue API schemas (MK-01-SELFIMPROVE)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ProposalStatus = Literal[
    "pending",
    "auto_applied",
    "approved",
    "rejected",
    "applied",
]
PolicyMode = Literal["off", "suggest", "auto_with_queue", "full_auto"]


class SelfImprovementPolicyResponse(BaseModel):
    mode: PolicyMode
    evidence_gates: dict[str, Any] = Field(default_factory=dict)
    category_decisions: dict[str, str] = Field(default_factory=dict)
    catalog_version: int = 1


class SelfImprovementPolicyPutBody(BaseModel):
    mode: PolicyMode | None = None
    evidence_gates: dict[str, Any] | None = None
    category_decisions: dict[str, str] | None = None


class ImprovementProposalResponse(BaseModel):
    id: str
    status: ProposalStatus
    title: str
    text: str
    category: str
    risk_tier: str
    requires_human: bool
    auto_eligible: bool
    decision: str
    reasons: list[str] = Field(default_factory=list)
    call_id: str | None = None
    workflow_id: int | None = None
    workflow_name: str | None = None
    catalog_slug: str | None = None
    recommendation_index: int | None = None
    applied_node_id: str | None = None
    created_at: str
    resolved_at: str | None = None
    resolved_by_user_id: int | None = None


class ImprovementQueueListResponse(BaseModel):
    items: list[ImprovementProposalResponse]
    pending_count: int = 0
    policy: SelfImprovementPolicyResponse


class ImprovementProposalActionResponse(BaseModel):
    proposal: ImprovementProposalResponse
    message: str
    applied_node_id: str | None = None
