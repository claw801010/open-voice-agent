"""add product_feedback table

Revision ID: f8a91c2d4e6b
Revises: a1b2c3d4e5f6
Create Date: 2026-04-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f8a91c2d4e6b"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("workflow_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False, server_default=sa.text("'workflow_editor'")),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_feedback_created_at"), "product_feedback", ["created_at"], unique=False)
    op.create_index(op.f("ix_product_feedback_organization_id"), "product_feedback", ["organization_id"], unique=False)
    op.create_index(op.f("ix_product_feedback_workflow_id"), "product_feedback", ["workflow_id"], unique=False)
    op.create_index(
        "ix_product_feedback_org_created",
        "product_feedback",
        ["organization_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_product_feedback_org_created", table_name="product_feedback")
    op.drop_index(op.f("ix_product_feedback_workflow_id"), table_name="product_feedback")
    op.drop_index(op.f("ix_product_feedback_organization_id"), table_name="product_feedback")
    op.drop_index(op.f("ix_product_feedback_created_at"), table_name="product_feedback")
    op.drop_table("product_feedback")
