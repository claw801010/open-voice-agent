#!/usr/bin/env python3
"""
Export full FastAPI OpenAPI JSON (requires heavy api.app import).

For workflow import routes only (recommended), use:
  python scripts/gen_workflow_import_openapi.py
  cd ui && npm run generate-client:workflow-import
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock

REPO_ROOT = Path(__file__).resolve().parents[1]


def _ensure_env() -> None:
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres",
    )
    os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")
    os.environ.setdefault("AUTH_PROVIDER", "local")
    os.environ.setdefault("MINIO_PUBLIC_ENDPOINT", "http://127.0.0.1:9000")
    os.environ.setdefault("LOG_LEVEL", "WARNING")
    os.environ.setdefault("DEPLOYMENT_MODE", "oss")
    os.environ.setdefault("ENABLE_TELEMETRY", "0")

    pipecat_src = REPO_ROOT / "pipecat" / "src"
    if pipecat_src.is_dir():
        sys.path.insert(0, str(pipecat_src))
    sys.path.insert(0, str(REPO_ROOT))


def _mock_heavy_optional_imports() -> None:
    """Stub ARQ knowledge-base task so campaign→arq import chain does not load docling."""
    kb_mod = ModuleType("api.tasks.knowledge_base_processing")

    async def _noop_process_knowledge_base_document(*_args, **_kwargs):  # noqa: ANN001
        return None

    kb_mod.process_knowledge_base_document = _noop_process_knowledge_base_document  # type: ignore[attr-defined]
    sys.modules["api.tasks.knowledge_base_processing"] = kb_mod


def main() -> int:
    _ensure_env()
    _mock_heavy_optional_imports()

    from api.app import app  # noqa: WPS433 — intentional late import

    spec = app.openapi()
    paths = [p for p in spec.get("paths", {}) if "/workflow/import/" in p]
    print(f"workflow import paths: {len(paths)}", file=sys.stderr)
    json.dump(spec, sys.stdout, indent=2)
    print(file=sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
