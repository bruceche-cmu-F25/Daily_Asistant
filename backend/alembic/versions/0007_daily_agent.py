"""Add the native Daily Agent conversation and approval gate."""

from alembic import op
import sqlalchemy as sa


revision = "0007_daily_agent"
down_revision = "0006_trip_plan"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_calls_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.CheckConstraint("role IN ('user', 'assistant')", name="ck_agent_message_role"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_message_created", "agent_messages", ["created_at"])
    op.create_table(
        "agent_drafts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.Column("resolved_at", sa.String(length=40), nullable=True),
        sa.CheckConstraint("kind IN ('life_task')", name="ck_agent_draft_kind"),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'dismissed')",
            name="ck_agent_draft_status",
        ),
        sa.ForeignKeyConstraint(["message_id"], ["agent_messages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agent_draft_message_status",
        "agent_drafts",
        ["message_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_agent_draft_message_status", table_name="agent_drafts")
    op.drop_table("agent_drafts")
    op.drop_index("ix_agent_message_created", table_name="agent_messages")
    op.drop_table("agent_messages")
