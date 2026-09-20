"""add simulation runtime and private ground truth

Revision ID: 7f3e9b2c4d10
Revises: 364902f30c1c
Create Date: 2026-09-16

"""

from typing import (
    Sequence,
    Union,
)

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "7f3e9b2c4d10"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "364902f30c1c"

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
    """
    Add persistent simulation runtime state and a private ground-truth layer.

    Existing events remain untouched in this migration. Removal/migration of
    legacy Event ground-truth fields is intentionally deferred to Phase 9.9.
    """

    op.create_table(
        "simulation_runs",

        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),

        sa.Column(
            "run_id",
            sa.String(
                length=50
            ),
            nullable=False,
        ),

        sa.Column(
            "mode",
            sa.String(
                length=30
            ),
            nullable=False,
        ),

        sa.Column(
            "status",
            sa.String(
                length=30
            ),
            nullable=False,
        ),

        sa.Column(
            "seed",
            sa.BigInteger(),
            nullable=True,
        ),

        sa.Column(
            "worker_id",
            sa.String(
                length=120
            ),
            nullable=True,
        ),

        sa.Column(
            "worker_version",
            sa.String(
                length=40
            ),
            nullable=False,
        ),

        sa.Column(
            "started_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=False,
        ),

        sa.Column(
            "stopped_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=True,
        ),

        sa.Column(
            "last_heartbeat_at",
            sa.DateTime(
                timezone=True
            ),
            nullable=True,
        ),

        sa.Column(
            "employees_loaded",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "events_generated",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "anomalies_scored",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "incidents_created",
            sa.BigInteger(),
            nullable=False,
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
                "mode IN "
                "('live', 'development')"
            ),
            name=(
                "ck_simulation_runs_mode"
            ),
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
            name=(
                "ck_simulation_runs_status"
            ),
        ),

        sa.CheckConstraint(
            "employees_loaded >= 0",
            name=(
                "ck_simulation_runs_"
                "employees_loaded"
            ),
        ),

        sa.CheckConstraint(
            "events_generated >= 0",
            name=(
                "ck_simulation_runs_"
                "events_generated"
            ),
        ),

        sa.CheckConstraint(
            "anomalies_scored >= 0",
            name=(
                "ck_simulation_runs_"
                "anomalies_scored"
            ),
        ),

        sa.CheckConstraint(
            "incidents_created >= 0",
            name=(
                "ck_simulation_runs_"
                "incidents_created"
            ),
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),
    )

    op.create_index(
        op.f(
            "ix_simulation_runs_run_id"
        ),
        "simulation_runs",
        [
            "run_id"
        ],
        unique=True,
    )

    op.create_index(
        op.f(
            "ix_simulation_runs_mode"
        ),
        "simulation_runs",
        [
            "mode"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_runs_status"
        ),
        "simulation_runs",
        [
            "status"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_runs_worker_id"
        ),
        "simulation_runs",
        [
            "worker_id"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_runs_started_at"
        ),
        "simulation_runs",
        [
            "started_at"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_runs_last_heartbeat_at"
        ),
        "simulation_runs",
        [
            "last_heartbeat_at"
        ],
        unique=False,
    )

    op.create_table(
        "simulation_ground_truth",

        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),

        sa.Column(
            "simulation_run_id",
            sa.Uuid(),
            nullable=False,
        ),

        sa.Column(
            "event_uuid",
            sa.Uuid(),
            nullable=False,
        ),

        sa.Column(
            "scenario_instance_id",
            sa.String(
                length=100
            ),
            nullable=True,
        ),

        sa.Column(
            "scenario_type",
            sa.String(
                length=80
            ),
            nullable=True,
        ),

        sa.Column(
            "is_injected",
            sa.Boolean(),
            nullable=False,
        ),

        sa.Column(
            "attack_stage",
            sa.String(
                length=80
            ),
            nullable=True,
        ),

        sa.Column(
            "sequence_number",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "ground_truth_metadata",
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

        sa.CheckConstraint(
            (
                "(is_injected = false) "
                "OR "
                "(scenario_type IS NOT NULL)"
            ),
            name=(
                "ck_simulation_ground_truth_"
                "injected_scenario"
            ),
        ),

        sa.CheckConstraint(
            (
                "sequence_number IS NULL "
                "OR sequence_number >= 1"
            ),
            name=(
                "ck_simulation_ground_truth_"
                "sequence"
            ),
        ),

        sa.ForeignKeyConstraint(
            [
                "event_uuid"
            ],
            [
                "events.id"
            ],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            [
                "simulation_run_id"
            ],
            [
                "simulation_runs.id"
            ],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id"
        ),

        sa.UniqueConstraint(
            "event_uuid",
            name=(
                "uq_simulation_ground_truth_event"
            ),
        ),
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_"
            "simulation_run_id"
        ),
        "simulation_ground_truth",
        [
            "simulation_run_id"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_event_uuid"
        ),
        "simulation_ground_truth",
        [
            "event_uuid"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_"
            "scenario_instance_id"
        ),
        "simulation_ground_truth",
        [
            "scenario_instance_id"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_scenario_type"
        ),
        "simulation_ground_truth",
        [
            "scenario_type"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_is_injected"
        ),
        "simulation_ground_truth",
        [
            "is_injected"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_attack_stage"
        ),
        "simulation_ground_truth",
        [
            "attack_stage"
        ],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_created_at"
        ),
        "simulation_ground_truth",
        [
            "created_at"
        ],
        unique=False,
    )


def downgrade() -> None:
    """
    Remove the Phase 9.8 simulation control-plane tables.
    """

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_created_at"
        ),
        table_name=(
            "simulation_ground_truth"
        ),
    )

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_attack_stage"
        ),
        table_name=(
            "simulation_ground_truth"
        ),
    )

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_is_injected"
        ),
        table_name=(
            "simulation_ground_truth"
        ),
    )

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_scenario_type"
        ),
        table_name=(
            "simulation_ground_truth"
        ),
    )

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_"
            "scenario_instance_id"
        ),
        table_name=(
            "simulation_ground_truth"
        ),
    )

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_event_uuid"
        ),
        table_name=(
            "simulation_ground_truth"
        ),
    )

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_"
            "simulation_run_id"
        ),
        table_name=(
            "simulation_ground_truth"
        ),
    )

    op.drop_table(
        "simulation_ground_truth"
    )

    op.drop_index(
        op.f(
            "ix_simulation_runs_last_heartbeat_at"
        ),
        table_name="simulation_runs",
    )

    op.drop_index(
        op.f(
            "ix_simulation_runs_started_at"
        ),
        table_name="simulation_runs",
    )

    op.drop_index(
        op.f(
            "ix_simulation_runs_worker_id"
        ),
        table_name="simulation_runs",
    )

    op.drop_index(
        op.f(
            "ix_simulation_runs_status"
        ),
        table_name="simulation_runs",
    )

    op.drop_index(
        op.f(
            "ix_simulation_runs_mode"
        ),
        table_name="simulation_runs",
    )

    op.drop_index(
        op.f(
            "ix_simulation_runs_run_id"
        ),
        table_name="simulation_runs",
    )

    op.drop_table(
        "simulation_runs"
    )
