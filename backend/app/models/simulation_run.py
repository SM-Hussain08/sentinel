"""
Persistent runtime state for SENTINEL simulation workers.

A SimulationRun represents one execution/session of the live simulator.

Worker liveness is intentionally derived from database heartbeats rather
than Docker/container inspection. This keeps the application independent
of the infrastructure used to run the worker.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.session import Base


class SimulationRun(Base):
    """
    Persistent metadata and counters for one simulator execution.
    """

    __tablename__ = "simulation_runs"

    __table_args__ = (
        CheckConstraint(
            "mode IN ('live', 'development')",
            name="ck_simulation_runs_mode",
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
            name="ck_simulation_runs_status",
        ),
        CheckConstraint(
            "employees_loaded >= 0",
            name="ck_simulation_runs_employees_loaded",
        ),
        CheckConstraint(
            "events_generated >= 0",
            name="ck_simulation_runs_events_generated",
        ),
        CheckConstraint(
            "anomalies_scored >= 0",
            name="ck_simulation_runs_anomalies_scored",
        ),
        CheckConstraint(
            "incidents_created >= 0",
            name="ck_simulation_runs_incidents_created",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    # Human-readable operator/debugging identifier.
    run_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    mode: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        default="starting",
    )

    seed: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    # Identifies the worker process logically without coupling SENTINEL
    # to Docker container IDs.
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

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc
        ),
        index=True,
    )

    stopped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_heartbeat_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    employees_loaded: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    events_generated: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    anomalies_scored: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    incidents_created: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    configuration: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    runtime_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

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

    ground_truth_records = relationship(
        "SimulationGroundTruth",
        back_populates="simulation_run",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<SimulationRun "
            f"run_id={self.run_id!r} "
            f"status={self.status!r}>"
        )
