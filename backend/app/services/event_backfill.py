"""
Historical Event discovery for explicit SENTINEL backfill.

Backfill eligibility:

- Event has no AnomalyScore for the currently selected detector version.
- Optional UTC date filtering uses Event.timestamp, not Event.created_at.
- Work is returned chronologically and deterministically.

This module only discovers work.
Actual processing belongs to EventProcessingService.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import (
    date,
    datetime,
    time,
    timedelta,
    timezone,
)

from sqlalchemy import (
    exists,
    select,
)

from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Event,
)

from app.selected_detector import (
    SELECTED_DETECTOR,
)


DEFAULT_BACKFILL_BATCH_SIZE = 100


@dataclass(
    frozen=True,
)
class BackfillDiscoveryResult:
    events: list[Event]

    requested_date: date | None

    detector_name: str

    detector_version: str

    @property
    def event_count(
        self,
    ) -> int:
        return len(
            self.events
        )


def utc_day_bounds(
    requested_date: date,
) -> tuple[
    datetime,
    datetime,
]:
    start = datetime.combine(
        requested_date,
        time.min,
        tzinfo=timezone.utc,
    )

    end = (
        start
        + timedelta(
            days=1
        )
    )

    return (
        start,
        end,
    )


def discover_unprocessed_events(
    *,
    db: Session,
    requested_date: date | None = None,
    batch_size: int = DEFAULT_BACKFILL_BATCH_SIZE,
) -> BackfillDiscoveryResult:
    """
    Discover selected-version-unprocessed Events.

    With requested_date=None:
        all currently unprocessed Events are eligible.

    With requested_date:
        only Events whose Event.timestamp falls within that UTC
        calendar day are eligible.
    """

    if batch_size < 1:
        raise ValueError(
            "batch_size must be >= 1."
        )

    already_scored = exists(
        select(
            AnomalyScore.id
        )
        .where(
            AnomalyScore.event_uuid
            == Event.id,

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    statement = (
        select(
            Event
        )
        .where(
            ~already_scored
        )
    )

    if requested_date is not None:
        start, end = utc_day_bounds(
            requested_date
        )

        statement = statement.where(
            Event.timestamp >= start,
            Event.timestamp < end,
        )

    statement = (
        statement
        .order_by(
            Event.timestamp.asc(),
            Event.created_at.asc(),
            Event.id.asc(),
        )
        .limit(
            batch_size
        )
    )

    events = list(
        db.scalars(
            statement
        ).all()
    )

    return BackfillDiscoveryResult(
        events=events,

        requested_date=(
            requested_date
        ),

        detector_name=(
            SELECTED_DETECTOR.name
        ),

        detector_version=(
            SELECTED_DETECTOR.version
        ),
    )


def count_unprocessed_events(
    *,
    db: Session,
    requested_date: date | None = None,
) -> int:
    """
    Count Events currently missing the selected detector version.
    """

    already_scored = exists(
        select(
            AnomalyScore.id
        )
        .where(
            AnomalyScore.event_uuid
            == Event.id,

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    statement = (
        select(
            Event.id
        )
        .where(
            ~already_scored
        )
    )

    if requested_date is not None:
        start, end = utc_day_bounds(
            requested_date
        )

        statement = statement.where(
            Event.timestamp >= start,
            Event.timestamp < end,
        )

    return len(
        list(
            db.scalars(
                statement
            ).all()
        )
    )
