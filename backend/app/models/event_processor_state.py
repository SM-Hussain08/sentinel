"""
Persistent runtime state for SENTINEL's always-on event processor.

The event processor is independent from all event producers.

Its responsibilities are to observe newly arrived Event rows and
orchestrate:

    Event
      -> feature engineering
      -> selected anomaly detector
      -> AnomalyScore
      -> incremental incident correlation

The processor state records lifecycle, health, counters, detector
lineage, and—most importantly—the activation boundary that separates
live processing from explicit historical backfill.
"""

from datetime import (
    datetime,
    timezone,
)
from typing import Any
from uuid import (
    UUID,
    uuid4,
)

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.database.session import Base


class EventProcessorState(Base):
    """
    Persistent state for one processor/detector generation.

    A row is uniquely identified by:

        processor_name
        detector_name
        detector_version

    The activation timestamp is intentionally persistent across worker
    restarts. Therefore a crash/restart does not move the live-processing
    boundary forward and accidentally skip events that arrived while the
    processor was unavailable.
    """

    __tablename__ = "event_processor_states"

    __table_args__ = (
        UniqueConstraint(
            "processor_name",
            "detector_name",
            "detector_version",
            name="uq_event_processor_identity",
        ),

        CheckConstraint(
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

        CheckConstraint(
            "events_processed >= 0",
            name="ck_event_processor_states_events_processed",
        ),

        CheckConstraint(
            "scores_created >= 0",
            name="ck_event_processor_states_scores_created",
        ),

        CheckConstraint(
            "incidents_created >= 0",
            name="ck_event_processor_states_incidents_created",
        ),

        CheckConstraint(
            "incidents_updated >= 0",
            name="ck_event_processor_states_incidents_updated",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    # --------------------------------------------------------
    # Processor identity
    # --------------------------------------------------------

    processor_name: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )

    worker_id: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )

    worker_version: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="1.0",
    )

    # --------------------------------------------------------
    # Detector lineage
    # --------------------------------------------------------

    detector_name: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )

    detector_version: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------------
    # Lifecycle
    # --------------------------------------------------------

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        default="starting",
    )

    activated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=lambda: datetime.now(
            timezone.utc
        ),
    )

    last_heartbeat_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    stopped_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # --------------------------------------------------------
    # Operational counters
    # --------------------------------------------------------

    events_processed: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    scores_created: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    incidents_created: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    incidents_updated: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    # --------------------------------------------------------
    # Diagnostics / metadata
    # --------------------------------------------------------

    last_error: Mapped[
        str | None
    ] = mapped_column(
        Text,
        nullable=True,
    )

    configuration: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    runtime_metadata: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    # --------------------------------------------------------
    # Audit timestamps
    # --------------------------------------------------------

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc
        ),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc
        ),
        onupdate=lambda: datetime.now(
            timezone.utc
        ),
    )

    def __repr__(
        self,
    ) -> str:
        return (
            "<EventProcessorState "
            f"processor_name={self.processor_name!r} "
            f"detector={self.detector_name!r} "
            f"version={self.detector_version!r} "
            f"status={self.status!r}>"
        )
