"""Air-gapped local inference bundle export/import."""

from __future__ import annotations

import json
import tarfile
from io import BytesIO
from pathlib import Path

import pytest

from api.services.configuration.local_inference_bundle import (
    LocalInferenceBundleError,
    collect_ollama_artifact_paths,
    export_bundle,
    import_bundle,
    required_ollama_model_tags,
)


def _write_fake_ollama_model(models_dir: Path, model_tag: str) -> None:
    name, tag = model_tag.split(":", 1)
    manifest_path = (
        models_dir
        / "manifests"
        / "registry.ollama.ai"
        / "library"
        / name
        / tag
    )
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    digest = "sha256:deadbeef"
    manifest = {
        "config": {"digest": digest},
        "layers": [{"digest": "sha256:cafebabe"}],
    }
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    blobs = models_dir / "blobs"
    blobs.mkdir(parents=True, exist_ok=True)
    (blobs / "sha256-deadbeef").write_bytes(b"config-bytes")
    (blobs / "sha256-cafebabe").write_bytes(b"layer-bytes")


def test_required_ollama_model_tags_from_catalog():
    tags = required_ollama_model_tags()
    assert "llama3.2:3b" in tags


def test_collect_ollama_artifact_paths(tmp_path: Path):
    _write_fake_ollama_model(tmp_path, "llama3.2:3b")
    paths = collect_ollama_artifact_paths(tmp_path, "llama3.2:3b")
    assert len(paths) == 3
    assert any(p.name == "3b" for p in paths)


def test_collect_missing_manifest_raises(tmp_path: Path):
    with pytest.raises(LocalInferenceBundleError, match="manifest missing"):
        collect_ollama_artifact_paths(tmp_path, "llama3.2:3b")


def test_export_and_import_roundtrip(tmp_path: Path):
    src = tmp_path / "src-models"
    dst = tmp_path / "dst-models"
    bundle = tmp_path / "bundle.tar.gz"
    _write_fake_ollama_model(src, "llama3.2:3b")

    exported = export_bundle(bundle, models_dir=src, model_tags=["llama3.2:3b"])
    assert exported["artifact_count"] == 3
    assert bundle.is_file()

    imported = import_bundle(bundle, models_dir=dst)
    assert imported["imported_ollama_files"] == 3
    paths = collect_ollama_artifact_paths(dst, "llama3.2:3b")
    assert len(paths) == 3


def test_import_rejects_empty_bundle(tmp_path: Path):
    bundle = tmp_path / "empty.tar.gz"
    data = json.dumps({"version": 1, "ollama_models": []}).encode("utf-8")
    with tarfile.open(bundle, "w:gz") as tar:
        info = tarfile.TarInfo(name="manifest.json")
        info.size = len(data)
        tar.addfile(info, fileobj=BytesIO(data))

    with pytest.raises(LocalInferenceBundleError, match="No ollama/ artifacts"):
        import_bundle(bundle, models_dir=tmp_path / "models")
