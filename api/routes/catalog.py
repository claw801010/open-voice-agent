"""Read-only catalog endpoints for vertical workflow packs (MK-01)."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from api.schemas.voice_profile import CatalogVoicePreviewResponse
from api.services.voice.presets import get_builtin_profile
from api.services.voice.profile_preview import (
    build_catalog_voice_preview,
    catalog_voice_preview_audio_path,
    hosted_preview_audio_api_path,
    preview_audio_file_available,
)
from api.services.catalog.capability_modules import (
    enrich_vertical_packs_with_modules,
    list_capability_categories,
    list_capability_module_summaries,
    load_capability_modules_catalog,
    resolve_install_target_for_modules,
    compose_capability_install_plan,
)
from api.services.catalog.community_registry import (
    CommunityRegistryError,
    export_registry_bundle,
    list_registry_listings,
    listing_by_id,
)
from api.services.voice.vertical_presets import recommended_voice_profile_id_for_catalog_slug

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


@router.get("/vertical-packs")
async def get_vertical_packs_catalog():
    """Return canonical `catalog/vertical-packs.json` from the repo (same file as docs)."""
    path = _repo_root() / "catalog" / "vertical-packs.json"
    if not path.is_file():
        raise HTTPException(status_code=500, detail="Catalog file not found on server")
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    packs = data.get("packs") or []
    data["packs"] = enrich_vertical_packs_with_modules(packs)
    return data


@router.get("/capability-modules")
async def get_capability_modules_catalog():
    """Return modular capability catalog (MK-01-CAPABILITY-MODULES) with pack cross-refs."""
    try:
        raw = load_capability_modules_catalog()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {
        "catalog_version": raw.get("catalog_version", 1),
        "description": raw.get("description", ""),
        "categories": list_capability_categories(),
        "modules": list_capability_module_summaries(),
        "modules_full": raw.get("modules") or [],
    }


@router.get("/capability-modules/resolve")
async def resolve_capability_modules_install(module_ids: str):
    """
    MK-01-CAPABILITY-MODULES slice 3: preview which vertical pack + variant best matches
    comma-separated capability module ids (no auth).
    """
    ids = [p.strip() for p in (module_ids or "").split(",") if p.strip()]
    try:
        resolution = resolve_install_target_for_modules(ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return resolution


@router.get("/capability-modules/compose-plan")
async def get_capability_modules_compose_plan(module_ids: str):
    """
    MK-01-CAPABILITY-MODULES slice 4: multi-pack plan when capabilities span verticals.
    """
    ids = [p.strip() for p in (module_ids or "").split(",") if p.strip()]
    try:
        plan = compose_capability_install_plan(ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return plan


@router.get("/registry")
async def get_community_registry(
    type: str | None = None,
    tier: str | None = None,
    tag: str | None = None,
    vertical_slug: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    """
    MK-01-REGISTRY: unified public catalog — verticals, capabilities, tools, prompts,
    recipes, inference profiles, and governance policies. No auth required.
    """
    try:
        return list_registry_listings(
            listing_type=type,
            tier=tier,
            tag=tag,
            vertical_slug=vertical_slug,
            q=q,
            limit=limit,
            offset=offset,
        )
    except CommunityRegistryError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/registry/export")
async def export_community_registry():
    """Full registry JSON bundle for CDN / community mirror (no auth)."""
    try:
        return export_registry_bundle()
    except CommunityRegistryError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/registry/{listing_id:path}")
async def get_community_registry_listing(listing_id: str):
    """Single listing detail by stable id (e.g. vertical_pack:barber-beauty-salon-faq)."""
    try:
        row = listing_by_id(listing_id)
    except CommunityRegistryError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Unknown registry listing")
    return row


def _pack_for_slug(slug: str) -> dict:
    path = _repo_root() / "catalog" / "vertical-packs.json"
    if not path.is_file():
        raise HTTPException(status_code=500, detail="Catalog file not found on server")
    with path.open(encoding="utf-8") as f:
        catalog = json.load(f)
    pack = next((p for p in catalog.get("packs", []) if p.get("slug") == slug), None)
    if not pack:
        raise HTTPException(status_code=404, detail="Unknown catalog slug")
    return pack


@router.get("/vertical-packs/{slug}/voice-preview", response_model=CatalogVoicePreviewResponse)
async def get_vertical_pack_voice_preview(slug: str):
    """MK-01 depth: industry sample script + recommended voice profile (no auth)."""
    pack = _pack_for_slug(slug)
    profile_id = pack.get("recommended_voice_profile_id") or (
        recommended_voice_profile_id_for_catalog_slug(slug)
    )
    if not profile_id:
        raise HTTPException(status_code=404, detail="No voice profile for slug")
    profile = get_builtin_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    data = build_catalog_voice_preview(slug, profile)
    if not data.get("preview_audio_url"):
        data["preview_audio_url"] = pack.get("preview_audio_url") or hosted_preview_audio_api_path(slug)
    return CatalogVoicePreviewResponse(**data)


@router.get("/vertical-packs/{slug}/voice-preview/audio")
async def get_vertical_pack_voice_preview_audio(slug: str):
    """MK-01 depth: hosted WAV sample for marketplace cards (no auth)."""
    _pack_for_slug(slug)
    audio_path = catalog_voice_preview_audio_path(slug)
    if not preview_audio_file_available(slug):
        raise HTTPException(status_code=404, detail="Preview audio not available for slug")
    return FileResponse(
        audio_path,
        media_type="audio/wav",
        filename=f"{slug}-voice-preview.wav",
    )
