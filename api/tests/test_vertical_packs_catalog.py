"""MK-01-RUBRIC: catalog/vertical-packs.json meets minimum schema for CI."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPO_ROOT / "catalog" / "vertical-packs.json"
PACKAGED_DIR = REPO_ROOT / "catalog" / "packaged-workflows"

REQUIRED_PACK_KEYS = frozenset(
    {
        "slug",
        "pack_semver",
        "industry",
        "display_name",
        "summary",
        "use_cases",
        "languages",
        "supported_modes",
        "compliance_tags",
        "cost_latency_estimate_band",
        "runbook_path",
        "workflow_template",
        "default_template_variables",
    }
)


@pytest.fixture(scope="module")
def catalog() -> dict:
    assert CATALOG_PATH.is_file(), f"Missing catalog file: {CATALOG_PATH}"
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def test_catalog_version_and_pack_count(catalog: dict) -> None:
    assert isinstance(catalog.get("catalog_version"), int)
    packs = catalog.get("packs")
    assert isinstance(packs, list) and len(packs) >= 3


def test_each_vertical_pack_rubric_fields(catalog: dict) -> None:
    packs = catalog["packs"]
    for index, pack in enumerate(packs):
        slug = pack.get("slug", f"<pack index {index}>")
        missing = REQUIRED_PACK_KEYS - pack.keys()
        assert not missing, f"{slug!r} missing keys: {sorted(missing)}"

        assert isinstance(pack["slug"], str) and pack["slug"].strip()
        assert isinstance(pack["pack_semver"], str) and pack["pack_semver"].strip()
        assert isinstance(pack["industry"], str) and pack["industry"].strip()
        assert isinstance(pack["display_name"], str) and pack["display_name"].strip()
        assert isinstance(pack["summary"], str) and pack["summary"].strip()

        use_cases = pack["use_cases"]
        assert isinstance(use_cases, list) and len(use_cases) >= 1
        assert all(isinstance(u, str) and u.strip() for u in use_cases)

        languages = pack["languages"]
        assert isinstance(languages, list) and len(languages) >= 1
        assert all(isinstance(x, str) and x.strip() for x in languages)

        modes = pack["supported_modes"]
        assert isinstance(modes, list) and len(modes) >= 1
        for m in modes:
            assert m in ("webrtc", "pstn"), f"{slug}: unsupported mode {m!r}"

        tags = pack["compliance_tags"]
        assert isinstance(tags, list) and len(tags) >= 1
        assert all(isinstance(t, str) and t.strip() for t in tags)

        band = pack["cost_latency_estimate_band"]
        assert isinstance(band, str) and len(band.strip()) >= 8

        rb = pack["runbook_path"]
        assert isinstance(rb, str) and rb.strip()
        runbook_file = REPO_ROOT / Path(rb)
        assert runbook_file.is_file(), f"{slug}: runbook missing: {runbook_file}"

        wt = pack["workflow_template"]
        assert isinstance(wt, dict)
        assert wt.get("source") == "packaged_definition"
        ref = wt.get("packaged_definition_ref")
        assert isinstance(ref, str) and ref.endswith(".json")
        graph_path = PACKAGED_DIR / ref
        assert graph_path.is_file(), f"{slug}: packaged workflow missing: {graph_path}"

        dtv = pack["default_template_variables"]
        assert isinstance(dtv, dict) and len(dtv) >= 1
        for k, v in dtv.items():
            assert isinstance(k, str) and k.strip()
            assert isinstance(v, str)


def _assert_minimal_workflow_graph(data: dict, label: str) -> None:
    assert isinstance(data, dict), f"{label}: root must be an object"
    nodes = data.get("nodes")
    edges = data.get("edges")
    assert isinstance(nodes, list) and len(nodes) >= 1, f"{label}: nodes must be a non-empty list"
    assert isinstance(edges, list), f"{label}: edges must be a list"
    for i, node in enumerate(nodes):
        assert isinstance(node, dict), f"{label}: nodes[{i}] must be an object"
        assert node.get("id"), f"{label}: nodes[{i}] missing id"
        assert node.get("type"), f"{label}: nodes[{i}] missing type"


def test_all_packaged_workflow_json_files_parse_as_graphs(catalog: dict) -> None:
    """Every *.json under packaged-workflows/ parses; catalog refs exist on disk; minimal graph shape."""
    json_files = sorted(PACKAGED_DIR.glob("*.json"))
    assert json_files, f"expected JSON graphs under {PACKAGED_DIR}"
    required_names = {
        (p.get("workflow_template") or {}).get("packaged_definition_ref")
        for p in catalog.get("packs", [])
    }
    required_names.discard(None)
    names_on_disk = {p.name for p in json_files}
    missing = required_names - names_on_disk
    assert not missing, f"catalog packaged_definition_ref missing on disk: {sorted(missing)}"
    for path in json_files:
        data = json.loads(path.read_text(encoding="utf-8"))
        _assert_minimal_workflow_graph(data, path.name)
