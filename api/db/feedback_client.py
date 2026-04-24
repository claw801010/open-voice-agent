from datetime import datetime, timezone

from sqlalchemy import select

from api.db.base_client import BaseDBClient
from api.db.models import ProductFeedbackModel


class ProductFeedbackClient(BaseDBClient):
    async def create_product_feedback(
        self,
        *,
        user_id: int,
        organization_id: int | None,
        message: str,
        workflow_id: int | None,
        source: str,
        user_agent: str | None,
    ) -> int:
        async with self.async_session() as session:
            row = ProductFeedbackModel(
                user_id=user_id,
                organization_id=organization_id,
                workflow_id=workflow_id,
                message=message,
                source=source,
                user_agent=user_agent,
                created_at=datetime.now(timezone.utc),
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return row.id

    async def get_product_feedback_by_id(self, feedback_id: int) -> ProductFeedbackModel | None:
        async with self.async_session() as session:
            result = await session.execute(
                select(ProductFeedbackModel).where(ProductFeedbackModel.id == feedback_id)
            )
            return result.scalars().first()
