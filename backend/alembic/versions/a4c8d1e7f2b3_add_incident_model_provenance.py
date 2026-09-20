"""add incident model provenance

Revision ID: a4c8d1e7f2b3
Revises: 91d6c4b8e2f1
Create Date: 2026-09-17

Phase 9.12 introduces first-class detector and correlation-engine
provenance on Incident.

Existing incidents already contain this information inside their
evidence JSON. The migration therefore preserves historical lineage by
backfilling the new columns from each incident's own evidence payload.

The columns are made NOT NULL only after the backfill completes.
"""

from typing import (
    Sequence,
    Union,
)

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4c8d1e7f2b3"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "91d6c4b8e2f1"

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
    # --------------------------------------------------------
    # Add columns as nullable first so historical rows can be
    # backfilled safely before NOT NULL constraints are applied.
    # --------------------------------------------------------

    op.add_column(
        "incidents",
        sa.Column(
            "detector_name",
            sa.String(length=80),
            nullable=True,
        ),
    )

    op.add_column(
        "incidents",
        sa.Column(
            "detector_version",
            sa.String(length=40),
            nullable=True,
        ),
    )

    op.add_column(
        "incidents",
        sa.Column(
            "correlation_engine",
            sa.String(length=80),
            nullable=True,
        ),
    )

    op.add_column(
        "incidents",
        sa.Column(
            "correlation_version",
            sa.String(length=40),
            nullable=True,
        ),
    )

    # --------------------------------------------------------
    # Preserve historical provenance.
    #
    # Existing Phase 5 incidents stored detector/correlation
    # identity inside evidence JSON.
    #
    # COALESCE fallbacks protect migration integrity if a legacy
    # row is ever missing one of those JSON keys.
    # --------------------------------------------------------

    op.execute(
        """
        UPDATE incidents
        SET
            detector_name = COALESCE(
                evidence ->> 'detector_name',
                'isolation-forest'
            ),
            detector_version = COALESCE(
                evidence ->> 'detector_version',
                '1.1'
            ),
            correlation_engine = COALESCE(
                evidence ->> 'correlation_engine',
                'multi-signal-rules'
            ),
            correlation_version = COALESCE(
                evidence ->> 'correlation_version',
                '1.0'
            )
        """
    )

    # --------------------------------------------------------
    # Provenance is mandatory for every incident.
    # --------------------------------------------------------

    op.alter_column(
        "incidents",
        "detector_name",
        existing_type=sa.String(length=80),
        nullable=False,
    )

    op.alter_column(
        "incidents",
        "detector_version",
        existing_type=sa.String(length=40),
        nullable=False,
    )

    op.alter_column(
        "incidents",
        "correlation_engine",
        existing_type=sa.String(length=80),
        nullable=False,
    )

    op.alter_column(
        "incidents",
        "correlation_version",
        existing_type=sa.String(length=40),
        nullable=False,
    )

    # Detector identity is commonly queried by APIs and correlation logic.
    op.create_index(
        "ix_incidents_detector_name",
        "incidents",
        [
            "detector_name",
        ],
        unique=False,
    )

    op.create_index(
        "ix_incidents_detector_version",
        "incidents",
        [
            "detector_version",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_incidents_detector_version",
        table_name="incidents",
    )

    op.drop_index(
        "ix_incidents_detector_name",
        table_name="incidents",
    )

    op.drop_column(
        "incidents",
        "correlation_version",
    )

    op.drop_column(
        "incidents",
        "correlation_engine",
    )

    op.drop_column(
        "incidents",
        "detector_version",
    )

    op.drop_column(
        "incidents",
        "detector_name",
    )
