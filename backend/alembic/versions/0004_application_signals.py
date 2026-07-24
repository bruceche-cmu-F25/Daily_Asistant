"""Add confirmation-gated Gmail application signals."""

from alembic import op
import sqlalchemy as sa


revision = "0004_application_signals"
down_revision = "0003_job_lead_decisions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_applications", sa.Column("deadline_at", sa.String(length=10), nullable=True))
    op.create_table(
        "application_signals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_message_id", sa.String(length=200), nullable=False),
        sa.Column("source_thread_id", sa.String(length=200), nullable=False),
        sa.Column("sender", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("received_at", sa.String(length=40), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("signal_type", sa.String(length=30), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("role_hint", sa.String(length=300), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("suggested_stage", sa.String(length=30), nullable=False),
        sa.Column("suggested_next_step", sa.Text(), nullable=False),
        sa.Column("suggested_deadline_at", sa.String(length=10), nullable=True),
        sa.Column("application_id", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.String(length=40), nullable=False),
        sa.Column("updated_at", sa.String(length=40), nullable=False),
        sa.CheckConstraint(
            "signal_type IN ('confirmation', 'oa', 'recruiter', 'interview', 'offer', 'rejection', 'status_update')",
            name="ck_application_signal_type",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'dismissed')",
            name="ck_application_signal_status",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_message_id"),
    )
    op.create_index(
        "ix_application_signal_status_received",
        "application_signals",
        ["status", "received_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_application_signal_status_received", table_name="application_signals")
    op.drop_table("application_signals")
    op.drop_column("job_applications", "deadline_at")
