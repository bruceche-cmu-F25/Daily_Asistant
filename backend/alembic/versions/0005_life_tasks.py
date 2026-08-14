"""Add isolated personal life tasks and timeline."""

from alembic import op
import sqlalchemy as sa


revision = "0005_life_tasks"
down_revision = "0004_application_signals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "life_tasks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("due_at", sa.String(length=16), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("completed", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.CheckConstraint("completed IN (0, 1)", name="ck_life_task_completed"),
        sa.CheckConstraint(
            "category IN ('personal', 'home', 'health', 'finance', 'errands', 'social', 'admin', 'other')",
            name="ck_life_task_category",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_life_task_completed_due",
        "life_tasks",
        ["completed", "due_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_life_task_completed_due", table_name="life_tasks")
    op.drop_table("life_tasks")
