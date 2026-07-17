"""Add the local job application CRM."""

from alembic import op
import sqlalchemy as sa


revision = "0002_job_applications"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=300), nullable=False),
        sa.Column("job_url", sa.Text(), nullable=False),
        sa.Column("stage", sa.String(length=30), nullable=False),
        sa.Column("next_step", sa.Text(), nullable=False),
        sa.Column("applied_at", sa.String(length=10), nullable=True),
        sa.Column("follow_up_at", sa.String(length=10), nullable=True),
        sa.Column("contact_name", sa.String(length=200), nullable=False),
        sa.Column("contact_type", sa.String(length=30), nullable=False),
        sa.Column("contact_status", sa.String(length=30), nullable=False),
        sa.Column("resume_version", sa.String(length=200), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.CheckConstraint(
            "stage IN ('saved', 'applied', 'oa', 'recruiter_screen', 'interview', 'offer', 'rejected', 'withdrawn')",
            name="ck_job_application_stage",
        ),
        sa.CheckConstraint(
            "contact_type IN ('none', 'alumni', 'recruiter', 'hiring_manager', 'employee', 'other')",
            name="ck_job_application_contact_type",
        ),
        sa.CheckConstraint(
            "contact_status IN ('not_contacted', 'planned', 'contacted', 'replied')",
            name="ck_job_application_contact_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_job_application_stage_follow_up",
        "job_applications",
        ["stage", "follow_up_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_job_application_stage_follow_up", table_name="job_applications")
    op.drop_table("job_applications")
