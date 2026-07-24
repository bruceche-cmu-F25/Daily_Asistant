"""Add the local current trip planner."""

from alembic import op
import sqlalchemy as sa


revision = "0006_trip_plan"
down_revision = "0005_life_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trip_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("destination", sa.String(length=500), nullable=False),
        sa.Column("start_date", sa.String(length=10), nullable=True),
        sa.Column("end_date", sa.String(length=10), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("stops_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("trip_plans")
