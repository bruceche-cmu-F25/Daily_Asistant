"""Remember skip and applied decisions for automatic job leads."""

from alembic import op
import sqlalchemy as sa


revision = "0003_job_lead_decisions"
down_revision = "0002_job_applications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_lead_decisions",
        sa.Column("lead_key", sa.String(length=64), nullable=False),
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.CheckConstraint(
            "decision IN ('pending', 'skipped', 'applied')",
            name="ck_job_lead_decision",
        ),
        sa.PrimaryKeyConstraint("lead_key"),
    )


def downgrade() -> None:
    op.drop_table("job_lead_decisions")
