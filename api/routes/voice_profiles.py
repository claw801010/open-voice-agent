"""Org voice delivery profiles — built-in presets, custom profiles, clone, default."""

from fastapi import APIRouter, Depends, HTTPException

from api.db import db_client
from api.db.models import UserModel
from api.enums import OrganizationConfigurationKey
from api.db import db_client
from api.schemas.voice_profile import (
    SetDefaultVoiceProfileBody,
    VoiceProfileCloneBody,
    VoiceProfileCreateBody,
    VoiceProfileListResponse,
    VoiceProfilePreviewBody,
    VoiceProfilePreviewResponse,
    VoiceProfileResponse,
    VoiceProfileUpdateBody,
)
from api.services.auth.depends import get_user
from api.services.voice.profile_preview import build_voice_profile_preview
from api.services.voice.voice_profiles import (
    clone_profile,
    create_custom_profile,
    delete_custom_profile,
    get_profile,
    list_all_profiles,
    normalize_org_document,
    set_default_profile_id,
    update_custom_profile,
)

router = APIRouter(prefix="/voice-profiles", tags=["voice-profiles"])


def _require_org(user: UserModel) -> int:
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    return user.selected_organization_id


async def _load_org_document(org_id: int) -> dict:
    raw = await db_client.get_configuration_value(
        org_id,
        OrganizationConfigurationKey.VOICE_PROFILES.value,
        default=None,
    )
    return normalize_org_document(raw)


async def _save_org_document(org_id: int, doc: dict) -> None:
    await db_client.upsert_configuration(
        org_id,
        OrganizationConfigurationKey.VOICE_PROFILES.value,
        doc,
    )


@router.get("", response_model=VoiceProfileListResponse)
async def list_voice_profiles(user: UserModel = Depends(get_user)):
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    data = list_all_profiles(doc)
    return VoiceProfileListResponse(**data)


@router.put("/org-default", response_model=VoiceProfileListResponse)
async def set_default_voice_profile(
    body: SetDefaultVoiceProfileBody,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    try:
        doc = set_default_profile_id(doc, body.profile_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    await _save_org_document(org_id, doc)
    data = list_all_profiles(doc)
    return VoiceProfileListResponse(**data)


@router.get("/{profile_id}", response_model=VoiceProfileResponse)
async def get_voice_profile(profile_id: str, user: UserModel = Depends(get_user)):
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    profile = get_profile(doc, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    return VoiceProfileResponse(**profile)


@router.post("/{profile_id}/preview", response_model=VoiceProfilePreviewResponse)
async def preview_voice_profile(
    profile_id: str,
    body: VoiceProfilePreviewBody,
    user: UserModel = Depends(get_user),
):
    """MK-01 depth: industry sample script; optional ElevenLabs MP3 when user TTS is configured."""
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    profile = get_profile(doc, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    user_config = await db_client.get_user_configurations(user.id)
    data = await build_voice_profile_preview(
        profile,
        user_config,
        override_text=body.text,
        include_audio=body.include_audio,
    )
    return VoiceProfilePreviewResponse(**data)


@router.post("", response_model=VoiceProfileResponse, status_code=201)
async def create_voice_profile(
    body: VoiceProfileCreateBody,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    try:
        doc, profile = create_custom_profile(
            doc,
            name=body.name,
            description=body.description,
            tts_overrides=body.tts_overrides,
            speech_settings=body.speech_settings,
            tags=body.tags,
            clone_from_profile_id=body.clone_from_profile_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    await _save_org_document(org_id, doc)
    return VoiceProfileResponse(**profile)


@router.post("/{profile_id}/clone", response_model=VoiceProfileResponse, status_code=201)
async def clone_voice_profile(
    profile_id: str,
    body: VoiceProfileCloneBody,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    try:
        doc, profile = clone_profile(
            doc,
            profile_id,
            name=body.name,
            description=body.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    await _save_org_document(org_id, doc)
    return VoiceProfileResponse(**profile)


@router.put("/{profile_id}", response_model=VoiceProfileResponse)
async def update_voice_profile(
    profile_id: str,
    body: VoiceProfileUpdateBody,
    user: UserModel = Depends(get_user),
):
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    try:
        doc, profile = update_custom_profile(
            doc,
            profile_id,
            name=body.name,
            description=body.description,
            tts_overrides=body.tts_overrides,
            speech_settings=body.speech_settings,
            tags=body.tags,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    await _save_org_document(org_id, doc)
    return VoiceProfileResponse(**profile)


@router.delete("/{profile_id}", status_code=204)
async def delete_voice_profile(profile_id: str, user: UserModel = Depends(get_user)):
    org_id = _require_org(user)
    doc = await _load_org_document(org_id)
    try:
        doc = delete_custom_profile(doc, profile_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    await _save_org_document(org_id, doc)

