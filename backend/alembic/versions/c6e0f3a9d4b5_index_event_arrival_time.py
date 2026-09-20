"""index event arrival time

Revision ID: c6e0f3a9d4b5
Revises: b5d9e2f8c3a4
Create Date: 2026-09-17

The always-on SENTINEL processor discovers newly arrived events using
Event.created_at rather than the security-event timestamp.

An index on created_at keeps repeated live polling efficient as the
operational event table grows.
"""

from typing import (
    Sequence,
    Union,
)

from alembic import op


revision: str = "c6e0f3a9d4b5"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "b5d9e2f8c3a4"

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
    op.create_index(
        "ix_events_created_at",
        "events",
        [
            "created_at",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_events_created_at",
        table_name="events",
    )
