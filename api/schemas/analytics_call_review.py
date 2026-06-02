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

FollowUpStatus = Literal["pending", "approved", "edited", "dismissed", "completed", "cancelled"]


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
    suggested_message: str | None = Field(
        default=None,
        description="Draft SMS/email/call script for human-in-the-loop review",
    )
    requires_review: bool = Field(
        default=False,
        description="When true, item appears in Review Inbox until approved or dismissed",
    )


class UpdateFollowUpBody(BaseModel):
    status: FollowUpStatus | None = None
    notes: str | None = None
    suggested_message: str | None = None


class FollowUpItemResponse(BaseModel):
    id: str
    action_type: FollowUpActionType
    status: FollowUpStatus
    notes: str
    scheduled_at: str | None = None
    contact_hint: str | None = None
    suggested_message: str | None = None
    requires_review: bool = False
    created_at: str
    created_by_user_id: int | None = None
    updated_at: str | None = None


class FollowUpListResponse(BaseModel):
    items: list[FollowUpItemResponse]


class ReviewInboxItemResponse(BaseModel):
    call_id: str
    workflow_id: int | None = None
    workflow_name: str | None = None
    catalog_slug: str | None = None
    follow_up: FollowUpItemResponse
    ai_summary: str | None = None


class ReviewInboxListResponse(BaseModel):
    items: list[ReviewInboxItemResponse]
    pending_count: int = 0


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
