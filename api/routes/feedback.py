from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field

from api.db import db_client
from api.db.models import UserModel
from api.services.auth.depends import get_user

router = APIRouter(prefix="/feedback", tags=["feedback"])

_MAX_MESSAGE = 8000


class ProductFeedbackRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=_MAX_MESSAGE)
    workflow_id: int | None = None
    source: str = Field(default="workflow_editor", max_length=64)


class ProductFeedbackResponse(BaseModel):
    id: int


@router.post("", response_model=ProductFeedbackResponse)
async def submit_product_feedback(
    body: ProductFeedbackRequest,
    request: Request,
    user: UserModel = Depends(get_user),
) -> ProductFeedbackResponse:
    """Persist in-app product feedback (authenticated)."""
    workflow_id: int | None = body.workflow_id
    if workflow_id is not None:
        wf_org = await db_client.get_workflow_organization_id(workflow_id)
        if wf_org is None:
            raise HTTPException(status_code=404, detail="Workflow not found")
        if user.selected_organization_id is None or wf_org != user.selected_organization_id:
            raise HTTPException(status_code=403, detail="Workflow not in your organization")

    ua = request.headers.get("user-agent")
    if ua and len(ua) > 512:
        ua = ua[:512]

    try:
        fid = await db_client.create_product_feedback(
            user_id=user.id,
            organization_id=user.selected_organization_id,
            message=body.message.strip(),
            workflow_id=workflow_id,
            source=body.source.strip() or "workflow_editor",
            user_agent=ua,
        )
    except Exception as e:
        logger.exception("create_product_feedback failed: {}", e)
        raise HTTPException(status_code=500, detail="Could not save feedback") from e

    return ProductFeedbackResponse(id=fid)
