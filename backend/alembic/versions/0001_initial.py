"""Create local-first application tables."""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "migration_markers",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("applied_at", sa.String(length=40), nullable=False),
        sa.Column("detail_json", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )
    op.create_table(
        "problem_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("problem_key", sa.String(length=300), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("language", sa.String(length=40), nullable=False),
        sa.Column("solution", sa.Text(), nullable=False),
        sa.Column("reflection", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("legacy_stuck_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.Column("deleted_at", sa.String(length=40), nullable=True),
        sa.CheckConstraint("status IN ('draft', 'stuck', 'solved')", name="ck_attempt_status"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attempt_problem_created", "problem_attempts", ["problem_key", "created_at"])
    op.create_index("ix_problem_attempts_problem_key", "problem_attempts", ["problem_key"])
    op.create_table(
        "problem_drafts",
        sa.Column("problem_key", sa.String(length=300), nullable=False),
        sa.Column("language", sa.String(length=40), nullable=False),
        sa.Column("solution", sa.Text(), nullable=False),
        sa.Column("reflection", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint("problem_key"),
    )
    op.create_table(
        "sync_states",
        sa.Column("source", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("last_success_at", sa.String(length=40), nullable=True),
        sa.Column("last_attempt_at", sa.String(length=40), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("source"),
    )
    op.create_table(
        "todo_states",
        sa.Column("item_key", sa.String(length=500), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("completed", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.CheckConstraint("completed IN (0, 1)", name="ck_todo_completed"),
        sa.PrimaryKeyConstraint("item_key"),
    )


def downgrade() -> None:
    op.drop_table("todo_states")
    op.drop_table("sync_states")
    op.drop_table("problem_drafts")
    op.drop_index("ix_problem_attempts_problem_key", table_name="problem_attempts")
    op.drop_index("ix_attempt_problem_created", table_name="problem_attempts")
    op.drop_table("problem_attempts")
    op.drop_table("migration_markers")
