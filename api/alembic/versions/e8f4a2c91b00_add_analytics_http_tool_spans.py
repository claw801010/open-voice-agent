"""add analytics_http_tool_spans (MK-01 Phase D)

Normalized HTTP / function tool spans per workflow run for enterprise analytics paths.
RLS added in revision ``b7c3e9d12f01`` (session GUC ``app.current_organization_id``).

Revision ID: e8f4a2c91b00
Revises: d688d0da1123
Create Date: 2026-05-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e8f4a2c91b00"
down_revision: Union[str, None] = "d688d0da1123"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analytics_http_tool_spans",
        sa.Column(
            "id", sa.Integer(), autoincrement=True, nullable=False, primary_key=True
        ),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("workflow_run_id", sa.Integer(), nullable=False),
        sa.Column("span_id", sa.String(length=512), nullable=False),
        sa.Column("tool_name", sa.String(length=512), nullable=False),
        sa.Column("tool_type", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "duration_ms", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("http_summary", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workflow_run_id"], ["workflow_runs.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "workflow_run_id",
            "span_id",
            name="uq_analytics_http_tool_spans_run_span",
        ),
    )
    op.create_index(
        "ix_analytics_http_tool_spans_org_run",
        "analytics_http_tool_spans",
        ["organization_id", "workflow_run_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_analytics_http_tool_spans_workflow_run_id"),
        "analytics_http_tool_spans",
        ["workflow_run_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_analytics_http_tool_spans_workflow_run_id"),
        table_name="analytics_http_tool_spans",
    )
    op.drop_index(
        "ix_analytics_http_tool_spans_org_run", table_name="analytics_http_tool_spans"
    )
    op.drop_table("analytics_http_tool_spans")
