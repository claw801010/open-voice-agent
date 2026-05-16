"""merge analytics spans rls and product feedback

Revision ID: 4462d25364f9
Revises: b7c3e9d12f01, f8a91c2d4e6b
Create Date: 2026-05-16

"""

from typing import Sequence, Union

revision: str = "4462d25364f9"
down_revision: Union[str, None] = ("b7c3e9d12f01", "f8a91c2d4e6b")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
