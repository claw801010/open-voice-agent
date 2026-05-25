"""Read-only catalog endpoints for vertical workflow packs (MK-01)."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from api.schemas.voice_profile import CatalogVoicePreviewResponse
from api.services.voice.presets import get_builtin_profile
from api.services.voice.profile_preview import build_catalog_voice_preview
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
        return json.load(f)


@router.get("/vertical-packs/{slug}/voice-preview", response_model=CatalogVoicePreviewResponse)
async def get_vertical_pack_voice_preview(slug: str):
    """MK-01 depth: industry sample script + recommended voice profile (no auth)."""
    path = _repo_root() / "catalog" / "vertical-packs.json"
    if not path.is_file():
        raise HTTPException(status_code=500, detail="Catalog file not found on server")
    with path.open(encoding="utf-8") as f:
        catalog = json.load(f)
    pack = next((p for p in catalog.get("packs", []) if p.get("slug") == slug), None)
    if not pack:
        raise HTTPException(status_code=404, detail="Unknown catalog slug")
    profile_id = pack.get("recommended_voice_profile_id") or (
        recommended_voice_profile_id_for_catalog_slug(slug)
    )
    if not profile_id:
        raise HTTPException(status_code=404, detail="No voice profile for slug")
    profile = get_builtin_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    data = build_catalog_voice_preview(slug, profile)
    return CatalogVoicePreviewResponse(**data)
