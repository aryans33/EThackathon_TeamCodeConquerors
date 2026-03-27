"""add_bse_filings_and_portfolio_reports

Revision ID: 9c1f4c3b2a10
Revises: 8471e5ba2130
Create Date: 2026-03-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c1f4c3b2a10"
down_revision: Union[str, None] = "4feb6603a85e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "portfolio_reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("raw_result", sa.JSON(), nullable=False),
        sa.Column("total_value", sa.Float(), nullable=True),
        sa.Column("xirr", sa.Float(), nullable=True),
        sa.Column("fund_count", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolio_reports_session_id"), "portfolio_reports", ["session_id"], unique=False)

    op.create_table(
        "bse_filings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("source_url", sa.String(length=512), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signal_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["signal_id"], ["signals.id"]),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bse_filings_published_at"), "bse_filings", ["published_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_bse_filings_published_at"), table_name="bse_filings")
    op.drop_table("bse_filings")

    op.drop_index(op.f("ix_portfolio_reports_session_id"), table_name="portfolio_reports")
    op.drop_table("portfolio_reports")
