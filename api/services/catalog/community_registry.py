"""Unified community catalog registry — public browse + future monetization (MK-01-REGISTRY)."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]
_REGISTRY_PATH = _REPO_ROOT / "catalog" / "community-registry.json"
_DISTRIBUTION_PATH = _REPO_ROOT / "catalog" / "community-registry-distribution.json"

LISTING_TYPES = frozenset(
    {
        "vertical_pack",
        "workflow_variant",
        "capability_module",
        "tool_stub",
        "native_tool_template",
        "prompt_pack",
        "recipe",
        "best_practice",
        "inference_profile",
        "governance_policy",
        "skill_import",
    }
)

TIER_ORDER = ("free", "community", "starter", "pro", "enterprise")


class CommunityRegistryError(Exception):
    pass


@lru_cache(maxsize=1)
def load_community_registry() -> dict[str, Any]:
    if not _REGISTRY_PATH.is_file():
        raise CommunityRegistryError(
            f"Missing {_REGISTRY_PATH.name}; run scripts/build_community_catalog.py"
        )
    with _REGISTRY_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    listings = data.get("listings")
    if not isinstance(listings, list):
        raise CommunityRegistryError("community-registry.json: listings must be a list")
    return data


@lru_cache(maxsize=1)
def load_distribution_config() -> dict[str, Any]:
    if not _DISTRIBUTION_PATH.is_file():
        return {}
    with _DISTRIBUTION_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def listing_by_id(listing_id: str) -> dict[str, Any] | None:
    for row in load_community_registry().get("listings") or []:
        if isinstance(row, dict) and row.get("id") == listing_id:
            return row
    return None


def _normalize_query(q: str | None) -> str:
    return re.sub(r"\s+", " ", (q or "").strip().lower())


def _listing_matches(
    row: dict[str, Any],
    *,
    listing_type: str | None,
    tier: str | None,
    tag: str | None,
    vertical_slug: str | None,
    q: str | None,
) -> bool:
    if listing_type and row.get("type") != listing_type:
        return False
    dist = row.get("distribution") or {}
    if tier and dist.get("tier") != tier:
        return False
    tags = {str(t).lower() for t in (row.get("tags") or [])}
    if tag and tag.lower() not in tags:
        return False
    verticals = {str(v) for v in (row.get("vertical_slugs") or [])}
    if vertical_slug and vertical_slug not in verticals:
        return False
    needle = _normalize_query(q)
    if needle:
        hay = " ".join(
            str(row.get(k) or "")
            for k in ("id", "type", "title", "summary")
        ).lower()
        hay += " " + " ".join(tags)
        if needle not in hay:
            return False
    return True


def list_registry_listings(
    *,
    listing_type: str | None = None,
    tier: str | None = None,
    tag: str | None = None,
    vertical_slug: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    raw = load_community_registry()
    rows = [
        r
        for r in raw.get("listings") or []
        if isinstance(r, dict)
        and _listing_matches(
            r,
            listing_type=listing_type,
            tier=tier,
            tag=tag,
            vertical_slug=vertical_slug,
            q=q,
        )
    ]
    rows.sort(key=lambda r: (TIER_ORDER.index(str((r.get("distribution") or {}).get("tier", "free")))
                             if str((r.get("distribution") or {}).get("tier", "free")) in TIER_ORDER
                             else 99,
                             str(r.get("title") or r.get("id") or "")))
    total = len(rows)
    page = rows[max(0, offset) : max(0, offset) + min(max(1, limit), 500)]
    return {
        "registry_version": raw.get("registry_version", 1),
        "generated_at": raw.get("generated_at"),
        "total": total,
        "limit": limit,
        "offset": offset,
        "listing_types": sorted(LISTING_TYPES),
        "publishers": raw.get("publishers") or [],
        "listings": page,
    }


def export_registry_bundle() -> dict[str, Any]:
    """Full registry JSON for CDN / community mirror export."""
    data = load_community_registry()
    return {
        **data,
        "export_format": "dograh-community-registry-v1",
        "listing_count": len(data.get("listings") or []),
    }
