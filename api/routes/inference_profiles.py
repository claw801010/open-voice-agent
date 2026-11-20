"""Inference profile catalog — quick switch between cloud, local edge, and hybrid stacks."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.db import db_client
from api.db.models import UserModel
from api.routes.user import UserConfigurationRequestResponseSchema
from api.services.auth.depends import get_user
from api.services.configuration.inference_profiles import (
    DEFAULT_INFERENCE_PROFILE_ID,
    InferenceProfileError,
    apply_inference_profile,
    detect_active_profile_id,
    list_inference_profile_summaries,
)
from api.services.configuration.local_inference import (
    inference_setup_allowed,
    run_local_inference_setup,
    scan_local_inference_capabilities,
)
from api.services.configuration.masking import mask_user_config
from api.services.configuration.oob_defaults import (
    ensure_oob_user_configuration,
    is_user_configuration_unset,
    prefer_local_oob_defaults,
)

router = APIRouter(prefix="/inference-profiles", tags=["inference-profiles"])


class InferenceProfileSummary(BaseModel):
    id: str
    label: str
    tier: str
    summary: str = ""
    edge_notes: str = ""
    local_models: list[dict] = Field(default_factory=list)
    requires_api_keys: bool = False


class LocalComponentStatus(BaseModel):
    id: str
    label: str
    installed: bool
    reachable: bool
    ready: bool
    models_present: list[str] = Field(default_factory=list)
    models_required: list[str] = Field(default_factory=list)
    endpoint: str = ""
    hint: str = ""


class LocalInferenceCapabilitiesResponse(BaseModel):
    version: int = 1
    default_profile_id: str = DEFAULT_INFERENCE_PROFILE_ID
    local_stack_ready: bool = False
    docker_available: bool = False
    prefer_local_defaults: bool = True
    components: list[LocalComponentStatus] = Field(default_factory=list)


class InferenceProfileListResponse(BaseModel):
    version: int = 1
    profiles: list[InferenceProfileSummary]
    active_profile_id: str | None = None
    default_profile_id: str = DEFAULT_INFERENCE_PROFILE_ID
    capabilities: LocalInferenceCapabilitiesResponse | None = None


class LocalInferenceSetupRequest(BaseModel):
    start_speaches: bool = True
    pull_ollama: bool = True
    apply_profile_id: str | None = DEFAULT_INFERENCE_PROFILE_ID


class LocalInferenceSetupResponse(BaseModel):
    steps: list[dict] = Field(default_factory=list)
    capabilities: LocalInferenceCapabilitiesResponse
    applied_profile_id: str | None = None
    configuration: UserConfigurationRequestResponseSchema | None = None


class ApplyInferenceProfileResponse(BaseModel):
    profile_id: str
    label: str | None = None
    tier: str | None = None
    local_models: list[dict] = Field(default_factory=list)
    configuration: UserConfigurationRequestResponseSchema
    warnings: list[str] = Field(default_factory=list)


def _capabilities_response(raw: dict) -> LocalInferenceCapabilitiesResponse:
    return LocalInferenceCapabilitiesResponse(
        version=raw.get("version", 1),
        default_profile_id=raw.get("default_profile_id", DEFAULT_INFERENCE_PROFILE_ID),
        local_stack_ready=bool(raw.get("local_stack_ready")),
        docker_available=bool(raw.get("docker_available")),
        prefer_local_defaults=prefer_local_oob_defaults(),
        components=[LocalComponentStatus(**c) for c in raw.get("components") or []],
    )


async def _maybe_persist_oob_defaults(user: UserModel):
    existing = await db_client.get_user_configurations(user.id)
    if not is_user_configuration_unset(existing):
        return existing
    oob = ensure_oob_user_configuration(existing)
    if oob.model_dump(exclude_none=True) != existing.model_dump(exclude_none=True):
        return await db_client.update_user_configuration(user.id, oob)
    return existing


@router.get("/capabilities", response_model=LocalInferenceCapabilitiesResponse)
async def get_local_inference_capabilities(
    user: UserModel = Depends(get_user),
) -> LocalInferenceCapabilitiesResponse:
    raw = await scan_local_inference_capabilities()
    return _capabilities_response(raw)


@router.get("", response_model=InferenceProfileListResponse)
async def list_inference_profiles(
    user: UserModel = Depends(get_user),
) -> InferenceProfileListResponse:
    summaries = list_inference_profile_summaries()
    active: str | None = None
    caps_raw = await scan_local_inference_capabilities()
    try:
        existing = await _maybe_persist_oob_defaults(user)
        active = detect_active_profile_id(existing)
    except Exception:
        active = None
    return InferenceProfileListResponse(
        profiles=[InferenceProfileSummary(**s) for s in summaries],
        active_profile_id=active,
        default_profile_id=DEFAULT_INFERENCE_PROFILE_ID,
        capabilities=_capabilities_response(caps_raw),
    )


@router.post("/setup", response_model=LocalInferenceSetupResponse)
async def setup_local_inference(
    request: LocalInferenceSetupRequest,
    user: UserModel = Depends(get_user),
) -> LocalInferenceSetupResponse:
    if not inference_setup_allowed():
        raise HTTPException(
            status_code=403,
            detail="Local inference setup is disabled in this environment.",
        )

    result = await run_local_inference_setup(
        start_speaches=request.start_speaches,
        pull_ollama=request.pull_ollama,
    )
    applied_id: str | None = None
    configuration: UserConfigurationRequestResponseSchema | None = None

    profile_to_apply = request.apply_profile_id or DEFAULT_INFERENCE_PROFILE_ID
    if profile_to_apply:
        existing = await db_client.get_user_configurations(user.id)
        merged, _ = apply_inference_profile(existing, profile_to_apply)
        updated = await db_client.update_user_configuration(user.id, merged)
        applied_id = profile_to_apply
        configuration = UserConfigurationRequestResponseSchema(
            **mask_user_config(updated)
        )

    return LocalInferenceSetupResponse(
        steps=result.get("steps") or [],
        capabilities=_capabilities_response(result["capabilities"]),
        applied_profile_id=applied_id,
        configuration=configuration,
    )


@router.post("/{profile_id}/apply", response_model=ApplyInferenceProfileResponse)
async def apply_inference_profile_route(
    profile_id: str,
    user: UserModel = Depends(get_user),
) -> ApplyInferenceProfileResponse:
    existing = await db_client.get_user_configurations(user.id)
    try:
        merged, meta = apply_inference_profile(existing, profile_id)
    except InferenceProfileError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    warnings: list[str] = []
    try:
        from api.services.configuration.check_validity import UserConfigurationValidator

        validator = UserConfigurationValidator()
        await validator.validate(
            merged,
            organization_id=user.selected_organization_id,
            created_by=user.provider_id,
        )
    except ValueError as e:
        warnings.append(str(e.args[0]) if e.args else str(e))
        if meta.get("tier") == "cloud":
            warnings.append(
                "Cloud profile applied; add API keys under each service tab, then Validate."
            )
        elif meta.get("tier") == "hybrid":
            warnings.append(
                "Hybrid profile applied; ensure OPENAI_API_KEY and local Speaches/Ollama endpoints are up."
            )
        else:
            warnings.append(
                "Local profile applied; run ./scripts/setup_local_inference.sh and start Ollama + Speaches."
            )

    updated = await db_client.update_user_configuration(user.id, merged)
    masked = mask_user_config(updated)

    return ApplyInferenceProfileResponse(
        profile_id=meta["profile_id"],
        label=meta.get("label"),
        tier=meta.get("tier"),
        local_models=meta.get("local_models") or [],
        configuration=UserConfigurationRequestResponseSchema(**masked),
        warnings=warnings,
    )
