#!/usr/bin/env python3
"""Build catalog/community-registry.json from existing MK-01 catalog sources.

Run from repo root:
  python scripts/build_community_catalog.py
  python scripts/build_community_catalog.py --check   # CI: fail if stale
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CATALOG = REPO_ROOT / "catalog"
OUT_PATH = CATALOG / "community-registry.json"
DIST_PATH = CATALOG / "community-registry-distribution.json"

NATIVE_TOOL_TEMPLATES = [
    {
        "id": "native_tool_template:http_api",
        "title": "HTTP API tool",
        "summary": "Call external REST APIs with parameters, auth, and response_mapping for analytics.",
    },
    {
        "id": "native_tool_template:end_call",
        "title": "End call tool",
        "summary": "Gracefully end the voice session with optional reason capture.",
    },
    {
        "id": "native_tool_template:transfer_call",
        "title": "Transfer call tool",
        "summary": "Transfer PSTN calls to a human or queue (Twilio).",
    },
    {
        "id": "native_tool_template:calculator",
        "title": "Calculator tool",
        "summary": "Built-in arithmetic for quotes and simple math on calls.",
    },
]

BEST_PRACTICE_DOCS = [
    ("PARTNER_REVIEW.md", "Partner review checklist", "Safety, PII, and telephony compliance before publishing packs."),
    ("TEMPLATE_QUALITY_RUBRIC.md", "Template quality rubric", "Reviewer worksheet for marketplace graph quality."),
    ("CAPABILITY_MODULES.md", "Capability modules guide", "How composable buyer motions map to vertical packs."),
    ("PREBUILD_VERTICAL_ROADMAP.md", "Prebuild vertical roadmap", "Booking and revenue motion gap analysis."),
    ("ANALYTICS_VERTICAL_ROADMAP.md", "Analytics vertical roadmap", "Calls, dashboards, and API companion for verticals."),
    ("VERTICAL_ANALYTICS_HTTP_MATRIX.md", "Vertical analytics HTTP matrix", "Slug ↔ HTTP tools ↔ analytics filters reviewer matrix."),
    ("ANALYTICS_REDACTION_MATRIX.md", "Analytics redaction matrix", "QM / privacy surfaces and RBAC redaction matrix."),
]


def _load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _load_distribution() -> dict:
    if not DIST_PATH.is_file():
        return {}
    return _load_json(DIST_PATH)


def _publisher_default(dist: dict) -> tuple[str, str]:
    pubs = dist.get("publishers") or []
    if pubs and isinstance(pubs[0], dict):
        p = pubs[0]
        return str(p.get("id") or "dograh-oss"), str(p.get("license_spdx") or "MIT")
    return "dograh-oss", "MIT"


def _distribution_for(
    listing_id: str,
    listing_type: str,
    dist_cfg: dict,
    *,
    certification: str = "reviewed",
) -> dict:
    default_tiers = dist_cfg.get("default_tiers") or {}
    default_prices = dist_cfg.get("default_prices_usd_cents") or {}
    overrides = dist_cfg.get("overrides") or {}
    publisher_id, license_spdx = _publisher_default(dist_cfg)

    override = overrides.get(listing_id) if isinstance(overrides, dict) else None
    tier = str((override or {}).get("tier") or default_tiers.get(listing_type) or "free")
    price = (override or {}).get("price_usd_cents")
    if price is None and tier in default_prices:
        price = default_prices[tier]
    cert = str((override or {}).get("certification") or certification)
    return {
        "tier": tier,
        "price_usd_cents": price,
        "currency": "USD",
        "license_spdx": license_spdx,
        "publisher_id": publisher_id,
        "certification": cert,
    }


def _tags_from_pack(pack: dict) -> list[str]:
    tags: list[str] = []
    industry = pack.get("industry")
    if industry:
        tags.append(re.sub(r"[^a-z0-9]+", "_", str(industry).lower()).strip("_"))
    for t in pack.get("compliance_tags") or []:
        tags.append(str(t))
    for m in pack.get("supported_modes") or []:
        tags.append(str(m))
    return sorted(set(tags))


def _extract_prompt_nodes(graph_path: Path) -> list[dict]:
    if not graph_path.is_file():
        return []
    try:
        graph = _load_json(graph_path)
    except (json.JSONDecodeError, OSError):
        return []
    nodes: list[dict] = []
    for node in graph.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        data = node.get("data") or {}
        prompt = (data.get("prompt") or "").strip()
        if not prompt:
            continue
        nodes.append(
            {
                "node_id": node.get("id"),
                "node_type": node.get("type"),
                "name": data.get("name") or node.get("id"),
                "prompt_excerpt": prompt[:500] + ("…" if len(prompt) > 500 else ""),
                "char_count": len(prompt),
            }
        )
    return nodes


def _collect_tool_names(capability_catalog: dict, variant_tools: dict) -> dict[str, set[str]]:
    """tool_name -> set of vertical slugs that reference it."""
    by_tool: dict[str, set[str]] = {}
    for mod in capability_catalog.get("modules") or []:
        if not isinstance(mod, dict):
            continue
        for tool in mod.get("typical_http_tools") or []:
            by_tool.setdefault(str(tool), set())
        for ref in mod.get("pack_refs") or []:
            if isinstance(ref, dict) and ref.get("slug"):
                slug = str(ref["slug"])
                for tool in mod.get("typical_http_tools") or []:
                    by_tool.setdefault(str(tool), set()).add(slug)
    for slug, variants in variant_tools.items():
        if not isinstance(variants, dict):
            continue
        for _vid, tools in variants.items():
            for tool in tools or []:
                by_tool.setdefault(str(tool), set()).add(str(slug))
    return by_tool


def build_registry() -> dict:
    dist_cfg = _load_distribution()
    vertical_catalog = _load_json(CATALOG / "vertical-packs.json")
    capability_catalog = _load_json(CATALOG / "capability-modules.json")
    inference_catalog = _load_json(CATALOG / "inference-profiles.json")
    variant_tools = _load_json(CATALOG / "catalog-variant-http-tools.json")

    listings: list[dict] = []
    publisher_id, _ = _publisher_default(dist_cfg)

    # Vertical packs
    for pack in vertical_catalog.get("packs") or []:
        if not isinstance(pack, dict) or not pack.get("slug"):
            continue
        slug = str(pack["slug"])
        listing_id = f"vertical_pack:{slug}"
        wf_ref = (pack.get("workflow_template") or {}).get("packaged_definition_ref")
        graph_path = CATALOG / "packaged-workflows" / str(wf_ref) if wf_ref else None
        listings.append(
            {
                "id": listing_id,
                "type": "vertical_pack",
                "title": pack.get("display_name") or slug,
                "summary": pack.get("summary") or "",
                "tags": _tags_from_pack(pack),
                "vertical_slugs": [slug],
                "source_ref": f"catalog/vertical-packs.json#{slug}",
                "distribution": _distribution_for(listing_id, "vertical_pack", dist_cfg),
                "quality": {
                    "pack_semver": pack.get("pack_semver"),
                    "compliance_tags": pack.get("compliance_tags") or [],
                    "certification": _distribution_for(listing_id, "vertical_pack", dist_cfg)[
                        "certification"
                    ],
                },
                "install": {
                    "method": "catalog",
                    "endpoint": "/api/v1/workflow/install-from-catalog",
                    "slug": slug,
                    "variant_id": None,
                },
                "assets": {
                    "runbook_path": pack.get("runbook_path"),
                    "packaged_definition_ref": wf_ref,
                    "prompt_nodes": _extract_prompt_nodes(graph_path) if graph_path else [],
                },
            }
        )

        # Workflow variants
        for variant in pack.get("workflow_variants") or []:
            if not isinstance(variant, dict) or not variant.get("variant_id"):
                continue
            vid = str(variant["variant_id"])
            var_id = f"workflow_variant:{slug}:{vid}"
            vref = variant.get("packaged_definition_ref")
            vpath = CATALOG / "packaged-workflows" / str(vref) if vref else None
            tools = (variant_tools.get(slug) or {}).get(vid) or []
            listings.append(
                {
                    "id": var_id,
                    "type": "workflow_variant",
                    "title": f"{pack.get('display_name') or slug} — {variant.get('label') or vid}",
                    "summary": variant.get("description") or "",
                    "tags": _tags_from_pack(pack) + [f"variant:{vid}", variant.get("complexity") or ""],
                    "vertical_slugs": [slug],
                    "source_ref": f"catalog/vertical-packs.json#{slug}/variants/{vid}",
                    "distribution": _distribution_for(var_id, "workflow_variant", dist_cfg),
                    "quality": {
                        "pack_semver": pack.get("pack_semver"),
                        "complexity": variant.get("complexity"),
                        "compliance_tags": pack.get("compliance_tags") or [],
                        "certification": _distribution_for(var_id, "workflow_variant", dist_cfg)[
                            "certification"
                        ],
                    },
                    "install": {
                        "method": "catalog",
                        "endpoint": "/api/v1/workflow/install-from-catalog",
                        "slug": slug,
                        "variant_id": vid,
                    },
                    "assets": {
                        "packaged_definition_ref": vref,
                        "http_tool_names": tools,
                        "prompt_nodes": _extract_prompt_nodes(vpath) if vpath else [],
                    },
                }
            )

    # Capability modules
    for mod in capability_catalog.get("modules") or []:
        if not isinstance(mod, dict) or not mod.get("id"):
            continue
        mid = str(mod["id"])
        listing_id = f"capability_module:{mid}"
        slugs = sorted(
            {str(r["slug"]) for r in (mod.get("pack_refs") or []) if isinstance(r, dict) and r.get("slug")}
        )
        listings.append(
            {
                "id": listing_id,
                "type": "capability_module",
                "title": mod.get("label") or mid,
                "summary": mod.get("summary") or "",
                "tags": [str(mod.get("category") or "other"), f"demand_rank:{mod.get('demand_rank', 3)}"],
                "vertical_slugs": slugs,
                "source_ref": f"catalog/capability-modules.json#{mid}",
                "distribution": _distribution_for(listing_id, "capability_module", dist_cfg),
                "quality": {"demand_rank": mod.get("demand_rank"), "certification": "reviewed"},
                "install": {
                    "method": "capability_modules",
                    "endpoint": "/api/v1/workflow/install-from-capability-modules",
                    "module_ids": [mid],
                },
                "assets": {
                    "typical_http_tools": mod.get("typical_http_tools") or [],
                    "template_variable_keys": mod.get("template_variable_keys") or [],
                    "pack_refs": mod.get("pack_refs") or [],
                },
            }
        )

    # HTTP tool stubs (global index)
    tool_index = _collect_tool_names(capability_catalog, variant_tools)
    for tool_name in sorted(tool_index.keys()):
        listing_id = f"tool_stub:{tool_name}"
        slugs = sorted(tool_index[tool_name])
        listings.append(
            {
                "id": listing_id,
                "type": "tool_stub",
                "title": tool_name.replace("_", " ").title(),
                "summary": f"Catalog HTTP tool stub referenced by vertical packs and capability modules.",
                "tags": ["http_tool", "integration"],
                "vertical_slugs": slugs,
                "source_ref": f"catalog/catalog-variant-http-tools.json + capability-modules.json#{tool_name}",
                "distribution": _distribution_for(listing_id, "tool_stub", dist_cfg),
                "quality": {"certification": "reviewed"},
                "install": {
                    "method": "wire_after_install",
                    "endpoint": "/api/v1/tools",
                    "tool_name": tool_name,
                },
                "assets": {"tool_name": tool_name},
            }
        )

    # Native tool templates
    for tmpl in NATIVE_TOOL_TEMPLATES:
        listing_id = tmpl["id"]
        listings.append(
            {
                "id": listing_id,
                "type": "native_tool_template",
                "title": tmpl["title"],
                "summary": tmpl["summary"],
                "tags": ["native_tool", "runtime"],
                "vertical_slugs": [],
                "source_ref": "api/enums.py#ToolCategory",
                "distribution": _distribution_for(listing_id, "native_tool_template", dist_cfg),
                "quality": {"certification": "reviewed"},
                "install": {"method": "editor", "endpoint": "/api/v1/tools"},
                "assets": {"tool_type": listing_id.split(":", 1)[-1]},
            }
        )

    # Prompt packs — one per packaged workflow file
    workflows_dir = CATALOG / "packaged-workflows"
    if workflows_dir.is_dir():
        for wf_path in sorted(workflows_dir.glob("*.json")):
            stem = wf_path.stem
            listing_id = f"prompt_pack:{stem}"
            nodes = _extract_prompt_nodes(wf_path)
            if not nodes:
                continue
            slug_guess = stem.split("-")[0] if "-" in stem else stem
            listings.append(
                {
                    "id": listing_id,
                    "type": "prompt_pack",
                    "title": f"Prompt pack — {stem}",
                    "summary": f"{len(nodes)} agent/start/end prompts from packaged workflow graph.",
                    "tags": ["prompt", "authoring"],
                    "vertical_slugs": [slug_guess] if slug_guess else [],
                    "source_ref": f"catalog/packaged-workflows/{wf_path.name}",
                    "distribution": _distribution_for(listing_id, "prompt_pack", dist_cfg),
                    "quality": {"certification": "community"},
                    "install": {
                        "method": "packaged_definition",
                        "endpoint": "/api/v1/workflow/create/definition",
                    },
                    "assets": {"prompt_nodes": nodes, "node_count": len(nodes)},
                }
            )

    # Recipes
    recipes_dir = CATALOG / "recipes"
    if recipes_dir.is_dir():
        for recipe_path in sorted(recipes_dir.glob("*.md")):
            stem = recipe_path.stem
            listing_id = f"recipe:{stem}"
            first_line = ""
            try:
                text = recipe_path.read_text(encoding="utf-8")
                for line in text.splitlines():
                    if line.strip() and not line.startswith("#"):
                        first_line = line.strip()[:300]
                        break
                    if line.startswith("# "):
                        first_line = line.lstrip("# ").strip()
            except OSError:
                pass
            listings.append(
                {
                    "id": listing_id,
                    "type": "recipe",
                    "title": stem.replace("-", " ").title(),
                    "summary": first_line or f"Operator recipe: {stem}",
                    "tags": ["recipe", "best_practice", "gtm"],
                    "vertical_slugs": [],
                    "source_ref": f"catalog/recipes/{recipe_path.name}",
                    "distribution": _distribution_for(listing_id, "recipe", dist_cfg),
                    "quality": {"certification": "community"},
                    "install": {"method": "documentation"},
                    "assets": {"markdown_path": f"catalog/recipes/{recipe_path.name}"},
                }
            )

    # Best-practice docs
    for filename, title, summary in BEST_PRACTICE_DOCS:
        path = CATALOG / filename
        if not path.is_file():
            continue
        stem = path.stem
        listing_id = f"best_practice:{stem}"
        listings.append(
            {
                "id": listing_id,
                "type": "best_practice",
                "title": title,
                "summary": summary,
                "tags": ["best_practice", "quality", "compliance"],
                "vertical_slugs": [],
                "source_ref": f"catalog/{filename}",
                "distribution": _distribution_for(listing_id, "best_practice", dist_cfg),
                "quality": {"certification": "reviewed"},
                "install": {"method": "documentation"},
                "assets": {"markdown_path": f"catalog/{filename}"},
            }
        )

    # Inference profiles
    for profile in inference_catalog.get("profiles") or []:
        if not isinstance(profile, dict) or not profile.get("id"):
            continue
        pid = str(profile["id"])
        listing_id = f"inference_profile:{pid}"
        listings.append(
            {
                "id": listing_id,
                "type": "inference_profile",
                "title": profile.get("label") or pid,
                "summary": profile.get("summary") or "",
                "tags": ["inference", str(profile.get("tier") or "cloud")],
                "vertical_slugs": [],
                "source_ref": f"catalog/inference-profiles.json#{pid}",
                "distribution": _distribution_for(listing_id, "inference_profile", dist_cfg),
                "quality": {"certification": "reviewed"},
                "install": {
                    "method": "inference_profile",
                    "endpoint": f"/api/v1/inference-profiles/{pid}/apply",
                },
                "assets": {
                    "requires_api_keys": profile.get("requires_api_keys"),
                    "local_models": profile.get("local_models") or [],
                },
            }
        )

    # Governance policy
    policy_path = CATALOG / "self-improvement-policy.json"
    if policy_path.is_file():
        listing_id = "governance_policy:self-improvement"
        listings.append(
            {
                "id": listing_id,
                "type": "governance_policy",
                "title": "Agent self-improvement governance",
                "summary": "Default modes, evidence gates, and risk tiers for AI-proposed workflow improvements.",
                "tags": ["governance", "qm", "self_improvement"],
                "vertical_slugs": [],
                "source_ref": "catalog/self-improvement-policy.json",
                "distribution": _distribution_for(listing_id, "governance_policy", dist_cfg),
                "quality": {"certification": "reviewed"},
                "install": {
                    "method": "policy",
                    "endpoint": "/api/v1/analytics/self-improvement/policy",
                },
                "assets": {"policy_path": "catalog/self-improvement-policy.json"},
            }
        )

    # Skill import adapter
    listing_id = "skill_import:skill-packaged-draft"
    listings.append(
        {
            "id": listing_id,
            "type": "skill_import",
            "title": "Agent skill → workflow draft",
            "summary": "Import Claude/Cursor/Codex SKILL.md as a draft packaged graph (authoring accelerator).",
            "tags": ["skill", "import", "authoring"],
            "vertical_slugs": [],
            "source_ref": "api/utils/skill_packaged_adapter.py",
            "distribution": _distribution_for(listing_id, "skill_import", dist_cfg),
            "quality": {"certification": "community"},
            "install": {
                "method": "import",
                "endpoint": "/api/v1/workflow/import/skill-packaged-draft",
            },
            "assets": {"adapter": "skill_packaged_adapter"},
        }
    )

    return {
        "registry_version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "description": (
            "Unified community catalog registry — verticals, capabilities, tools, prompts, "
            "recipes, inference profiles, and governance policies. Public browse via "
            "GET /api/v1/catalog/registry; export via GET /api/v1/catalog/registry/export."
        ),
        "publishers": dist_cfg.get("publishers")
        or [{"id": publisher_id, "display_name": "Dograh OSS", "license_spdx": "MIT"}],
        "listing_types": sorted(
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
        ),
        "listing_count": len(listings),
        "listings": listings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build community-registry.json")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if community-registry.json is stale vs sources",
    )
    args = parser.parse_args()

    built = build_registry()
    serialized = json.dumps(built, indent=2, ensure_ascii=False) + "\n"

    if args.check:
        if not OUT_PATH.is_file():
            print(f"Missing {OUT_PATH}; run without --check", file=sys.stderr)
            return 1
        existing = OUT_PATH.read_text(encoding="utf-8")
        # Compare structure ignoring generated_at
        existing_data = json.loads(existing)
        built_compare = dict(built)
        existing_compare = dict(existing_data)
        built_compare.pop("generated_at", None)
        existing_compare.pop("generated_at", None)
        if json.dumps(built_compare, sort_keys=True) != json.dumps(existing_compare, sort_keys=True):
            print("community-registry.json is stale; run scripts/build_community_catalog.py", file=sys.stderr)
            return 1
        print("community-registry.json is up to date")
        return 0

    OUT_PATH.write_text(serialized, encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({built['listing_count']} listings)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
