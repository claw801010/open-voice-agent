"""Analytics call AI review + customer follow-up (MK-01)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

FollowUpActionType = Literal[
    "call",
    "sms",
    "email",
    "appointment",
    "confirm",
    "other",
]

FollowUpStatus = Literal["pending", "completed", "cancelled"]


class CallReviewRecommendation(BaseModel):
    title: str
    detail: str
    prompt_snippet: str = Field(
        description="Short instruction to append to the agent prompt",
    )


class CallAiReviewResponse(BaseModel):
    call_id: str
    summary: str
    outcome_analysis: str
    recommendations: list[CallReviewRecommendation] = Field(default_factory=list)
    suggested_outcome: str | None = None
    transcript_excerpt: str | None = Field(
        default=None,
        description="Truncated transcript used for the review (may be redacted).",
    )
    generated_at: str
    model: str | None = None
    source: Literal["llm", "heuristic"] = "llm"


class GenerateCallAiReviewBody(BaseModel):
    force_refresh: bool = False


class CreateFollowUpBody(BaseModel):
    action_type: FollowUpActionType
    notes: str = ""
    scheduled_at: str | None = Field(
        default=None,
        description="Optional ISO-8601 when the follow-up should happen",
    )
    contact_hint: str | None = Field(
        default=None,
        description="Phone, email, or name hint for the operator",
    )


class FollowUpItemResponse(BaseModel):
    id: str
    action_type: FollowUpActionType
    status: FollowUpStatus
    notes: str
    scheduled_at: str | None = None
    contact_hint: str | None = None
    created_at: str
    created_by_user_id: int | None = None


class FollowUpListResponse(BaseModel):
    items: list[FollowUpItemResponse]


class ApplyWorkflowImprovementBody(BaseModel):
    improvement: str = Field(min_length=1, max_length=8000)
    recommendation_index: int | None = Field(
        default=None,
        description="When set, uses recommendations[n].prompt_snippet from cached review",
    )
    target: Literal["agent_prompt"] = "agent_prompt"


class ApplyWorkflowImprovementResponse(BaseModel):
    workflow_id: int
    node_id: str | None = None
    message: str
