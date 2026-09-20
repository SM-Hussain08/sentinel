"""
add benchmark ground-truth provenance

Revision ID: d7f1a4b6c8e9
Revises: c6e0f3a9d4b5
Create Date: 2026-09-20

This migration separates two private ground-truth provenance paths:

1. live/development simulator truth
   -> simulation_run_id

2. controlled benchmark truth
   -> benchmark_batch_id

Exactly one provenance source must be present.
"""

from typing import (
    Sequence,
    Union,
)

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d7f1a4b6c8e9"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "c6e0f3a9d4b5"

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
    Allow ground truth to belong either to a simulator run
    or to a controlled benchmark batch.
    """

    op.add_column(
        "simulation_ground_truth",
        sa.Column(
            "benchmark_batch_id",
            sa.String(
                length=100,
            ),
            nullable=True,
        ),
    )

    op.alter_column(
        "simulation_ground_truth",
        "simulation_run_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )

    op.create_index(
        op.f(
            "ix_simulation_ground_truth_benchmark_batch_id"
        ),
        "simulation_ground_truth",
        [
            "benchmark_batch_id",
        ],
        unique=False,
    )

    op.create_check_constraint(
        "ck_simulation_ground_truth_provenance_xor",
        "simulation_ground_truth",
        (
            "("
            "simulation_run_id IS NOT NULL "
            "AND benchmark_batch_id IS NULL"
            ") "
            "OR "
            "("
            "simulation_run_id IS NULL "
            "AND benchmark_batch_id IS NOT NULL"
            ")"
        ),
    )


def downgrade() -> None:
    """
    Restore the original simulator-run-only provenance model.

    Benchmark-only ground-truth rows are evaluation artifacts,
    so they must be removed before simulation_run_id becomes
    non-nullable again.
    """

    op.drop_constraint(
        "ck_simulation_ground_truth_provenance_xor",
        "simulation_ground_truth",
        type_="check",
    )

    op.drop_index(
        op.f(
            "ix_simulation_ground_truth_benchmark_batch_id"
        ),
        table_name="simulation_ground_truth",
    )

    op.execute(
        sa.text(
            """
            DELETE FROM simulation_ground_truth
            WHERE benchmark_batch_id IS NOT NULL
            """
        )
    )

    op.drop_column(
        "simulation_ground_truth",
        "benchmark_batch_id",
    )

    op.alter_column(
        "simulation_ground_truth",
        "simulation_run_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )