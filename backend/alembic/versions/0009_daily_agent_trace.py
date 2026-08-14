"""Add provider-neutral telemetry to Daily Agent messages."""

from alembic import op
import sqlalchemy as sa


revision = "0009_daily_agent_trace"
down_revision = "0008_daily_agent_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_messages",
        sa.Column("trace_json", sa.Text(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("agent_messages", "trace_json")
