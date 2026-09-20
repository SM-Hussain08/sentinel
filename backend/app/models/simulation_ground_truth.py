"""
Private simulator and benchmark ground-truth storage.

This table belongs to SENTINEL's simulation/evaluation control plane.

It must never be used as:
- an ML feature source;
- an anomaly scoring input;
- an incident correlation input;
- AI investigation evidence;
- a normal frontend/API data source.

Ground truth exists so SENTINEL can evaluate itself without telling the
detection pipeline which events were injected attacks.

Provenance
----------
Each record belongs to exactly one private evaluation source:

1. live/development simulator run
   -> simulation_run_id

2. controlled reproducible benchmark batch
   -> benchmark_batch_id
"""

from __future__ import annotations

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
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.session import Base


class SimulationGroundTruth(Base):
    """
    Private evaluation truth associated with one observable Event.
    """

    __tablename__ = (
        "simulation_ground_truth"
    )

    __table_args__ = (
        UniqueConstraint(
            "event_uuid",
            name=(
                "uq_simulation_ground_truth_event"
            ),
        ),

        CheckConstraint(
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

        CheckConstraint(
            (
                "sequence_number IS NULL "
                "OR sequence_number >= 1"
            ),
            name=(
                "ck_simulation_ground_truth_"
                "sequence"
            ),
        ),

        CheckConstraint(
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
            name=(
                "ck_simulation_ground_truth_"
                "provenance_xor"
            ),
        ),
    )


    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )


    # ========================================================
    # Private provenance
    # ========================================================

    simulation_run_id: Mapped[
        UUID | None
    ] = mapped_column(
        ForeignKey(
            "simulation_runs.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )


    benchmark_batch_id: Mapped[
        str | None
    ] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )


    # ========================================================
    # Observable event relationship
    # ========================================================

    event_uuid: Mapped[UUID] = mapped_column(
        ForeignKey(
            "events.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )


    # ========================================================
    # Private attack semantics
    # ========================================================

    # Shared by all events belonging to one injected campaign.
    scenario_instance_id: Mapped[
        str | None
    ] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )


    scenario_type: Mapped[
        str | None
    ] = mapped_column(
        String(80),
        nullable=True,
        index=True,
    )


    is_injected: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )


    # Optional semantic phase such as:
    # credential_access, discovery, collection, exfiltration.
    attack_stage: Mapped[
        str | None
    ] = mapped_column(
        String(80),
        nullable=True,
        index=True,
    )


    # Ordering within one scenario/campaign.
    sequence_number: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )


    ground_truth_metadata: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )


    created_at: Mapped[
        datetime
    ] = mapped_column(
        DateTime(
            timezone=True,
        ),
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc
        ),
        index=True,
    )


    # ========================================================
    # Relationships
    # ========================================================

    simulation_run = relationship(
        "SimulationRun",
        back_populates=(
            "ground_truth_records"
        ),
    )


    event = relationship(
        "Event",
    )


    def __repr__(
        self,
    ) -> str:
        return (
            f"<SimulationGroundTruth "
            f"scenario={self.scenario_type!r} "
            f"event_uuid={self.event_uuid!r}>"
        )