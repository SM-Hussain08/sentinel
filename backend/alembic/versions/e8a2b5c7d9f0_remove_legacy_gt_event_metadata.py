"""
remove legacy ground-truth metadata from events

Revision ID: e8a2b5c7d9f0
Revises: d7f1a4b6c8e9
Create Date: 2026-09-20
"""

from typing import (
    Sequence,
    Union,
)

from alembic import op


revision: str = (
    "e8a2b5c7d9f0"
)

down_revision: Union[
    str,
    Sequence[str],
    None,
] = (
    "d7f1a4b6c8e9"
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
    Remove legacy simulation/evaluation provenance
    from operational Event metadata.

    Ground truth is already persisted separately in
    simulation_ground_truth.

    PostgreSQL JSONB subtraction preserves every
    unrelated metadata key.
    """

    op.execute(
        """
        UPDATE events
        SET event_metadata =
            event_metadata
            - 'simulation_batch'
            - 'scenario_type'
            - 'attack_stage'
            - 'is_injected'
        WHERE
            event_metadata ? 'simulation_batch'
            OR event_metadata ? 'scenario_type'
            OR event_metadata ? 'attack_stage'
            OR event_metadata ? 'is_injected'
        """
    )


def downgrade() -> None:
    """
    This sanitization is intentionally irreversible.

    Legacy ground-truth metadata must not be restored
    to operational Event rows. Authoritative truth
    remains in simulation_ground_truth.
    """

    pass