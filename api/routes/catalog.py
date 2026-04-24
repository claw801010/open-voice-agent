"""Read-only catalog endpoints for vertical workflow packs (MK-01)."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

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
