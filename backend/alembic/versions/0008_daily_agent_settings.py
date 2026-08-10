"""Add local Daily Agent model and API key settings."""

from alembic import op
import sqlalchemy as sa


revision = "0008_daily_agent_settings"
down_revision = "0007_daily_agent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_configurations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=200), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("agent_configurations")
