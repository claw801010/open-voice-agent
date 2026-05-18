"""Workflow external-import request/response models (MK-01-IMPORT-OPTIONS)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CallDispositionCodes(BaseModel):
    disposition_codes: list[str] = []


class WorkflowResponse(BaseModel):
    id: int
    name: str
    status: str
    created_at: datetime
    workflow_definition: dict
    current_definition_id: int | None
    template_context_variables: dict | None = None
    call_disposition_codes: CallDispositionCodes | None = None
    total_runs: int | None = None
    workflow_configurations: dict | None = None
    version_number: int | None = None
    version_status: str | None = None


class N8nPackagedDraftRequest(BaseModel):
    n8n_export: dict[str, Any] | list[Any] = Field(
        ...,
        description="Raw n8n export; HTTP Request nodes become tool hints in a linear voice graph.",
    )
    strict_http_only: bool = Field(
        default=False,
        description="When true, reject exports containing non-HTTP nodes.",
    )
    emit_branch_subflows: bool = Field(
        default=True,
        description="Map n8n IF/Switch branches to Dograh subflows.",
    )


class N8nPackagedDraftResponse(BaseModel):
    workflow_definition: dict
    warnings: list[str] = Field(default_factory=list)


class N8nImportAndCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    n8n_export: dict[str, Any] | list[Any]
    strict_http_only: bool = False
    emit_branch_subflows: bool = True


class N8nImportAndCreateResponse(WorkflowResponse):
    warnings: list[str] = Field(default_factory=list)


class MakePackagedDraftRequest(BaseModel):
    make_blueprint: dict[str, Any] = Field(..., description="Make scenario blueprint JSON.")
    strict_http_only: bool = False
    emit_route_subflows: bool = True


class MakePackagedDraftResponse(BaseModel):
    workflow_definition: dict
    warnings: list[str] = Field(default_factory=list)


class MakeImportAndCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    make_blueprint: dict[str, Any]
    strict_http_only: bool = False
    emit_route_subflows: bool = True


class MakeImportAndCreateResponse(WorkflowResponse):
    warnings: list[str] = Field(default_factory=list)


class ZapierPackagedDraftRequest(BaseModel):
    zapier_export: dict[str, Any] = Field(
        ...,
        description="Zapier import-subset JSON or platform nodes map.",
    )
    strict_http_only: bool = False
    emit_paths_subflows: bool = True


class ZapierPackagedDraftResponse(BaseModel):
    workflow_definition: dict
    warnings: list[str] = Field(default_factory=list)


class ZapierImportAndCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    zapier_export: dict[str, Any]
    strict_http_only: bool = False
    emit_paths_subflows: bool = True


class ZapierImportAndCreateResponse(WorkflowResponse):
    warnings: list[str] = Field(default_factory=list)


class SkillPackagedDraftRequest(BaseModel):
    skill_markdown: str = Field(..., min_length=1)
    skill_title: str | None = Field(default=None, max_length=200)
    max_prompt_chars: int = Field(default=12_000, ge=500, le=50_000)


class SkillPackagedDraftResponse(BaseModel):
    workflow_definition: dict
    warnings: list[str] = Field(default_factory=list)
    suggested_template_variables: list[str] = Field(default_factory=list)
    agent_prompt_draft: str


class SkillImportAndCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    skill_markdown: str = Field(..., min_length=1)
    skill_title: str | None = None
    max_prompt_chars: int = Field(default=12_000, ge=500, le=50_000)


class SkillImportAndCreateResponse(WorkflowResponse):
    warnings: list[str] = Field(default_factory=list)
    suggested_template_variables: list[str] = Field(default_factory=list)
