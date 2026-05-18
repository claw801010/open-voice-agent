"""enable RLS on analytics_http_tool_spans (MK-01 Phase D)

Org isolation via session GUC ``app.current_organization_id``; application sets it
with ``set_config(..., true)`` per transaction (see analytics_http_tool_span_rls).

Revision ID: b7c3e9d12f01
Revises: e8f4a2c91b00
Create Date: 2026-05-05

"""

from typing import Sequence, Union

from alembic import op

revision: str = "b7c3e9d12f01"
down_revision: Union[str, None] = "e8f4a2c91b00"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # asyncpg prepared statements accept one command per execute.
    op.execute("ALTER TABLE analytics_http_tool_spans ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE analytics_http_tool_spans FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY analytics_http_tool_spans_org_policy ON analytics_http_tool_spans
          FOR ALL
          USING (
            current_setting('app.current_organization_id', true) IS NOT NULL
            AND organization_id = current_setting(
              'app.current_organization_id', true
            )::integer
          )
          WITH CHECK (
            current_setting('app.current_organization_id', true) IS NOT NULL
            AND organization_id = current_setting(
              'app.current_organization_id', true
            )::integer
          )
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS analytics_http_tool_spans_org_policy ON analytics_http_tool_spans;"
    )
    op.execute(
        "ALTER TABLE analytics_http_tool_spans NO FORCE ROW LEVEL SECURITY;"
    )
    op.execute("ALTER TABLE analytics_http_tool_spans DISABLE ROW LEVEL SECURITY;")
