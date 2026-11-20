"""Scan and set up local OSS inference (Ollama LLM + Speaches STT/TTS)."""

from __future__ import annotations

import asyncio
import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import httpx

from api.services.configuration.inference_profiles import (
    DEFAULT_INFERENCE_PROFILE_ID,
    get_inference_profile,
    load_inference_profiles_catalog,
)
from api.services.configuration.local_inference_bundle import (
    LocalInferenceBundleError,
    bundle_path_from_env,
    import_bundle,
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_COMPOSE_FILE = _REPO_ROOT / "docker-compose-local.yaml"
_DEFAULT_OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
_DEFAULT_SPEACHES_BASE = os.getenv("SPEACHES_BASE_URL", "http://127.0.0.1:8100")

SetupStepStatus = Literal["ok", "started", "skipped", "failed", "unavailable"]


@dataclass
class SetupStepResult:
    id: str
    status: SetupStepStatus
    message: str = ""


@dataclass
class RuntimeComponentStatus:
    id: str
    label: str
    installed: bool
    reachable: bool
    ready: bool
    models_present: list[str] = field(default_factory=list)
    models_required: list[str] = field(default_factory=list)
    endpoint: str = ""
    hint: str = ""


def _ollama_tags_url() -> str:
    base = _DEFAULT_OLLAMA_BASE.rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    return f"{base}/api/tags"


def _speaches_health_url(base: str | None = None) -> str:
    root = (base or _DEFAULT_SPEACHES_BASE).rstrip("/")
    if root.endswith("/v1"):
        root = root[:-3]
    return f"{root}/health"


def _normalize_ollama_name(name: str) -> str:
    return name.split(":")[0] if ":" in name else name


def _ollama_model_satisfied(required: str, installed: list[str]) -> bool:
    req_base = _normalize_ollama_name(required)
    for tag in installed:
        if tag == required or _normalize_ollama_name(tag) == req_base:
            return True
        if tag.startswith(f"{req_base}:"):
            return True
    return False


def required_local_models() -> dict[str, list[dict[str, Any]]]:
    profile = get_inference_profile(DEFAULT_INFERENCE_PROFILE_ID)
    ollama: list[dict[str, Any]] = []
    speaches: list[dict[str, Any]] = []
    for ref in profile.get("local_models") or []:
        if ref.get("runtime") == "ollama":
            ollama.append(ref)
        elif ref.get("runtime") == "speaches":
            speaches.append(ref)
    return {"ollama": ollama, "speaches": speaches}


async def _probe_url(url: str, timeout: float = 2.5) -> bool:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.get(url)
            return res.status_code < 500
    except Exception:
        return False


async def _fetch_ollama_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(_ollama_tags_url())
            if res.status_code != 200:
                return []
            data = res.json()
            names: list[str] = []
            for item in data.get("models") or []:
                if isinstance(item, dict) and item.get("name"):
                    names.append(str(item["name"]))
            return names
    except Exception:
        return []


async def scan_local_inference_capabilities() -> dict[str, Any]:
    """Runtime scan for local edge readiness (no side effects)."""
    catalog = load_inference_profiles_catalog()
    reqs = required_local_models()
    ollama_required = [m["model"] for m in reqs["ollama"] if m.get("model")]
    speaches_required = [m["model"] for m in reqs["speaches"] if m.get("model")]

    ollama_bin = shutil.which("ollama") is not None
    docker_bin = shutil.which("docker") is not None
    ollama_reachable = await _probe_url(_ollama_tags_url()) if ollama_bin else False
    speaches_reachable = await _probe_url(_speaches_health_url())
    ollama_models = await _fetch_ollama_models() if ollama_reachable else []

    ollama_ready = bool(ollama_required) and all(
        _ollama_model_satisfied(m, ollama_models) for m in ollama_required
    )
    if not ollama_required:
        ollama_ready = ollama_reachable

    speaches_ready = speaches_reachable

    components = [
        RuntimeComponentStatus(
            id="ollama",
            label="Ollama LLM",
            installed=ollama_bin,
            reachable=ollama_reachable,
            ready=ollama_ready,
            models_present=ollama_models,
            models_required=ollama_required,
            endpoint=f"{_DEFAULT_OLLAMA_BASE.rstrip('/')}/v1",
            hint="Install from ollama.com, then pull llama3.2:3b",
        ),
        RuntimeComponentStatus(
            id="speaches",
            label="Speaches STT/TTS",
            installed=docker_bin,
            reachable=speaches_reachable,
            ready=speaches_ready,
            models_present=[],
            models_required=speaches_required,
            endpoint=f"{_DEFAULT_SPEACHES_BASE.rstrip('/')}/v1",
            hint="Docker pulls models on first use; start via Set up below",
        ),
    ]

    local_stack_ready = all(c.ready for c in components)

    return {
        "version": catalog.get("version", 1),
        "default_profile_id": DEFAULT_INFERENCE_PROFILE_ID,
        "local_stack_ready": local_stack_ready,
        "docker_available": docker_bin,
        "components": [
            {
                "id": c.id,
                "label": c.label,
                "installed": c.installed,
                "reachable": c.reachable,
                "ready": c.ready,
                "models_present": c.models_present,
                "models_required": c.models_required,
                "endpoint": c.endpoint,
                "hint": c.hint,
            }
            for c in components
        ],
    }


def inference_setup_allowed() -> bool:
    from api.constants import ENVIRONMENT, Environment

    if ENVIRONMENT == Environment.LOCAL.value:
        return True
    return os.getenv("ENABLE_INFERENCE_SETUP", "").lower() in ("1", "true", "yes")


async def _start_speaches_container() -> SetupStepResult:
    if not shutil.which("docker"):
        return SetupStepResult(
            id="start_speaches",
            status="unavailable",
            message="Docker not installed — install Docker Desktop to run Speaches STT/TTS.",
        )
    if not _COMPOSE_FILE.is_file():
        return SetupStepResult(
            id="start_speaches",
            status="failed",
            message=f"Missing compose file: {_COMPOSE_FILE}",
        )
    proc = await asyncio.create_subprocess_exec(
        "docker",
        "compose",
        "-f",
        str(_COMPOSE_FILE),
        "--profile",
        "local-inference",
        "up",
        "-d",
        "speaches",
        cwd=str(_REPO_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        err = (stderr or stdout or b"").decode(errors="replace").strip()
        return SetupStepResult(
            id="start_speaches",
            status="failed",
            message=err or "docker compose up failed",
        )

    for _ in range(30):
        if await _probe_url(_speaches_health_url(), timeout=2.0):
            return SetupStepResult(
                id="start_speaches",
                status="ok",
                message="Speaches is running on port 8100",
            )
        await asyncio.sleep(2)

    return SetupStepResult(
        id="start_speaches",
        status="started",
        message="Speaches container started — models download on first call (may take a minute).",
    )


async def _import_ollama_bundle() -> list[SetupStepResult]:
    try:
        bundle = bundle_path_from_env()
    except LocalInferenceBundleError as e:
        return [
            SetupStepResult(
                id="import_ollama_bundle",
                status="failed",
                message=str(e),
            )
        ]
    if bundle is None:
        return []

    try:
        result = import_bundle(bundle)
        models = result.get("manifest", {}).get("ollama_models") or []
        label = ", ".join(models) if models else bundle.name
        return [
            SetupStepResult(
                id="import_ollama_bundle",
                status="ok",
                message=f"Imported Ollama bundle ({label})",
            )
        ]
    except LocalInferenceBundleError as e:
        return [
            SetupStepResult(
                id="import_ollama_bundle",
                status="failed",
                message=str(e),
            )
        ]


async def _pull_ollama_models(models: list[str]) -> list[SetupStepResult]:
    if not shutil.which("ollama"):
        return [
            SetupStepResult(
                id="pull_ollama",
                status="unavailable",
                message="Ollama not installed — get it at https://ollama.com",
            )
        ]
    if not models:
        return [
            SetupStepResult(
                id="pull_ollama",
                status="skipped",
                message="No Ollama models listed in catalog",
            )
        ]

    steps: list[SetupStepResult] = []
    for model in models:
        proc = await asyncio.create_subprocess_exec(
            "ollama",
            "pull",
            model,
            cwd=str(_REPO_ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        out, _ = await proc.communicate()
        text = (out or b"").decode(errors="replace").strip()
        if proc.returncode == 0:
            steps.append(
                SetupStepResult(
                    id=f"pull_ollama_{model}",
                    status="ok",
                    message=f"Pulled {model}",
                )
            )
        else:
            steps.append(
                SetupStepResult(
                    id=f"pull_ollama_{model}",
                    status="failed",
                    message=text or f"ollama pull {model} failed",
                )
            )
    return steps


async def run_local_inference_setup(
    *,
    start_speaches: bool = True,
    pull_ollama: bool = True,
) -> dict[str, Any]:
    """Download / start local OSS inference runtimes."""
    steps: list[SetupStepResult] = []
    caps_before = await scan_local_inference_capabilities()
    reqs = required_local_models()

    if start_speaches and not caps_before["local_stack_ready"]:
        speaches = next(
            (c for c in caps_before["components"] if c["id"] == "speaches"), None
        )
        if speaches and not speaches["reachable"]:
            steps.append(await _start_speaches_container())

    if pull_ollama:
        bundle_steps = await _import_ollama_bundle()
        if bundle_steps:
            steps.extend(bundle_steps)
        else:
            ollama = next(
                (c for c in caps_before["components"] if c["id"] == "ollama"), None
            )
            required = [m["model"] for m in reqs["ollama"] if m.get("model")]
            present = (ollama or {}).get("models_present") or []
            missing = [m for m in required if not _ollama_model_satisfied(m, present)]
            if missing:
                steps.extend(await _pull_ollama_models(missing))
            elif required:
                steps.append(
                    SetupStepResult(
                        id="pull_ollama",
                        status="skipped",
                        message="Ollama models already present",
                    )
                )

    caps_after = await scan_local_inference_capabilities()
    return {
        "steps": [{"id": s.id, "status": s.status, "message": s.message} for s in steps],
        "capabilities": caps_after,
    }

