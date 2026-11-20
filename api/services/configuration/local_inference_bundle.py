"""Air-gapped local inference bundles — export/import Ollama model artifacts."""

from __future__ import annotations

import json
import os
import shutil
import tarfile
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from api.services.configuration.inference_profiles import (
    DEFAULT_INFERENCE_PROFILE_ID,
    get_inference_profile,
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CATALOG_MANIFEST = _REPO_ROOT / "catalog" / "local-inference-bundle.manifest.json"
_BUNDLE_PREFIX = "ollama"


class LocalInferenceBundleError(Exception):
    pass


def ollama_models_dir() -> Path:
    raw = os.getenv("OLLAMA_MODELS", "").strip()
    if raw:
        return Path(raw).expanduser()
    return Path.home() / ".ollama" / "models"


def bundle_path_from_env() -> Path | None:
    raw = os.getenv("LOCAL_INFERENCE_BUNDLE", "").strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    if not path.is_file():
        raise LocalInferenceBundleError(f"LOCAL_INFERENCE_BUNDLE not found: {path}")
    return path


def load_catalog_bundle_manifest() -> dict[str, Any]:
    if not _CATALOG_MANIFEST.is_file():
        raise LocalInferenceBundleError(f"Missing catalog manifest: {_CATALOG_MANIFEST}")
    with _CATALOG_MANIFEST.open(encoding="utf-8") as f:
        return json.load(f)


def required_ollama_model_tags(profile_id: str = DEFAULT_INFERENCE_PROFILE_ID) -> list[str]:
    profile = get_inference_profile(profile_id)
    tags: list[str] = []
    for ref in profile.get("local_models") or []:
        if ref.get("runtime") == "ollama" and ref.get("model"):
            tags.append(str(ref["model"]))
    return tags


def _parse_model_tag(model_tag: str) -> tuple[str, str]:
    if ":" in model_tag:
        name, tag = model_tag.split(":", 1)
        return name, tag
    return model_tag, "latest"


def _manifest_path(models_dir: Path, model_tag: str) -> Path:
    name, tag = _parse_model_tag(model_tag)
    return models_dir / "manifests" / "registry.ollama.ai" / "library" / name / tag


def _blob_path(models_dir: Path, digest: str) -> Path:
    normalized = digest.replace(":", "-")
    return models_dir / "blobs" / normalized


def _digests_from_manifest(manifest_path: Path) -> set[str]:
    with manifest_path.open(encoding="utf-8") as f:
        data = json.load(f)
    digests: set[str] = set()
    config = data.get("config") or {}
    if isinstance(config, dict) and config.get("digest"):
        digests.add(str(config["digest"]))
    for layer in data.get("layers") or []:
        if isinstance(layer, dict) and layer.get("digest"):
            digests.add(str(layer["digest"]))
    return digests


def collect_ollama_artifact_paths(models_dir: Path, model_tag: str) -> list[Path]:
    manifest = _manifest_path(models_dir, model_tag)
    if not manifest.is_file():
        raise LocalInferenceBundleError(
            f"Ollama manifest missing for {model_tag!r}: {manifest} "
            f"(run ollama pull {model_tag} on a connected machine first)"
        )

    paths: list[Path] = [manifest]
    for digest in _digests_from_manifest(manifest):
        blob = _blob_path(models_dir, digest)
        if not blob.is_file():
            raise LocalInferenceBundleError(
                f"Ollama blob missing for {model_tag!r}: {blob.name} "
                f"(re-run ollama pull {model_tag})"
            )
        paths.append(blob)
    return paths


def _bundle_member_path(models_dir: Path, artifact: Path) -> str:
    rel = artifact.relative_to(models_dir)
    return f"{_BUNDLE_PREFIX}/{rel.as_posix()}"


def export_bundle(
    output_path: Path,
    *,
    models_dir: Path | None = None,
    model_tags: list[str] | None = None,
    profile_id: str = DEFAULT_INFERENCE_PROFILE_ID,
    include_speaches_cache: bool = False,
) -> dict[str, Any]:
    """Package Ollama manifests/blobs (and optional Speaches HF cache) into a tarball."""
    store = models_dir or ollama_models_dir()
    tags = model_tags if model_tags is not None else required_ollama_model_tags(profile_id)
    if not tags:
        raise LocalInferenceBundleError("No Ollama models listed for export")

    artifacts: list[Path] = []
    for tag in tags:
        artifacts.extend(collect_ollama_artifact_paths(store, tag))

    output_path = output_path.expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    manifest = {
        "version": 1,
        "profile_id": profile_id,
        "created_at": datetime.now(UTC).isoformat(),
        "ollama_models": tags,
        "ollama_models_dir_hint": str(store),
        "speaches_models": [
            m.get("model")
            for m in (get_inference_profile(profile_id).get("local_models") or [])
            if m.get("runtime") == "speaches" and m.get("model")
        ],
        "includes_speaches_cache": include_speaches_cache,
    }

    with tarfile.open(output_path, "w:gz") as tar:
        manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
        info = tarfile.TarInfo(name="manifest.json")
        info.size = len(manifest_bytes)
        tar.addfile(info, fileobj=_bytes_reader(manifest_bytes))

        seen: set[str] = set()
        for artifact in artifacts:
            member = _bundle_member_path(store, artifact)
            if member in seen:
                continue
            seen.add(member)
            tar.add(artifact, arcname=member)

        if include_speaches_cache:
            cache_root = speaches_hf_cache_dir()
            if cache_root.is_dir():
                for path in cache_root.rglob("*"):
                    if path.is_file():
                        rel = path.relative_to(cache_root.parent)
                        tar.add(path, arcname=f"speaches/{rel.as_posix()}")

    return {
        "output_path": str(output_path),
        "ollama_models": tags,
        "artifact_count": len(artifacts),
        "includes_speaches_cache": include_speaches_cache,
    }


def import_bundle(
    bundle_path: Path,
    *,
    models_dir: Path | None = None,
    speaches_cache_dir: Path | None = None,
) -> dict[str, Any]:
    """Extract a bundle tarball into the local Ollama store (and optional Speaches cache)."""
    bundle_path = bundle_path.expanduser()
    if not bundle_path.is_file():
        raise LocalInferenceBundleError(f"Bundle not found: {bundle_path}")

    store = models_dir or ollama_models_dir()
    store.mkdir(parents=True, exist_ok=True)
    cache_target = speaches_cache_dir or speaches_hf_cache_dir()

    imported_ollama = 0
    imported_speaches = 0
    manifest: dict[str, Any] = {}

    with tempfile.TemporaryDirectory(prefix="ovo-inference-bundle-") as tmp:
        tmp_path = Path(tmp)
        with tarfile.open(bundle_path, "r:gz") as tar:
            tar.extractall(tmp_path, filter="data")

        manifest_path = tmp_path / "manifest.json"
        if manifest_path.is_file():
            with manifest_path.open(encoding="utf-8") as f:
                manifest = json.load(f)

        ollama_root = tmp_path / _BUNDLE_PREFIX
        if ollama_root.is_dir():
            for src in ollama_root.rglob("*"):
                if not src.is_file():
                    continue
                rel = src.relative_to(ollama_root)
                dest = store / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)
                imported_ollama += 1

        speaches_root = tmp_path / "speaches"
        if speaches_root.is_dir():
            cache_target.mkdir(parents=True, exist_ok=True)
            for src in speaches_root.rglob("*"):
                if not src.is_file():
                    continue
                rel = src.relative_to(speaches_root)
                dest = cache_target / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)
                imported_speaches += 1

    if imported_ollama == 0 and not manifest.get("includes_speaches_cache"):
        raise LocalInferenceBundleError(
            f"No ollama/ artifacts found in bundle: {bundle_path}"
        )

    return {
        "bundle_path": str(bundle_path),
        "ollama_models_dir": str(store),
        "imported_ollama_files": imported_ollama,
        "imported_speaches_files": imported_speaches,
        "manifest": manifest,
    }


def speaches_hf_cache_dir() -> Path:
    raw = os.getenv("SPEACHES_HF_CACHE", "").strip()
    if raw:
        return Path(raw).expanduser()
    return Path.home() / ".cache" / "ovo" / "speaches-hf-hub"


class _BytesReader:
    def __init__(self, data: bytes) -> None:
        self._data = data
        self._pos = 0

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            chunk = self._data[self._pos :]
            self._pos = len(self._data)
            return chunk
        chunk = self._data[self._pos : self._pos + size]
        self._pos += len(chunk)
        return chunk


def _bytes_reader(data: bytes) -> _BytesReader:
    return _BytesReader(data)
