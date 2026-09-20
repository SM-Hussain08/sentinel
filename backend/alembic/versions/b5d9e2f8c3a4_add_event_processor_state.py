"""add event processor state

Revision ID: b5d9e2f8c3a4
Revises: a4c8d1e7f2b3
Create Date: 2026-09-17

Phase 9.12 introduces persistent lifecycle and activation state for
SENTINEL's always-on event processor.
"""

from typing import (
    Sequence,
    Union,
)

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b5d9e2f8c3a4"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "a4c8d1e7f2b3"

branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None

depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    op.create_table(
        "event_processor_states",

        sa.Column(
            "id",
            postgresql.UUID(
                as_uuid=True
            ),
            nullable=False,
        ),

        sa.Column(
            "processor_name",
            sa.String(length=80),
            nullable=False,
        ),

        sa.Column(
            "worker_id",
            sa.String(length=120),
            nullable=True,
        ),

        sa.Column(
            "worker_version",
            sa.String(length=40),
            nullable=False,
        ),

        sa.Column(
            "detector_name",
            sa.String(length=80),
            nullable=False,
        ),

        sa.Column(
            "detector_version",
            sa.String(length=40),
            nullable=False,
        ),

        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
        ),

        sa.Column(
            "activated_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.Column(
            "last_heartbeat_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=True,
        ),

        sa.Column(
            "stopped_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=True,
        ),

        sa.Column(
            "events_processed",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "scores_created",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "incidents_created",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "incidents_updated",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "last_error",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "configuration",
            postgresql.JSONB(
                astext_type=sa.Text()
            ),
            nullable=False,
        ),

        sa.Column(
            "runtime_metadata",
            postgresql.JSONB(
                astext_type=sa.Text()
            ),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.CheckConstraint(
            (
                "status IN ("
                "'starting', "
                "'running', "
                "'stopping', "
                "'stopped', "
                "'failed'"
                ")"
            ),
            name="ck_event_processor_states_status",
        ),

        sa.CheckConstraint(
            "events_processed >= 0",
            name=(
                "ck_event_processor_states_"
                "events_processed"
            ),
        ),

        sa.CheckConstraint(
            "scores_created >= 0",
            name=(
                "ck_event_processor_states_"
                "scores_created"
            ),
        ),

        sa.CheckConstraint(
            "incidents_created >= 0",
            name=(
                "ck_event_processor_states_"
                "incidents_created"
            ),
        ),

        sa.CheckConstraint(
            "incidents_updated >= 0",
            name=(
                "ck_event_processor_states_"
                "incidents_updated"
            ),
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),

        sa.UniqueConstraint(
            "processor_name",
            "detector_name",
            "detector_version",
            name="uq_event_processor_identity",
        ),
    )

    op.create_index(
        "ix_event_processor_states_processor_name",
        "event_processor_states",
        [
            "processor_name",
        ],
        unique=False,
    )

    op.create_index(
        "ix_event_processor_states_worker_id",
        "event_processor_states",
        [
            "worker_id",
        ],
        unique=False,
    )

    op.create_index(
        "ix_event_processor_states_detector_name",
        "event_processor_states",
        [
            "detector_name",
        ],
        unique=False,
    )

    op.create_index(
        "ix_event_processor_states_detector_version",
        "event_processor_states",
        [
            "detector_version",
        ],
        unique=False,
    )

    op.create_index(
        "ix_event_processor_states_status",
        "event_processor_states",
        [
            "status",
        ],
        unique=False,
    )

    op.create_index(
        "ix_event_processor_states_activated_at",
        "event_processor_states",
        [
            "activated_at",
        ],
        unique=False,
    )

    op.create_index(
        "ix_event_processor_states_last_heartbeat_at",
        "event_processor_states",
        [
            "last_heartbeat_at",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_event_processor_states_last_heartbeat_at",
        table_name="event_processor_states",
    )

    op.drop_index(
        "ix_event_processor_states_activated_at",
        table_name="event_processor_states",
    )

    op.drop_index(
        "ix_event_processor_states_status",
        table_name="event_processor_states",
    )

    op.drop_index(
        "ix_event_processor_states_detector_version",
        table_name="event_processor_states",
    )

    op.drop_index(
        "ix_event_processor_states_detector_name",
        table_name="event_processor_states",
    )

    op.drop_index(
        "ix_event_processor_states_worker_id",
        table_name="event_processor_states",
    )

    op.drop_index(
        "ix_event_processor_states_processor_name",
        table_name="event_processor_states",
    )

    op.drop_table(
        "event_processor_states"
    )
