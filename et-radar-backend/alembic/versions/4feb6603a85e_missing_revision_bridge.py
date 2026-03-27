"""missing_revision_bridge

Revision ID: 4feb6603a85e
Revises: 8471e5ba2130
Create Date: 2026-03-28 00:00:01.000000

This is a no-op bridge revision to repair environments where the database
is stamped with 4feb6603a85e but the file was missing from source control.
"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "4feb6603a85e"
down_revision: Union[str, None] = "8471e5ba2130"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
