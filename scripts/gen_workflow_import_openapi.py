#!/usr/bin/env python3
"""Emit OpenAPI 3.1 for workflow import routes only (no full api.app import)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi import FastAPI

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from api.schemas.workflow_import import (  # noqa: E402
    MakeImportAndCreateRequest,
    MakeImportAndCreateResponse,
    MakePackagedDraftRequest,
    MakePackagedDraftResponse,
    N8nImportAndCreateRequest,
    N8nImportAndCreateResponse,
    N8nPackagedDraftRequest,
    N8nPackagedDraftResponse,
    SkillImportAndCreateRequest,
    SkillImportAndCreateResponse,
    SkillPackagedDraftRequest,
    SkillPackagedDraftResponse,
    ZapierImportAndCreateRequest,
    ZapierImportAndCreateResponse,
    ZapierPackagedDraftRequest,
    ZapierPackagedDraftResponse,
)

OUT = REPO_ROOT / "catalog" / "openapi" / "workflow-import.openapi.json"


def _stub_app() -> FastAPI:
    app = FastAPI(
        title="Dograh Workflow Import API",
        description="MK-01 external flow import routes (subset of Dograh API).",
        version="1.0.0",
        servers=[
            {"url": "http://localhost:8000", "description": "Local development"},
            {"url": "https://app.dograh.com", "description": "Production"},
        ],
    )

    @app.post(
        "/api/v1/workflow/import/n8n-packaged-draft",
        response_model=N8nPackagedDraftResponse,
        tags=["workflow-import"],
    )
    def n8n_packaged_draft(_body: N8nPackagedDraftRequest) -> N8nPackagedDraftResponse:  # noqa: ARG001
        raise NotImplementedError

    @app.post(
        "/api/v1/workflow/import/n8n-and-create",
        response_model=N8nImportAndCreateResponse,
        tags=["workflow-import"],
    )
    def n8n_and_create(_body: N8nImportAndCreateRequest) -> N8nImportAndCreateResponse:  # noqa: ARG001
        raise NotImplementedError

    @app.post(
        "/api/v1/workflow/import/make-packaged-draft",
        response_model=MakePackagedDraftResponse,
        tags=["workflow-import"],
    )
    def make_packaged_draft(_body: MakePackagedDraftRequest) -> MakePackagedDraftResponse:  # noqa: ARG001
        raise NotImplementedError

    @app.post(
        "/api/v1/workflow/import/make-and-create",
        response_model=MakeImportAndCreateResponse,
        tags=["workflow-import"],
    )
    def make_and_create(_body: MakeImportAndCreateRequest) -> MakeImportAndCreateResponse:  # noqa: ARG001
        raise NotImplementedError

    @app.post(
        "/api/v1/workflow/import/zapier-packaged-draft",
        response_model=ZapierPackagedDraftResponse,
        tags=["workflow-import"],
    )
    def zapier_packaged_draft(_body: ZapierPackagedDraftRequest) -> ZapierPackagedDraftResponse:  # noqa: ARG001
        raise NotImplementedError

    @app.post(
        "/api/v1/workflow/import/zapier-and-create",
        response_model=ZapierImportAndCreateResponse,
        tags=["workflow-import"],
    )
    def zapier_and_create(_body: ZapierImportAndCreateRequest) -> ZapierImportAndCreateResponse:  # noqa: ARG001
        raise NotImplementedError

    @app.post(
        "/api/v1/workflow/import/skill-packaged-draft",
        response_model=SkillPackagedDraftResponse,
        tags=["workflow-import"],
    )
    def skill_packaged_draft(_body: SkillPackagedDraftRequest) -> SkillPackagedDraftResponse:  # noqa: ARG001
        raise NotImplementedError

    @app.post(
        "/api/v1/workflow/import/skill-and-create",
        response_model=SkillImportAndCreateResponse,
        tags=["workflow-import"],
    )
    def skill_and_create(_body: SkillImportAndCreateRequest) -> SkillImportAndCreateResponse:  # noqa: ARG001
        raise NotImplementedError

    return app


def main() -> int:
    spec = _stub_app().openapi()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    paths = [p for p in spec.get("paths", {}) if "/workflow/import/" in p]
    print(f"Wrote {OUT} ({len(paths)} import paths)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
