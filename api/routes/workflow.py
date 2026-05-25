import json
import re
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError
from loguru import logger
from pydantic import BaseModel, Field, ValidationError

from api.constants import BACKEND_API_ENDPOINT, DEPLOYMENT_MODE, ENABLE_LOCAL_PAYMENTS, ENABLE_LOCAL_SCHEDULING
from api.db import db_client
from api.db.models import UserModel
from api.db.workflow_template_client import WorkflowTemplateClient
from api.enums import CallType, PostHogEvent, StorageBackend
from api.schemas.workflow import WorkflowRunResponseSchema
from api.schemas.workflow_import import (
    MakeImportAndCreateRequest,
    MakeImportAndCreateResponse,
    MakePackagedDraftRequest,
    MakePackagedDraftResponse,
    N8nImportAndCreateRequest,
    N8nImportAndCreateResponse,
    N8nPackagedDraftRequest,
    N8nPackagedDraftResponse,
    SkillImportAndCreateRequest,
    SkillImportAndCreateResponse,
    SkillPackagedDraftRequest,
    SkillPackagedDraftResponse,
    WorkflowResponse,
    ZapierImportAndCreateRequest,
    ZapierImportAndCreateResponse,
    ZapierPackagedDraftRequest,
    ZapierPackagedDraftResponse,
)
from api.services.auth.depends import get_user
from api.services.campaign.report import generate_workflow_report_csv
from api.services.configuration.check_validity import UserConfigurationValidator
from api.services.configuration.masking import (
    mask_workflow_definition,
    merge_workflow_api_keys,
)
from api.services.configuration.resolve import resolve_effective_config
from api.services.mps_service_key_client import mps_service_key_client
from api.services.posthog_client import capture_event
from api.services.storage import storage_fs
from api.services.workflow.dto import ReactFlowDTO
from api.services.workflow.duplicate import duplicate_workflow
from api.services.workflow.errors import ItemKind, WorkflowError
from api.services.workflow.cost_estimate_dry_run import (
    WorkflowCostDryRunResult,
    estimate_workflow_cost_dry_run,
)
from api.services.workflow.simulation_text_turn import (
    SimulationTextTurnRequest,
    SimulationTextTurnResponse,
    run_simulation_text_turn,
)
from api.schemas.usage_rollup import (
    DailyRollupBucket,
    DailyRollupResponse,
    WeeklyRollupBucket,
    WeeklyRollupResponse,
)
from api.services.workflow.workflow import WorkflowGraph
from api.utils.catalog_install import resolve_packaged_definition_ref
from api.utils.make_scenario_adapter import (
    MakeScenarioExportError,
    MakeUnsupportedModulesError,
    draft_packaged_workflow_from_make,
    normalize_make_export,
)
from api.utils.skill_packaged_adapter import (
    SkillImportError,
    draft_packaged_workflow_from_skill,
)
from api.utils.zapier_zap_adapter import (
    ZapierUnsupportedStepsError,
    ZapierZapExportError,
    draft_packaged_workflow_from_zapier,
    normalize_zapier_export,
)
from api.utils.n8n_workflow_adapter import (
    N8nUnsupportedNodesError,
    N8nWorkflowExportError,
    draft_packaged_workflow_from_n8n,
    normalize_n8n_export,
)
from api.utils.usage_rollup_range import parse_utc_inclusive_date_range


def extract_trigger_paths(workflow_definition: dict) -> List[str]:
    """Extract trigger UUIDs from workflow definition.

    Args:
        workflow_definition: The workflow definition JSON

    Returns:
        List of trigger UUIDs found in the workflow
    """
    if not workflow_definition:
        return []

    nodes = workflow_definition.get("nodes", [])
    trigger_paths = []

    for node in nodes:
        if node.get("type") == "trigger":
            trigger_path = node.get("data", {}).get("trigger_path")
            if trigger_path:
                trigger_paths.append(trigger_path)

    return trigger_paths


def regenerate_trigger_uuids(workflow_definition: dict) -> dict:
    """Regenerate UUIDs for all trigger nodes in a workflow definition.

    This should be called when creating a new workflow from a template or
    duplicating a workflow to avoid trigger UUID conflicts.

    Args:
        workflow_definition: The workflow definition JSON

    Returns:
        Updated workflow definition with new trigger UUIDs
    """
    if not workflow_definition:
        return workflow_definition

    # Deep copy to avoid modifying the original
    import copy

    updated_definition = copy.deepcopy(workflow_definition)

    nodes = updated_definition.get("nodes", [])
    for node in nodes:
        if node.get("type") == "trigger":
            # Generate a new UUID for this trigger
            if "data" not in node:
                node["data"] = {}
            node["data"]["trigger_path"] = str(uuid.uuid4())

    return updated_definition


router = APIRouter(prefix="/workflow")


class ValidateWorkflowResponse(BaseModel):
    is_valid: bool
    errors: list[WorkflowError]


class CallDispositionCodes(BaseModel):
    disposition_codes: list[str] = []


class WorkflowListResponse(BaseModel):
    """Lightweight response for workflow listings (excludes large fields)."""

    id: int
    name: str
    status: str
    created_at: datetime
    total_runs: int
    template_context_variables: dict | None = None


class WorkflowCountResponse(BaseModel):
    """Response for workflow count endpoint."""

    total: int
    active: int
    archived: int


class WorkflowTemplateResponse(BaseModel):
    id: int
    template_name: str
    template_description: str
    template_json: dict
    created_at: datetime


class CreateWorkflowRequest(BaseModel):
    name: str
    workflow_definition: dict


def _definition_from_n8n_import(
    n8n_export: dict[str, Any] | list[Any],
    *,
    strict_http_only: bool,
    emit_branch_subflows: bool = True,
) -> tuple[dict[str, Any], list[str]]:
    wf = normalize_n8n_export(n8n_export)
    return draft_packaged_workflow_from_n8n(
        wf,
        strict_http_only=strict_http_only,
        emit_branch_subflows=emit_branch_subflows,
    )


def _definition_from_make_import(
    make_blueprint: dict[str, Any],
    *,
    strict_http_only: bool,
    emit_route_subflows: bool = True,
) -> tuple[dict[str, Any], list[str]]:
    bp = normalize_make_export(make_blueprint)
    return draft_packaged_workflow_from_make(
        bp,
        strict_http_only=strict_http_only,
        emit_route_subflows=emit_route_subflows,
    )


def _definition_from_zapier_import(
    zapier_export: dict[str, Any],
    *,
    strict_http_only: bool,
    emit_paths_subflows: bool = True,
) -> tuple[dict[str, Any], list[str]]:
    zap = normalize_zapier_export(zapier_export)
    return draft_packaged_workflow_from_zapier(
        zap,
        strict_http_only=strict_http_only,
        emit_paths_subflows=emit_paths_subflows,
    )


def _definition_from_skill_import(
    skill_markdown: str,
    *,
    skill_title: str | None,
    max_prompt_chars: int,
) -> tuple[dict[str, Any], list[str], list[str]]:
    graph, warnings, suggested = draft_packaged_workflow_from_skill(
        skill_markdown,
        skill_title=skill_title,
        max_prompt_chars=max_prompt_chars,
    )
    return graph, warnings, suggested


class DuplicateTemplateRequest(BaseModel):
    template_id: int
    workflow_name: str
    template_context_variables: dict | None = None
    catalog_slug: str | None = None
    lock_until_customize: bool = True


class InstallFromCatalogRequest(BaseModel):
    slug: str = Field(..., min_length=1, max_length=128)
    workflow_name: str = Field(..., min_length=1, max_length=200)
    variant_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description="Optional; must match a variant_id in the pack's workflow_variants (catalog/vertical-packs.json).",
    )


class UpdateWorkflowRequest(BaseModel):
    name: str | None = None
    workflow_definition: dict | None = None
    template_context_variables: dict | None = None
    workflow_configurations: dict | None = None


class WorkflowVersionResponse(BaseModel):
    id: int
    version_number: int
    status: str
    created_at: datetime
    published_at: datetime | None = None
    workflow_json: dict
    workflow_configurations: dict | None = None
    template_context_variables: dict | None = None


class UpdateWorkflowStatusRequest(BaseModel):
    status: str  # "active" or "archived"


class CreateWorkflowRunRequest(BaseModel):
    mode: str
    name: str


class CreateWorkflowRunResponse(BaseModel):
    id: int
    workflow_id: int
    name: str
    mode: str
    created_at: datetime
    definition_id: int
    initial_context: dict | None = None


class CreateWorkflowTemplateRequest(BaseModel):
    call_type: Literal[CallType.INBOUND.value, CallType.OUTBOUND.value]
    use_case: str
    activity_description: str


@router.post("/{workflow_id}/validate")
async def validate_workflow(
    workflow_id: int,
    user: UserModel = Depends(get_user),
) -> ValidateWorkflowResponse:
    """
    Validate all nodes in a workflow to ensure they have required fields.

    Args:
        workflow_id: The ID of the workflow to validate
        user: The authenticated user

    Returns:
        Object indicating if workflow is valid and any invalid nodes/edges
    """
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )

    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )

    errors: list[WorkflowError] = []

    # Validate draft if it exists (user is editing), else validate published
    draft = await db_client.get_draft_version(workflow_id)
    workflow_definition = (
        draft.workflow_json if draft else workflow.released_definition.workflow_json
    )

    # ----------- DTO Validation ------------
    dto: Optional[ReactFlowDTO] = None

    try:
        dto = ReactFlowDTO.model_validate(workflow_definition)
    except ValidationError as exc:
        errors.extend(_transform_schema_errors(exc, workflow_definition))

    # ----------- Graph Validation if DTO is valid ------------
    try:
        if dto:
            WorkflowGraph(dto)
    except ValueError as e:
        errors.extend(e.args[0])

    if errors:
        raise HTTPException(
            status_code=422,
            detail=ValidateWorkflowResponse(is_valid=False, errors=errors).model_dump(),
        )

    return ValidateWorkflowResponse(is_valid=True, errors=[])


def _transform_schema_errors(
    exc: ValidationError, workflow_definition: dict
) -> list[WorkflowError]:
    out: list[WorkflowError] = []

    for err in exc.errors():
        loc = err["loc"]
        idx = workflow_definition[loc[0]][loc[1]]["id"]

        kind: ItemKind = ItemKind.node if loc[0] == "nodes" else ItemKind.edge

        out.append(
            WorkflowError(
                kind=kind,
                id=idx,
                field=".".join(str(p) for p in err["loc"][2:]) or None,
                message=err["msg"].capitalize(),
            )
        )
    return out


@router.post("/create/definition")
async def create_workflow(
    request: CreateWorkflowRequest, user: UserModel = Depends(get_user)
) -> WorkflowResponse:
    """
    Create a new workflow from the client

    Args:
        request: The create workflow request
        user: The user to create the workflow for
    """
    workflow = await db_client.create_workflow(
        request.name,
        request.workflow_definition,
        user.id,
        user.selected_organization_id,
    )

    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.WORKFLOW_CREATED,
        properties={
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "source": "direct",
            "organization_id": user.selected_organization_id,
        },
    )

    # Sync agent triggers if workflow definition contains any
    if request.workflow_definition:
        trigger_paths = extract_trigger_paths(request.workflow_definition)
        if trigger_paths:
            await db_client.sync_triggers_for_workflow(
                workflow_id=workflow.id,
                organization_id=user.selected_organization_id,
                trigger_paths=trigger_paths,
            )

    return {
        "id": workflow.id,
        "name": workflow.name,
        "status": workflow.status,
        "created_at": workflow.created_at,
        "workflow_definition": mask_workflow_definition(request.workflow_definition),
        "current_definition_id": workflow.current_definition_id,
        "template_context_variables": workflow.template_context_variables,
        "call_disposition_codes": workflow.call_disposition_codes,
        "workflow_configurations": workflow.workflow_configurations,
    }


@router.post("/import/n8n-packaged-draft")
async def import_n8n_packaged_draft(
    request: N8nPackagedDraftRequest,
    user: UserModel = Depends(get_user),
) -> N8nPackagedDraftResponse:
    """
    Convert an n8n export into a Dograh packaged-style workflow_definition.

    By default, non-HTTP nodes are skipped with warnings. Set ``strict_http_only`` to reject them.
    Does not create a workflow row — pair with ``POST /create/definition`` or the catalog install path.
    """
    _ = user
    try:
        definition, warnings = _definition_from_n8n_import(
            request.n8n_export,
            strict_http_only=request.strict_http_only,
            emit_branch_subflows=request.emit_branch_subflows,
        )
    except N8nUnsupportedNodesError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except N8nWorkflowExportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return N8nPackagedDraftResponse(
        workflow_definition=definition,
        warnings=warnings,
    )


@router.post("/import/n8n-and-create")
async def import_n8n_and_create_workflow(
    request: N8nImportAndCreateRequest,
    user: UserModel = Depends(get_user),
) -> N8nImportAndCreateResponse:
    """
    Convert an n8n export into a workflow_definition and create a workflow in the caller's org.

    Same n8n rules as ``/import/n8n-packaged-draft``; returns the new workflow row plus import warnings.
    """
    try:
        definition, warnings = _definition_from_n8n_import(
            request.n8n_export,
            strict_http_only=request.strict_http_only,
            emit_branch_subflows=request.emit_branch_subflows,
        )
    except N8nUnsupportedNodesError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except N8nWorkflowExportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    workflow = await db_client.create_workflow(
        request.name,
        definition,
        user.id,
        user.selected_organization_id,
    )

    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.WORKFLOW_CREATED,
        properties={
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "source": "n8n_import",
            "organization_id": user.selected_organization_id,
        },
    )

    trigger_paths = extract_trigger_paths(definition)
    if trigger_paths:
        await db_client.sync_triggers_for_workflow(
            workflow_id=workflow.id,
            organization_id=user.selected_organization_id,
            trigger_paths=trigger_paths,
        )

    return N8nImportAndCreateResponse(
        id=workflow.id,
        name=workflow.name,
        status=workflow.status,
        created_at=workflow.created_at,
        workflow_definition=mask_workflow_definition(definition),
        current_definition_id=workflow.current_definition_id,
        template_context_variables=workflow.template_context_variables,
        call_disposition_codes=workflow.call_disposition_codes,
        workflow_configurations=workflow.workflow_configurations,
        warnings=warnings,
    )


@router.post("/import/make-packaged-draft")
async def import_make_packaged_draft(
    request: MakePackagedDraftRequest,
    user: UserModel = Depends(get_user),
) -> MakePackagedDraftResponse:
    """Convert a Make scenario blueprint into a Dograh packaged-style workflow_definition."""
    _ = user
    try:
        definition, warnings = _definition_from_make_import(
            request.make_blueprint,
            strict_http_only=request.strict_http_only,
            emit_route_subflows=request.emit_route_subflows,
        )
    except MakeUnsupportedModulesError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except MakeScenarioExportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return MakePackagedDraftResponse(
        workflow_definition=definition,
        warnings=warnings,
    )


@router.post("/import/make-and-create")
async def import_make_and_create_workflow(
    request: MakeImportAndCreateRequest,
    user: UserModel = Depends(get_user),
) -> MakeImportAndCreateResponse:
    """Convert a Make blueprint and create a workflow in the caller's org."""
    try:
        definition, warnings = _definition_from_make_import(
            request.make_blueprint,
            strict_http_only=request.strict_http_only,
            emit_route_subflows=request.emit_route_subflows,
        )
    except MakeUnsupportedModulesError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except MakeScenarioExportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    workflow = await db_client.create_workflow(
        request.name,
        definition,
        user.id,
        user.selected_organization_id,
    )

    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.WORKFLOW_CREATED,
        properties={
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "source": "make_import",
            "organization_id": user.selected_organization_id,
        },
    )

    trigger_paths = extract_trigger_paths(definition)
    if trigger_paths:
        await db_client.sync_triggers_for_workflow(
            workflow_id=workflow.id,
            organization_id=user.selected_organization_id,
            trigger_paths=trigger_paths,
        )

    return MakeImportAndCreateResponse(
        id=workflow.id,
        name=workflow.name,
        status=workflow.status,
        created_at=workflow.created_at,
        workflow_definition=mask_workflow_definition(definition),
        current_definition_id=workflow.current_definition_id,
        template_context_variables=workflow.template_context_variables,
        call_disposition_codes=workflow.call_disposition_codes,
        workflow_configurations=workflow.workflow_configurations,
        warnings=warnings,
    )


@router.post("/import/zapier-packaged-draft")
async def import_zapier_packaged_draft(
    request: ZapierPackagedDraftRequest,
    user: UserModel = Depends(get_user),
) -> ZapierPackagedDraftResponse:
    """Convert a Zapier import-subset export into a packaged-style workflow_definition."""
    _ = user
    try:
        definition, warnings = _definition_from_zapier_import(
            request.zapier_export,
            strict_http_only=request.strict_http_only,
            emit_paths_subflows=request.emit_paths_subflows,
        )
    except ZapierUnsupportedStepsError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ZapierZapExportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ZapierPackagedDraftResponse(
        workflow_definition=definition,
        warnings=warnings,
    )


@router.post("/import/zapier-and-create")
async def import_zapier_and_create_workflow(
    request: ZapierImportAndCreateRequest,
    user: UserModel = Depends(get_user),
) -> ZapierImportAndCreateResponse:
    """Convert a Zapier export and create a workflow in the caller's org."""
    try:
        definition, warnings = _definition_from_zapier_import(
            request.zapier_export,
            strict_http_only=request.strict_http_only,
            emit_paths_subflows=request.emit_paths_subflows,
        )
    except ZapierUnsupportedStepsError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ZapierZapExportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    workflow = await db_client.create_workflow(
        request.name,
        definition,
        user.id,
        user.selected_organization_id,
    )

    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.WORKFLOW_CREATED,
        properties={
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "source": "zapier_import",
            "organization_id": user.selected_organization_id,
        },
    )

    trigger_paths = extract_trigger_paths(definition)
    if trigger_paths:
        await db_client.sync_triggers_for_workflow(
            workflow_id=workflow.id,
            organization_id=user.selected_organization_id,
            trigger_paths=trigger_paths,
        )

    return ZapierImportAndCreateResponse(
        id=workflow.id,
        name=workflow.name,
        status=workflow.status,
        created_at=workflow.created_at,
        workflow_definition=mask_workflow_definition(definition),
        current_definition_id=workflow.current_definition_id,
        template_context_variables=workflow.template_context_variables,
        call_disposition_codes=workflow.call_disposition_codes,
        workflow_configurations=workflow.workflow_configurations,
        warnings=warnings,
    )


@router.post("/import/skill-packaged-draft")
async def import_skill_packaged_draft(
    request: SkillPackagedDraftRequest,
    user: UserModel = Depends(get_user),
) -> SkillPackagedDraftResponse:
    """Distill agent skill markdown into a packaged-style workflow_definition."""
    _ = user
    try:
        definition, warnings, suggested = _definition_from_skill_import(
            request.skill_markdown,
            skill_title=request.skill_title,
            max_prompt_chars=request.max_prompt_chars,
        )
    except SkillImportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    agent_prompt = next(
        n["data"]["prompt"]
        for n in definition["nodes"]
        if n.get("type") == "agentNode"
    )
    return SkillPackagedDraftResponse(
        workflow_definition=definition,
        warnings=warnings,
        suggested_template_variables=suggested,
        agent_prompt_draft=agent_prompt,
    )


@router.post("/import/skill-and-create")
async def import_skill_and_create_workflow(
    request: SkillImportAndCreateRequest,
    user: UserModel = Depends(get_user),
) -> SkillImportAndCreateResponse:
    """Distill skill markdown and create a workflow in the caller's org."""
    try:
        definition, warnings, suggested = _definition_from_skill_import(
            request.skill_markdown,
            skill_title=request.skill_title,
            max_prompt_chars=request.max_prompt_chars,
        )
    except SkillImportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    workflow = await db_client.create_workflow(
        request.name,
        definition,
        user.id,
        user.selected_organization_id,
    )

    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.WORKFLOW_CREATED,
        properties={
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "source": "skill_import",
            "organization_id": user.selected_organization_id,
        },
    )

    trigger_paths = extract_trigger_paths(definition)
    if trigger_paths:
        await db_client.sync_triggers_for_workflow(
            workflow_id=workflow.id,
            organization_id=user.selected_organization_id,
            trigger_paths=trigger_paths,
        )

    return SkillImportAndCreateResponse(
        id=workflow.id,
        name=workflow.name,
        status=workflow.status,
        created_at=workflow.created_at,
        workflow_definition=mask_workflow_definition(definition),
        current_definition_id=workflow.current_definition_id,
        template_context_variables=workflow.template_context_variables,
        call_disposition_codes=workflow.call_disposition_codes,
        workflow_configurations=workflow.workflow_configurations,
        warnings=warnings,
        suggested_template_variables=suggested,
    )


@router.post("/create/template")
async def create_workflow_from_template(
    request: CreateWorkflowTemplateRequest,
    user: UserModel = Depends(get_user),
) -> WorkflowResponse:
    """
    Create a new workflow from a natural language template request.

    This endpoint:
    1. Uses mps_service_key_client to call MPS workflow API
    2. Passes organization ID (authenticated mode) or created_by (OSS mode)
    3. Creates the workflow in the database

    Args:
        request: The template creation request with call_type, use_case, and activity_description
        user: The authenticated user

    Returns:
        The created workflow

    Raises:
        HTTPException: If MPS API call fails
    """
    try:
        # Call MPS API to generate workflow using the client
        if DEPLOYMENT_MODE == "oss":
            workflow_data = await mps_service_key_client.call_workflow_api(
                call_type=request.call_type.upper(),
                use_case=request.use_case,
                activity_description=request.activity_description,
                created_by=str(user.provider_id),
            )
        else:
            if not user.selected_organization_id:
                raise HTTPException(status_code=400, detail="No organization selected")

            workflow_data = await mps_service_key_client.call_workflow_api(
                call_type=request.call_type.upper(),
                use_case=request.use_case,
                activity_description=request.activity_description,
                organization_id=user.selected_organization_id,
            )

        # Create the workflow in our database
        # Regenerate trigger UUIDs to avoid conflicts with existing triggers
        workflow_def = regenerate_trigger_uuids(
            workflow_data.get("workflow_definition", {})
        )
        workflow = await db_client.create_workflow(
            name=workflow_data.get("name", f"{request.use_case} - {request.call_type}"),
            workflow_definition=workflow_def,
            user_id=user.id,
            organization_id=user.selected_organization_id,
        )

        capture_event(
            distinct_id=str(user.provider_id),
            event=PostHogEvent.WORKFLOW_CREATED,
            properties={
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                "source": "template",
                "call_type": request.call_type,
                "use_case": request.use_case,
                "organization_id": user.selected_organization_id,
            },
        )

        # Sync agent triggers if workflow definition contains any
        if workflow_def:
            trigger_paths = extract_trigger_paths(workflow_def)
            if trigger_paths:
                await db_client.sync_triggers_for_workflow(
                    workflow_id=workflow.id,
                    organization_id=user.selected_organization_id,
                    trigger_paths=trigger_paths,
                )

        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status,
            "created_at": workflow.created_at,
            "workflow_definition": mask_workflow_definition(workflow_def),
            "current_definition_id": workflow.current_definition_id,
            "template_context_variables": workflow.template_context_variables,
            "call_disposition_codes": workflow.call_disposition_codes,
            "workflow_configurations": workflow.workflow_configurations,
        }

    except HTTPStatusError as e:
        logger.error(f"MPS API error: {e}")
        raise HTTPException(
            status_code=e.response.status_code if hasattr(e, "response") else 500,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Unexpected error creating workflow from template: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}",
        )


class WorkflowSummaryResponse(BaseModel):
    id: int
    name: str


@router.get("/count")
async def get_workflow_count(
    user: UserModel = Depends(get_user),
) -> WorkflowCountResponse:
    """Get workflow counts for the authenticated user's organization.

    This is a lightweight endpoint for checking if the user has workflows,
    useful for redirect logic without fetching full workflow data.
    """
    counts = await db_client.get_workflow_counts(
        organization_id=user.selected_organization_id
    )

    return WorkflowCountResponse(
        total=counts["total"],
        active=counts["active"],
        archived=counts["archived"],
    )


@router.get("/fetch")
async def get_workflows(
    user: UserModel = Depends(get_user),
    status: Optional[str] = Query(
        None,
        description="Filter by status - can be single value (active/archived) or comma-separated (active,archived)",
    ),
) -> List[WorkflowListResponse]:
    """Get all workflows for the authenticated user's organization.

    Returns a lightweight response with only essential fields for listing.
    Use GET /workflow/fetch/{workflow_id} to get full workflow details.
    """
    # Handle comma-separated status values
    if status and "," in status:
        # Split comma-separated values and fetch workflows for each status
        status_list = [s.strip() for s in status.split(",")]
        all_workflows = []
        for status_value in status_list:
            workflows = await db_client.get_all_workflows_for_listing(
                organization_id=user.selected_organization_id, status=status_value
            )
            all_workflows.extend(workflows)
        workflows = all_workflows
    else:
        # Single status or no status filter
        workflows = await db_client.get_all_workflows_for_listing(
            organization_id=user.selected_organization_id, status=status
        )

    # Get run counts for all workflows in a single query
    workflow_ids = [workflow.id for workflow in workflows]
    run_counts = await db_client.get_workflow_run_counts(workflow_ids)

    return [
        WorkflowListResponse(
            id=workflow.id,
            name=workflow.name,
            status=workflow.status,
            created_at=workflow.created_at,
            total_runs=run_counts.get(workflow.id, 0),
            template_context_variables=workflow.template_context_variables,
        )
        for workflow in workflows
    ]


@router.get("/fetch/{workflow_id}")
async def get_workflow(
    workflow_id: int,
    user: UserModel = Depends(get_user),
) -> WorkflowResponse:
    """Get a single workflow by ID.

    If a draft version exists, returns the draft content for editing.
    Otherwise returns the published version's content.
    """
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )

    # Check for draft — editor should show draft content if it exists
    draft = await db_client.get_draft_version(workflow_id)

    if draft:
        workflow_def = draft.workflow_json
        workflow_configs = draft.workflow_configurations
        template_vars = draft.template_context_variables
    else:
        published = workflow.released_definition
        workflow_def = published.workflow_json
        workflow_configs = published.workflow_configurations
        template_vars = published.template_context_variables

    active_def = draft or workflow.released_definition
    return {
        "id": workflow.id,
        "name": workflow.name,
        "status": workflow.status,
        "created_at": workflow.created_at,
        "workflow_definition": mask_workflow_definition(workflow_def),
        "current_definition_id": workflow.current_definition_id,
        "template_context_variables": template_vars,
        "call_disposition_codes": workflow.call_disposition_codes,
        "workflow_configurations": workflow_configs,
        "version_number": active_def.version_number if active_def else None,
        "version_status": active_def.status if active_def else None,
    }


@router.get("/{workflow_id}/versions")
async def get_workflow_versions(
    workflow_id: int,
    user: UserModel = Depends(get_user),
) -> list[WorkflowVersionResponse]:
    """List all versions for a workflow, newest first."""
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )

    versions = await db_client.get_workflow_versions(workflow_id)
    return [
        WorkflowVersionResponse(
            id=v.id,
            version_number=v.version_number,
            status=v.status,
            created_at=v.created_at,
            published_at=v.published_at,
            workflow_json=mask_workflow_definition(v.workflow_json),
            workflow_configurations=v.workflow_configurations,
            template_context_variables=v.template_context_variables,
        )
        for v in versions
        if v.version_number is not None
    ]


@router.post("/{workflow_id}/publish")
async def publish_workflow(
    workflow_id: int,
    user: UserModel = Depends(get_user),
):
    """Publish the current draft version of a workflow."""
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )

    try:
        published = await db_client.publish_workflow_draft(workflow_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.WORKFLOW_PUBLISHED,
        properties={
            "workflow_id": workflow_id,
            "version_number": published.version_number,
            "organization_id": user.selected_organization_id,
        },
    )

    return {
        "id": published.id,
        "version_number": published.version_number,
        "status": published.status,
        "published_at": published.published_at,
    }


@router.post("/{workflow_id}/create-draft")
async def create_workflow_draft(
    workflow_id: int,
    user: UserModel = Depends(get_user),
) -> WorkflowVersionResponse:
    """Create a draft version from the current published version.

    If a draft already exists, returns the existing draft.
    """
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )

    draft = await db_client.save_workflow_draft(workflow_id)
    return WorkflowVersionResponse(
        id=draft.id,
        version_number=draft.version_number,
        status=draft.status,
        created_at=draft.created_at,
        published_at=draft.published_at,
        workflow_json=mask_workflow_definition(draft.workflow_json),
        workflow_configurations=draft.workflow_configurations,
        template_context_variables=draft.template_context_variables,
    )


@router.get("/summary")
async def get_workflows_summary(
    user: UserModel = Depends(get_user),
) -> List[WorkflowSummaryResponse]:
    """Get minimal workflow information (id and name only) for all workflows"""
    workflows = await db_client.get_all_workflows(
        organization_id=user.selected_organization_id
    )
    return [
        WorkflowSummaryResponse(id=workflow.id, name=workflow.name)
        for workflow in workflows
    ]


@router.put("/{workflow_id}/status")
async def update_workflow_status(
    workflow_id: int,
    request: UpdateWorkflowStatusRequest,
    user: UserModel = Depends(get_user),
) -> WorkflowResponse:
    """
    Update the status of a workflow (e.g., archive/unarchive).

    Args:
        workflow_id: The ID of the workflow to update
        request: The status update request

    Returns:
        The updated workflow
    """
    try:
        workflow = await db_client.update_workflow_status(
            workflow_id=workflow_id,
            status=request.status,
            organization_id=user.selected_organization_id,
        )
        run_count = await db_client.get_workflow_run_count(workflow.id)
        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status,
            "created_at": workflow.created_at,
            "workflow_definition": mask_workflow_definition(
                workflow.released_definition.workflow_json
            ),
            "current_definition_id": workflow.current_definition_id,
            "template_context_variables": workflow.template_context_variables,
            "call_disposition_codes": workflow.call_disposition_codes,
            "workflow_configurations": workflow.workflow_configurations,
            "total_runs": run_count,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: int,
    request: UpdateWorkflowRequest,
    user: UserModel = Depends(get_user),
) -> WorkflowResponse:
    """
    Update an existing workflow.

    Args:
        workflow_id: The ID of the workflow to update
        request: The update request containing the new name and workflow definition

    Returns:
        The updated workflow

    Raises:
        HTTPException: If the workflow is not found or if there's a database error
    """
    try:
        # Restore real API keys where the incoming definition has masked placeholders
        workflow_definition = request.workflow_definition
        if workflow_definition:
            existing_workflow = await db_client.get_workflow(
                workflow_id, organization_id=user.selected_organization_id
            )
            if existing_workflow:
                # Merge against what the user was editing (draft or published)
                existing_draft = await db_client.get_draft_version(workflow_id)
                existing_def = (
                    existing_draft.workflow_json
                    if existing_draft
                    else existing_workflow.released_definition.workflow_json
                )
                workflow_definition = merge_workflow_api_keys(
                    workflow_definition,
                    existing_def,
                )

        # Validate model_overrides: resolve onto global config, then
        # run the same validator used by the user-configurations endpoint.
        if request.workflow_configurations and request.workflow_configurations.get(
            "model_overrides"
        ):
            user_config = await db_client.get_user_configurations(user.id)
            try:
                effective = resolve_effective_config(
                    user_config,
                    request.workflow_configurations["model_overrides"],
                )
                await UserConfigurationValidator().validate(
                    effective,
                    organization_id=user.selected_organization_id,
                    created_by=user.provider_id,
                )
            except ValueError as e:
                raise HTTPException(status_code=422, detail=str(e))

        workflow = await db_client.update_workflow(
            workflow_id=workflow_id,
            name=request.name,
            workflow_definition=workflow_definition,
            template_context_variables=request.template_context_variables,
            workflow_configurations=request.workflow_configurations,
            organization_id=user.selected_organization_id,
        )

        # Sync agent triggers if workflow definition was updated
        if workflow_definition:
            trigger_paths = extract_trigger_paths(workflow_definition)
            await db_client.sync_triggers_for_workflow(
                workflow_id=workflow.id,
                organization_id=user.selected_organization_id,
                trigger_paths=trigger_paths,
            )

        # Return draft content if one exists (save creates a draft)
        draft = await db_client.get_draft_version(workflow_id)
        if draft:
            workflow_def = draft.workflow_json
            workflow_configs = draft.workflow_configurations
            template_vars = draft.template_context_variables
        else:
            published = workflow.released_definition
            workflow_def = published.workflow_json
            workflow_configs = published.workflow_configurations
            template_vars = published.template_context_variables

        # Include version info from the active definition (draft or published)
        active_def = draft or workflow.released_definition
        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status,
            "created_at": workflow.created_at,
            "workflow_definition": mask_workflow_definition(workflow_def),
            "current_definition_id": workflow.current_definition_id,
            "template_context_variables": template_vars,
            "call_disposition_codes": workflow.call_disposition_codes,
            "workflow_configurations": workflow_configs,
            "version_number": active_def.version_number if active_def else None,
            "version_status": active_def.status if active_def else None,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{workflow_id}/duplicate")
async def duplicate_workflow_endpoint(
    workflow_id: int,
    user: UserModel = Depends(get_user),
) -> WorkflowResponse:
    """Duplicate a workflow including its definition, configuration, recordings, and triggers."""
    try:
        workflow = await duplicate_workflow(
            workflow_id=workflow_id,
            organization_id=user.selected_organization_id,
            user_id=user.id,
        )

        capture_event(
            distinct_id=str(user.provider_id),
            event=PostHogEvent.WORKFLOW_DUPLICATED,
            properties={
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                "source_workflow_id": workflow_id,
                "organization_id": user.selected_organization_id,
            },
        )

        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status,
            "created_at": workflow.created_at,
            "workflow_definition": mask_workflow_definition(
                workflow.released_definition.workflow_json
            ),
            "current_definition_id": workflow.current_definition_id,
            "template_context_variables": workflow.template_context_variables,
            "call_disposition_codes": workflow.call_disposition_codes,
            "workflow_configurations": workflow.workflow_configurations,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error duplicating workflow {workflow_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{workflow_id}/runs")
async def create_workflow_run(
    workflow_id: int,
    request: CreateWorkflowRunRequest,
    user: UserModel = Depends(get_user),
) -> CreateWorkflowRunResponse:
    """
    Create a new workflow run when the user decides to execute the workflow via chat or voice

    Args:
        workflow_id: The ID of the workflow to run
        request: The create workflow run request
        user: The user to create the workflow run for
    """
    run = await db_client.create_workflow_run(
        request.name, workflow_id, request.mode, user.id, use_draft=True
    )
    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "name": run.name,
        "mode": run.mode,
        "created_at": run.created_at,
        "definition_id": run.definition_id,
        "initial_context": run.initial_context,
        "gathered_context": run.gathered_context,
    }


@router.get("/{workflow_id}/runs/{run_id}")
async def get_workflow_run(
    workflow_id: int, run_id: int, user: UserModel = Depends(get_user)
) -> WorkflowRunResponseSchema:
    run = await db_client.get_workflow_run(
        run_id, organization_id=user.selected_organization_id
    )
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "name": run.name,
        "mode": run.mode,
        "is_completed": run.is_completed,
        "transcript_url": run.transcript_url,
        "recording_url": run.recording_url,
        "cost_info": {
            "dograh_token_usage": (
                run.cost_info.get("dograh_token_usage")
                if run.cost_info and "dograh_token_usage" in run.cost_info
                else round(float(run.cost_info.get("total_cost_usd", 0)) * 100, 2)
                if run.cost_info and "total_cost_usd" in run.cost_info
                else 0
            ),
            "call_duration_seconds": int(
                round(run.cost_info.get("call_duration_seconds"))
            )
            if run.cost_info and run.cost_info.get("call_duration_seconds") is not None
            else None,
        }
        if run.cost_info
        else None,
        "created_at": run.created_at,
        "definition_id": run.definition_id,
        "initial_context": run.initial_context,
        "gathered_context": run.gathered_context,
        "call_type": run.call_type,
        "logs": run.logs,
        "annotations": run.annotations,
    }


class WorkflowRunsResponse(BaseModel):
    runs: List[WorkflowRunResponseSchema]
    total_count: int
    page: int
    limit: int
    total_pages: int
    applied_filters: Optional[List[dict]] = None


@router.get("/{workflow_id}/runs")
async def get_workflow_runs(
    workflow_id: int,
    page: int = 1,
    limit: int = 50,
    filters: Optional[str] = Query(None, description="JSON-encoded filter criteria"),
    sort_by: Optional[str] = Query(
        None, description="Field to sort by (e.g., 'duration', 'created_at')"
    ),
    sort_order: Optional[str] = Query(
        "desc", description="Sort order ('asc' or 'desc')"
    ),
    user: UserModel = Depends(get_user),
) -> WorkflowRunsResponse:
    """
    Get workflow runs with optional filtering and sorting.

    Filters should be provided as a JSON-encoded array of filter criteria.
    Example: [{"attribute": "dateRange", "value": {"from": "2024-01-01", "to": "2024-01-31"}}]
    """
    offset = (page - 1) * limit

    # Parse filters if provided
    filter_criteria = []
    if filters:
        try:
            filter_criteria = json.loads(filters)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid filter format")

        # Restrict allowed filter attributes for regular users
        allowed_attributes = {
            "dateRange",
            "dispositionCode",
            "duration",
            "status",
            "tokenUsage",
        }
        for filter_item in filter_criteria:
            attribute = filter_item.get("attribute")
            if attribute and attribute not in allowed_attributes:
                raise HTTPException(
                    status_code=403, detail=f"Invalid attribute '{attribute}'"
                )

    runs, total_count = await db_client.get_workflow_runs_by_workflow_id(
        workflow_id,
        organization_id=user.selected_organization_id,
        limit=limit,
        offset=offset,
        filters=filter_criteria if filter_criteria else None,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    total_pages = (total_count + limit - 1) // limit

    return WorkflowRunsResponse(
        runs=runs,
        total_count=total_count,
        page=page,
        limit=limit,
        total_pages=total_pages,
        applied_filters=filter_criteria if filter_criteria else None,
    )


@router.get("/{workflow_id}/usage/weekly-rollup", response_model=WeeklyRollupResponse)
async def get_workflow_weekly_usage_rollup(
    workflow_id: int,
    weeks: int = Query(8, ge=1, le=52, description="Look back up to this many weeks (ignored if since+until set)"),
    since: Optional[date] = Query(
        None,
        description="UTC start date inclusive (YYYY-MM-DD); requires until",
    ),
    until: Optional[date] = Query(
        None,
        description="UTC end date inclusive (YYYY-MM-DD); requires since",
    ),
    user: UserModel = Depends(get_user),
):
    """Server-side UTC week aggregates for a single workflow (org-scoped)."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )
    try:
        rs, rue, _use_fixed = parse_utc_inclusive_date_range(since, until)
        raw = await db_client.get_weekly_usage_rollup(
            user.selected_organization_id,
            weeks=weeks,
            workflow_id=workflow_id,
            range_since=rs,
            range_until_exclusive=rue,
        )
        buckets = [
            WeeklyRollupBucket(
                week_start=r["week_start"],
                run_count=r["run_count"],
                runs_inbound=int(r.get("runs_inbound") or 0),
                runs_outbound=int(r.get("runs_outbound") or 0),
                dograh_tokens=r.get("dograh_tokens"),
            )
            for r in raw
        ]
        return WeeklyRollupResponse(buckets=buckets)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_workflow_weekly_usage_rollup failed: {}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workflow_id}/usage/daily-rollup", response_model=DailyRollupResponse)
async def get_workflow_daily_usage_rollup(
    workflow_id: int,
    days: int = Query(30, ge=1, le=90, description="Rolling lookback in days (ignored if since+until set)"),
    since: Optional[date] = Query(
        None,
        description="UTC start date inclusive (YYYY-MM-DD); requires until",
    ),
    until: Optional[date] = Query(
        None,
        description="UTC end date inclusive (YYYY-MM-DD); requires since",
    ),
    user: UserModel = Depends(get_user),
):
    """Server-side UTC **day** aggregates for a single workflow (org-scoped)."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )
    try:
        rs, rue, _use_fixed = parse_utc_inclusive_date_range(since, until)
        raw = await db_client.get_daily_usage_rollup(
            user.selected_organization_id,
            days=days,
            workflow_id=workflow_id,
            range_since=rs,
            range_until_exclusive=rue,
        )
        buckets = [
            DailyRollupBucket(
                day_start=r["day_start"],
                run_count=r["run_count"],
                runs_inbound=int(r.get("runs_inbound") or 0),
                runs_outbound=int(r.get("runs_outbound") or 0),
                dograh_tokens=r.get("dograh_tokens"),
            )
            for r in raw
        ]
        return DailyRollupResponse(buckets=buckets)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_workflow_daily_usage_rollup failed: {}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workflow_id}/report")
async def download_workflow_report(
    workflow_id: int,
    user: UserModel = Depends(get_user),
    start_date: Optional[datetime] = Query(
        None, description="Filter runs created on or after this datetime (ISO 8601)"
    ),
    end_date: Optional[datetime] = Query(
        None, description="Filter runs created on or before this datetime (ISO 8601)"
    ),
) -> StreamingResponse:
    """Download a CSV report of completed runs for a workflow."""
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(
            status_code=404, detail=f"Workflow with id {workflow_id} not found"
        )

    output, filename = await generate_workflow_report_csv(
        workflow_id, start_date=start_date, end_date=end_date
    )

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _catalog_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_vertical_packs_dict() -> dict:
    path = _catalog_repo_root() / "catalog" / "vertical-packs.json"
    if not path.is_file():
        raise HTTPException(
            status_code=500, detail="Catalog file not found on server"
        )
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _load_packaged_workflow_json(filename: str) -> dict:
    safe_name = Path(filename).name
    path = _catalog_repo_root() / "catalog" / "packaged-workflows" / safe_name
    if not path.is_file():
        raise HTTPException(
            status_code=404, detail=f"Packaged workflow file not found: {safe_name}"
        )
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@router.post("/install-from-catalog")
async def install_workflow_from_catalog(
    request: InstallFromCatalogRequest,
    user: UserModel = Depends(get_user),
) -> WorkflowResponse:
    """Create a workflow in the caller's org from a catalog pack (packaged graph + defaults)."""
    catalog = _load_vertical_packs_dict()
    pack = next(
        (p for p in catalog.get("packs", []) if p.get("slug") == request.slug),
        None,
    )
    if not pack:
        raise HTTPException(status_code=404, detail="Unknown catalog slug")

    wt = pack.get("workflow_template") or {}
    default_vars = dict(pack.get("default_template_variables") or {})
    if ENABLE_LOCAL_SCHEDULING and "scheduling_api_base_url" in default_vars:
        default_vars["scheduling_api_base_url"] = (
            f"{BACKEND_API_ENDPOINT.rstrip('/')}/api/v1/local-scheduling"
        )
    if ENABLE_LOCAL_PAYMENTS and "collections_api_base_url" in default_vars:
        default_vars["collections_api_base_url"] = (
            f"{BACKEND_API_ENDPOINT.rstrip('/')}/api/v1/local-payments"
        )

    if wt.get("source") == "packaged_definition" and wt.get("packaged_definition_ref"):
        try:
            packaged_name, catalog_variant_id = resolve_packaged_definition_ref(
                pack,
                template_packaged_ref=wt["packaged_definition_ref"],
                variant_id=request.variant_id,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        workflow_def = _load_packaged_workflow_json(packaged_name)
        workflow_def = regenerate_trigger_uuids(workflow_def)
        mk01 = {
            "installation_locked": True,
            "catalog_slug": pack["slug"],
            "source": "packaged_definition",
        }
        if catalog_variant_id:
            mk01["catalog_variant_id"] = catalog_variant_id
        workflow_configurations: dict[str, Any] = {"mk01": mk01}
        from api.services.voice.vertical_presets import (
            recommended_voice_profile_id_for_catalog_slug,
        )

        voice_profile_id = pack.get("recommended_voice_profile_id") or (
            recommended_voice_profile_id_for_catalog_slug(pack["slug"])
        )
        if voice_profile_id:
            workflow_configurations["voice_profile_id"] = voice_profile_id
        if ENABLE_LOCAL_SCHEDULING and "scheduling_api_base_url" in (
            pack.get("default_template_variables") or {}
        ):
            workflow_configurations["local_scheduling"] = {
                "enabled": True,
                "scheduling_api_base_url": default_vars["scheduling_api_base_url"],
                "book_url": f"{default_vars['scheduling_api_base_url']}/api/v1/appointments",
            }
        if ENABLE_LOCAL_PAYMENTS and "collections_api_base_url" in (
            pack.get("default_template_variables") or {}
        ):
            workflow_configurations["local_payments"] = {
                "enabled": True,
                "collections_api_base_url": default_vars["collections_api_base_url"],
                "payment_promises_url": (
                    f"{default_vars['collections_api_base_url']}/api/v1/payment-promises"
                ),
            }
        workflow = await db_client.create_workflow(
            request.workflow_name,
            workflow_def,
            user.id,
            user.selected_organization_id,
            template_context_variables=default_vars,
            workflow_configurations=workflow_configurations,
        )
        if workflow_def:
            trigger_paths = extract_trigger_paths(workflow_def)
            if trigger_paths:
                await db_client.sync_triggers_for_workflow(
                    workflow_id=workflow.id,
                    organization_id=user.selected_organization_id,
                    trigger_paths=trigger_paths,
                )
        ph_props = {
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "source": "catalog_pack",
            "catalog_slug": pack["slug"],
            "organization_id": user.selected_organization_id,
        }
        if catalog_variant_id:
            ph_props["catalog_variant_id"] = catalog_variant_id
        capture_event(
            distinct_id=str(user.provider_id),
            event=PostHogEvent.WORKFLOW_CREATED,
            properties=ph_props,
        )
        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status,
            "created_at": workflow.created_at,
            "workflow_definition": mask_workflow_definition(workflow_def),
            "current_definition_id": workflow.current_definition_id,
            "template_context_variables": workflow.template_context_variables,
            "call_disposition_codes": workflow.call_disposition_codes,
            "workflow_configurations": workflow.workflow_configurations,
        }

    if wt.get("source") == "workflow_templates" and wt.get("template_name"):
        template_client = WorkflowTemplateClient()
        template = await template_client.get_workflow_template_by_name(
            wt["template_name"]
        )
        if not template:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow template not found: {wt['template_name']}",
            )
        workflow_def = regenerate_trigger_uuids(template.template_json)
        mk01 = {
            "installation_locked": True,
            "catalog_slug": pack["slug"],
            "source": "workflow_templates",
            "source_template_id": template.id,
        }
        workflow_configurations: dict[str, Any] = {"mk01": mk01}
        if ENABLE_LOCAL_SCHEDULING and "scheduling_api_base_url" in (
            pack.get("default_template_variables") or {}
        ):
            workflow_configurations["local_scheduling"] = {
                "enabled": True,
                "scheduling_api_base_url": default_vars["scheduling_api_base_url"],
                "book_url": f"{default_vars['scheduling_api_base_url']}/api/v1/appointments",
            }
        if ENABLE_LOCAL_PAYMENTS and "collections_api_base_url" in (
            pack.get("default_template_variables") or {}
        ):
            workflow_configurations["local_payments"] = {
                "enabled": True,
                "collections_api_base_url": default_vars["collections_api_base_url"],
                "payment_promises_url": (
                    f"{default_vars['collections_api_base_url']}/api/v1/payment-promises"
                ),
            }
        workflow = await db_client.create_workflow(
            request.workflow_name,
            workflow_def,
            user.id,
            user.selected_organization_id,
            template_context_variables=default_vars,
            workflow_configurations=workflow_configurations,
        )
        if workflow_def:
            trigger_paths = extract_trigger_paths(workflow_def)
            if trigger_paths:
                await db_client.sync_triggers_for_workflow(
                    workflow_id=workflow.id,
                    organization_id=user.selected_organization_id,
                    trigger_paths=trigger_paths,
                )
        capture_event(
            distinct_id=str(user.provider_id),
            event=PostHogEvent.WORKFLOW_CREATED,
            properties={
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                "source": "catalog_pack",
                "catalog_slug": pack["slug"],
                "organization_id": user.selected_organization_id,
            },
        )
        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status,
            "created_at": workflow.created_at,
            "workflow_definition": mask_workflow_definition(workflow_def),
            "current_definition_id": workflow.current_definition_id,
            "template_context_variables": workflow.template_context_variables,
            "call_disposition_codes": workflow.call_disposition_codes,
            "workflow_configurations": workflow.workflow_configurations,
        }

    raise HTTPException(
        status_code=400,
        detail="This catalog pack is not installable (missing packaged_definition or template_name)",
    )


@router.get("/templates")
async def get_workflow_templates() -> List[WorkflowTemplateResponse]:
    """
    Get all available workflow templates.

    Returns:
        List of workflow templates
    """
    template_client = WorkflowTemplateClient()
    templates = await template_client.get_all_workflow_templates()

    return [
        {
            "id": template.id,
            "template_name": template.template_name,
            "template_description": template.template_description,
            "template_json": template.template_json,
            "created_at": template.created_at,
        }
        for template in templates
    ]


@router.post("/templates/duplicate")
async def duplicate_workflow_template(
    request: DuplicateTemplateRequest, user: UserModel = Depends(get_user)
) -> WorkflowResponse:
    """
    Duplicate a workflow template to create a new workflow for the user.

    Args:
        request: The duplicate template request
        user: The authenticated user

    Returns:
        The newly created workflow
    """
    template_client = WorkflowTemplateClient()
    template = await template_client.get_workflow_template(request.template_id)

    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow template with id {request.template_id} not found",
        )

    # Create a new workflow from the template
    # Regenerate trigger UUIDs to avoid conflicts with existing triggers
    workflow_def = regenerate_trigger_uuids(template.template_json)
    mk01 = {
        "installation_locked": request.lock_until_customize,
        "source_template_id": template.id,
    }
    if request.catalog_slug:
        mk01["catalog_slug"] = request.catalog_slug
    workflow = await db_client.create_workflow(
        request.workflow_name,
        workflow_def,
        user.id,
        user.selected_organization_id,
        template_context_variables=request.template_context_variables or {},
        workflow_configurations={"mk01": mk01},
    )

    # Sync agent triggers if template contains any
    if workflow_def:
        trigger_paths = extract_trigger_paths(workflow_def)
        if trigger_paths:
            await db_client.sync_triggers_for_workflow(
                workflow_id=workflow.id,
                organization_id=user.selected_organization_id,
                trigger_paths=trigger_paths,
            )

    return {
        "id": workflow.id,
        "name": workflow.name,
        "status": workflow.status,
        "created_at": workflow.created_at,
        "workflow_definition": mask_workflow_definition(workflow_def),
        "current_definition_id": workflow.current_definition_id,
        "template_context_variables": workflow.template_context_variables,
        "call_disposition_codes": workflow.call_disposition_codes,
        "workflow_configurations": workflow.workflow_configurations,
    }


# ---------------------------------------------------------------------------
# WE-01-HEADER — cost / token dry-run (no live call)
# ---------------------------------------------------------------------------


@router.get(
    "/{workflow_id}/estimate-cost",
    response_model=WorkflowCostDryRunResult,
    summary="Heuristic cost and Dograh token estimate (dry-run)",
)
async def workflow_estimate_cost(
    workflow_id: int,
    user: UserModel = Depends(get_user),
) -> WorkflowCostDryRunResult:
    """Rough pricing from draft (or released) graph + user model settings; not a live meter reading."""
    workflow = await db_client.get_workflow(
        workflow_id, organization_id=user.selected_organization_id
    )
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    draft = await db_client.get_draft_version(workflow_id)
    workflow_definition: dict | None = None
    version_configurations: dict | None = None

    if draft and draft.workflow_json:
        workflow_definition = draft.workflow_json
        version_configurations = draft.workflow_configurations
    elif workflow.released_definition and workflow.released_definition.workflow_json:
        workflow_definition = workflow.released_definition.workflow_json
        version_configurations = workflow.released_definition.workflow_configurations
    else:
        raise HTTPException(
            status_code=400,
            detail="No workflow graph found — save the workflow in the editor first.",
        )

    try:
        WorkflowGraph(ReactFlowDTO.model_validate(workflow_definition))
    except ValueError as e:
        logger.warning(f"estimate-cost: invalid workflow graph: {e}")
        raise HTTPException(
            status_code=422,
            detail="Workflow graph is invalid — fix validation in the editor first.",
        ) from e

    user_config = await db_client.get_user_configurations(user.id)
    merged_configurations: dict = dict(workflow.workflow_configurations or {})
    if version_configurations:
        merged_configurations = {**merged_configurations, **version_configurations}

    return estimate_workflow_cost_dry_run(
        workflow_json=workflow_definition,
        workflow_configurations=merged_configurations,
        user_config=user_config,
    )


# ---------------------------------------------------------------------------
# Editor simulation — text turn (WE-01-TEST)
# ---------------------------------------------------------------------------


@router.post(
    "/{workflow_id}/simulation/text-turn",
    response_model=SimulationTextTurnResponse,
    summary="Text-only LLM turn using draft graph (editor simulation)",
)
async def workflow_simulation_text_turn(
    workflow_id: int,
    body: SimulationTextTurnRequest,
    user: UserModel = Depends(get_user),
) -> SimulationTextTurnResponse:
    """Run one chat turn against the first Agent after Start — uses org LLM keys; no PSTN."""
    return await run_simulation_text_turn(
        workflow_id=workflow_id,
        user_id=user.id,
        organization_id=user.selected_organization_id,
        body=body,
    )


# ---------------------------------------------------------------------------
# Ambient Noise Upload
# ---------------------------------------------------------------------------


class AmbientNoiseUploadRequest(BaseModel):
    workflow_id: int
    filename: str
    mime_type: str = "audio/wav"
    file_size: int = Field(..., gt=0, le=10_485_760, description="Max 10MB")


class AmbientNoiseUploadResponse(BaseModel):
    upload_url: str
    storage_key: str
    storage_backend: str


@router.post(
    "/ambient-noise/upload-url",
    response_model=AmbientNoiseUploadResponse,
    summary="Get a presigned URL to upload a custom ambient noise audio file",
)
async def get_ambient_noise_upload_url(
    request: AmbientNoiseUploadRequest,
    user=Depends(get_user),
):
    """Generate a presigned PUT URL for uploading a custom ambient noise file."""
    # Verify user owns this workflow
    workflow = await db_client.get_workflow(
        request.workflow_id, organization_id=user.selected_organization_id
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    sanitized = re.sub(r"[^a-zA-Z0-9._-]", "_", request.filename)
    storage_key = (
        f"ambient-noise/{user.selected_organization_id}"
        f"/{request.workflow_id}/{uuid.uuid4()}_{sanitized}"
    )

    upload_url = await storage_fs.aget_presigned_put_url(
        file_path=storage_key,
        expiration=1800,
        content_type=request.mime_type,
        max_size=request.file_size,
    )
    if not upload_url:
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")

    return AmbientNoiseUploadResponse(
        upload_url=upload_url,
        storage_key=storage_key,
        storage_backend=StorageBackend.get_current_backend().value,
    )
