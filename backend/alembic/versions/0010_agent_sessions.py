"""Add isolated Daily Agent chat sessions."""

from alembic import op
import sqlalchemy as sa


revision = "0010_agent_sessions"
down_revision = "0009_daily_agent_trace"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_session_updated", "agent_sessions", ["updated_at"])
    op.execute(
        """
        INSERT INTO agent_sessions (id, title, created_at, updated_at)
        SELECT 1, 'Previous chat',
               COALESCE(MIN(created_at), CURRENT_TIMESTAMP),
               COALESCE(MAX(created_at), CURRENT_TIMESTAMP)
        FROM agent_messages
        HAVING COUNT(*) > 0
        """
    )
    op.add_column("agent_messages", sa.Column("session_id", sa.Integer(), nullable=True))
    op.execute("UPDATE agent_messages SET session_id = 1")
    with op.batch_alter_table("agent_messages") as batch:
        batch.alter_column("session_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key(
            "fk_agent_message_session",
            "agent_sessions",
            ["session_id"],
            ["id"],
            ondelete="CASCADE",
        )
    op.create_index("ix_agent_message_session_id", "agent_messages", ["session_id", "id"])


def downgrade() -> None:
    op.drop_index("ix_agent_message_session_id", table_name="agent_messages")
    with op.batch_alter_table("agent_messages") as batch:
        batch.drop_constraint("fk_agent_message_session", type_="foreignkey")
        batch.drop_column("session_id")
    op.drop_index("ix_agent_session_updated", table_name="agent_sessions")
    op.drop_table("agent_sessions")
