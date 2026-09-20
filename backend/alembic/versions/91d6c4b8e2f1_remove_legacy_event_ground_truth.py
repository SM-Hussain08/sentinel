"""
remove legacy Event ground-truth columns

Revision ID: 91d6c4b8e2f1
Revises: 7f3e9b2c4d10
Create Date: 2026-09-16
"""

from typing import (
    Sequence,
    Union,
)

from alembic import op
import sqlalchemy as sa


revision: str = (
    "91d6c4b8e2f1"
)

down_revision: Union[
    str,
    Sequence[str],
    None,
] = (
    "7f3e9b2c4d10"
)

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
    Remove simulator/evaluation truth from the operational Event table.

    Historical truth must already be preserved in
    simulation_ground_truth before this migration is applied.
    """

    op.drop_column(
        "events",
        "scenario_type",
    )

    op.drop_column(
        "events",
        "is_injected_anomaly",
    )


def downgrade() -> None:
    """
    Restore the legacy columns structurally only.

    Downgrade does not reconstruct historical labels from private truth.
    """

    op.add_column(
        "events",
        sa.Column(
            "is_injected_anomaly",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "events",
        sa.Column(
            "scenario_type",
            sa.String(
                length=80
            ),
            nullable=True,
        ),
    )
