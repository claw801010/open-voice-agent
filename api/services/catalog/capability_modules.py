"""Modular capability catalog — composable voice-agent motions (MK-01-CAPABILITY-MODULES)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CATALOG_PATH = _REPO_ROOT / "catalog" / "capability-modules.json"
_VERTICAL_PACKS_PATH = _REPO_ROOT / "catalog" / "vertical-packs.json"


class CapabilityModuleCatalogError(Exception):
    pass


@lru_cache(maxsize=1)
def load_capability_modules_catalog() -> dict[str, Any]:
    if not _CATALOG_PATH.is_file():
        raise CapabilityModuleCatalogError(f"Missing catalog: {_CATALOG_PATH}")
    with _CATALOG_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data.get("modules"), list):
        raise CapabilityModuleCatalogError("capability-modules.json: modules must be a list")
    return data


@lru_cache(maxsize=1)
def _vertical_packs_by_slug() -> dict[str, dict[str, Any]]:
    if not _VERTICAL_PACKS_PATH.is_file():
        return {}
    with _VERTICAL_PACKS_PATH.open(encoding="utf-8") as f:
        catalog = json.load(f)
    return {p["slug"]: p for p in catalog.get("packs", []) if p.get("slug")}


def list_capability_module_summaries() -> list[dict[str, Any]]:
    catalog = load_capability_modules_catalog()
    out: list[dict[str, Any]] = []
    for raw in catalog["modules"]:
        if not isinstance(raw, dict) or not raw.get("id"):
            continue
        out.append(
            {
                "id": raw["id"],
                "label": raw.get("label") or raw["id"],
                "category": raw.get("category") or "other",
                "demand_rank": int(raw.get("demand_rank") or 3),
                "summary": raw.get("summary") or "",
                "typical_http_tools": raw.get("typical_http_tools") or [],
                "template_variable_keys": raw.get("template_variable_keys") or [],
                "pack_ref_count": len(raw.get("pack_refs") or []),
            }
        )
    out.sort(key=lambda m: (-m["demand_rank"], m["label"]))
    return out


def list_capability_categories() -> list[dict[str, Any]]:
    catalog = load_capability_modules_catalog()
    cats = catalog.get("categories") or []
    return [c for c in cats if isinstance(c, dict) and c.get("id")]


def module_ids_for_pack(slug: str) -> list[str]:
    """Module ids that reference this vertical pack (any variant)."""
    ids: list[str] = []
    for raw in load_capability_modules_catalog()["modules"]:
        if not isinstance(raw, dict):
            continue
        mid = raw.get("id")
        if not mid:
            continue
        for ref in raw.get("pack_refs") or []:
            if isinstance(ref, dict) and ref.get("slug") == slug:
                ids.append(str(mid))
                break
    return sorted(set(ids))


def pack_slugs_matching_modules(module_ids: set[str]) -> set[str]:
    """Packs that implement at least one of the given module ids."""
    if not module_ids:
        return set()
    slugs: set[str] = set()
    for raw in load_capability_modules_catalog()["modules"]:
        if not isinstance(raw, dict) or raw.get("id") not in module_ids:
            continue
        for ref in raw.get("pack_refs") or []:
            if isinstance(ref, dict) and ref.get("slug"):
                slugs.add(str(ref["slug"]))
    return slugs


def enrich_vertical_packs_with_modules(packs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach capability_module_ids to each pack for marketplace filtering."""
    out: list[dict[str, Any]] = []
    for pack in packs:
        slug = pack.get("slug")
        enriched = dict(pack)
        if slug:
            enriched["capability_module_ids"] = module_ids_for_pack(str(slug))
        else:
            enriched["capability_module_ids"] = []
        out.append(enriched)
    return out


def _module_index() -> dict[str, dict[str, Any]]:
    return {
        str(m["id"]): m
        for m in load_capability_modules_catalog().get("modules", [])
        if isinstance(m, dict) and m.get("id")
    }


def resolve_install_target_for_modules(module_ids: list[str]) -> dict[str, Any]:
    """
    Pick catalog slug + optional variant_id that best implements the selected capability modules.

    Scores packs by how many selected modules they cover and demand_rank of matching pack_refs;
    prefers complex variants over simple when ties occur.
    """
    selected = sorted({str(m).strip() for m in module_ids if str(m).strip()})
    if not selected:
        raise ValueError("module_ids must not be empty")

    by_id = _module_index()
    unknown = [m for m in selected if m not in by_id]
    if unknown:
        raise ValueError(f"unknown capability module ids: {', '.join(unknown)}")

    packs = _vertical_packs_by_slug()
    selected_set = set(selected)

    slug_scores: dict[str, int] = {}
    variant_scores: dict[tuple[str, str | None], int] = {}

    for mid in selected:
        mod = by_id[mid]
        rank = int(mod.get("demand_rank") or 3)
        slugs_for_mod: set[str] = set()
        for ref in mod.get("pack_refs") or []:
            if not isinstance(ref, dict) or not ref.get("slug"):
                continue
            slug = str(ref["slug"])
            slugs_for_mod.add(slug)
            vid = ref.get("variant_id")
            variant_key = (slug, str(vid) if vid else None)
            variant_scores[variant_key] = variant_scores.get(variant_key, 0) + rank * 2
        for slug in slugs_for_mod:
            slug_scores[slug] = slug_scores.get(slug, 0) + rank + 10

    for slug in pack_slugs_matching_modules(selected_set):
        overlap = len(set(module_ids_for_pack(slug)) & selected_set)
        slug_scores[slug] = slug_scores.get(slug, 0) + overlap * 15

    if not slug_scores:
        raise ValueError("no catalog pack implements the selected modules")

    best_slug = min(slug_scores.keys(), key=lambda s: (-slug_scores[s], s))
    pack = packs.get(best_slug)
    if not pack:
        raise ValueError(f"resolved slug not in vertical catalog: {best_slug!r}")

    best_variant: str | None = None
    candidates = [(vid, sc) for (s, vid), sc in variant_scores.items() if s == best_slug]
    if candidates:

        def _variant_rank(item: tuple[str | None, int]) -> tuple[int, str]:
            vid, score = item
            complexity_bonus = 0
            for v in pack.get("workflow_variants") or []:
                if isinstance(v, dict) and v.get("variant_id") == vid:
                    if v.get("complexity") == "complex":
                        complexity_bonus = 8
                    break
            simple_penalty = -25 if vid == "simple" else 0
            return (score + complexity_bonus + simple_penalty, vid or "")

        best_variant = max(candidates, key=_variant_rank)[0]
        if best_variant == "simple":
            best_variant = None

    variant_label: str | None = None
    if best_variant:
        for v in pack.get("workflow_variants") or []:
            if isinstance(v, dict) and v.get("variant_id") == best_variant:
                variant_label = v.get("label")
                break

    matched = sorted(set(module_ids_for_pack(best_slug)) & selected_set)
    module_labels = [by_id[mid].get("label") or mid for mid in matched if mid in by_id]

    return {
        "slug": best_slug,
        "variant_id": best_variant,
        "display_name": pack.get("display_name") or best_slug,
        "industry": pack.get("industry") or "",
        "variant_label": variant_label,
        "matched_module_ids": matched,
        "matched_module_labels": module_labels,
        "requested_module_ids": selected,
        "coverage_score": len(matched),
    }


def _resolve_variant_for_pack(
    pack: dict[str, Any],
    module_ids: list[str],
    by_id: dict[str, dict[str, Any]],
) -> tuple[str | None, str | None]:
    """Best variant_id (+ label) for a pack given a subset of capability modules."""
    slug = str(pack.get("slug") or "")
    variant_scores: dict[str | None, int] = {}
    for mid in module_ids:
        mod = by_id.get(mid)
        if not mod:
            continue
        rank = int(mod.get("demand_rank") or 3)
        for ref in mod.get("pack_refs") or []:
            if not isinstance(ref, dict) or ref.get("slug") != slug:
                continue
            vid = ref.get("variant_id")
            key = str(vid) if vid else None
            variant_scores[key] = variant_scores.get(key, 0) + rank * 2

    if not variant_scores:
        return None, None

    def _variant_rank(item: tuple[str | None, int]) -> tuple[int, str]:
        vid, score = item
        complexity_bonus = 0
        for v in pack.get("workflow_variants") or []:
            if isinstance(v, dict) and v.get("variant_id") == vid:
                if v.get("complexity") == "complex":
                    complexity_bonus = 8
                break
        simple_penalty = -25 if vid == "simple" else 0
        return (score + complexity_bonus + simple_penalty, vid or "")

    best_variant = max(variant_scores.items(), key=_variant_rank)[0]
    if best_variant == "simple":
        best_variant = None

    variant_label: str | None = None
    if best_variant:
        for v in pack.get("workflow_variants") or []:
            if isinstance(v, dict) and v.get("variant_id") == best_variant:
                variant_label = v.get("label")
                break
    return best_variant, variant_label


def compose_capability_install_plan(module_ids: list[str]) -> dict[str, Any]:
    """
    Multi-pack install plan when selected modules span industries.

    Assigns each module to its strongest pack_ref, groups by slug, and resolves
    a variant per pack. ``primary`` remains the best single-pack match (slice 3).
    """
    selected = sorted({str(m).strip() for m in module_ids if str(m).strip()})
    if not selected:
        raise ValueError("module_ids must not be empty")

    by_id = _module_index()
    unknown = [m for m in selected if m not in by_id]
    if unknown:
        raise ValueError(f"unknown capability module ids: {', '.join(unknown)}")

    packs = _vertical_packs_by_slug()
    primary = resolve_install_target_for_modules(selected)

    unassigned = set(selected)
    pack_to_modules: dict[str, list[str]] = {}
    uncovered: list[str] = []

    while unassigned:
        candidates = [
            slug
            for slug in packs
            if len(unassigned & set(module_ids_for_pack(slug))) > 0
        ]
        if not candidates:
            uncovered = sorted(unassigned)
            break
        best_slug = min(
            candidates,
            key=lambda s: (-len(unassigned & set(module_ids_for_pack(s))), s),
        )
        covered = sorted(unassigned & set(module_ids_for_pack(best_slug)))
        pack_to_modules[best_slug] = covered
        unassigned -= set(covered)

    installs: list[dict[str, Any]] = []
    for slug in sorted(pack_to_modules.keys(), key=lambda s: (-len(pack_to_modules[s]), s)):
        mods = sorted(set(pack_to_modules[slug]))
        pack = packs.get(slug)
        if not pack:
            continue
        variant_id, variant_label = _resolve_variant_for_pack(pack, mods, by_id)
        installs.append(
            {
                "slug": slug,
                "variant_id": variant_id,
                "display_name": pack.get("display_name") or slug,
                "industry": pack.get("industry") or "",
                "variant_label": variant_label,
                "module_ids": mods,
                "module_labels": [by_id[m].get("label") or m for m in mods if m in by_id],
            }
        )

    if not installs:
        raise ValueError("no catalog pack implements the selected modules")

    single_pack_sufficient = len(installs) == 1 and not uncovered

    return {
        "requested_module_ids": selected,
        "single_pack_sufficient": single_pack_sufficient,
        "primary": primary,
        "installs": installs,
        "uncovered_module_ids": sorted(uncovered),
    }


def validate_pack_refs_against_vertical_packs() -> list[str]:
    """Return human-readable errors for invalid pack_refs (for CI)."""
    errors: list[str] = []
    packs = _vertical_packs_by_slug()
    for raw in load_capability_modules_catalog()["modules"]:
        if not isinstance(raw, dict):
            continue
        mid = raw.get("id", "?")
        for ref in raw.get("pack_refs") or []:
            if not isinstance(ref, dict):
                errors.append(f"{mid}: pack_ref must be object")
                continue
            slug = ref.get("slug")
            if not slug:
                errors.append(f"{mid}: pack_ref missing slug")
                continue
            pack = packs.get(slug)
            if not pack:
                errors.append(f"{mid}: unknown slug {slug!r}")
                continue
            vid = ref.get("variant_id")
            if vid:
                variants = {v.get("variant_id") for v in pack.get("workflow_variants") or []}
                if vid not in variants:
                    errors.append(f"{mid}: unknown variant {vid!r} on {slug!r}")
    return errors
