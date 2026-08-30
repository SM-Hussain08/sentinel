from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.session import Base


class Incident(Base):
    """
    Correlated security incident produced from related anomalous activity.

    Incidents are derived only from observable event and anomaly data.
    Simulator ground-truth labels are never used by the correlation engine.
    """

    __tablename__ = "incidents"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    incident_id: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        index=True,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
    )

    incident_type: Mapped[str] = mapped_column(
        String(80),
        index=True,
        nullable=False,
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        index=True,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        index=True,
        nullable=False,
        default="OPEN",
    )

    primary_employee_id: Mapped[
        UUID | None
    ] = mapped_column(
        ForeignKey(
            "employees.id",
            ondelete="SET NULL",
        ),
        index=True,
        nullable=True,
    )

    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )

    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )

    event_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    anomaly_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    max_anomaly_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )

    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    correlation_reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    indicators: Mapped[
        list[dict[str, Any]]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    evidence: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    investigation_steps: Mapped[
        list[dict[str, Any]]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
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

    primary_employee = relationship(
        "Employee",
    )

    event_links = relationship(
        "IncidentEvent",
        back_populates="incident",
        cascade="all, delete-orphan",
    )


class IncidentEvent(Base):
    """
    Association between an incident and the security events supporting it.
    """

    __tablename__ = "incident_events"

    __table_args__ = (
        UniqueConstraint(
            "incident_uuid",
            "event_uuid",
            name="uq_incident_event",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    incident_uuid: Mapped[UUID] = mapped_column(
        ForeignKey(
            "incidents.id",
            ondelete="CASCADE",
        ),
        index=True,
        nullable=False,
    )

    event_uuid: Mapped[UUID] = mapped_column(
        ForeignKey(
            "events.id",
            ondelete="CASCADE",
        ),
        index=True,
        nullable=False,
    )

    sequence_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    correlation_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=1.0,
    )

    correlation_reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="",
    )

    incident = relationship(
        "Incident",
        back_populates="event_links",
    )

    event = relationship(
        "Event",
    )