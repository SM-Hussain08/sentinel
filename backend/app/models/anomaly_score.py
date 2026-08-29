from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class AnomalyScore(Base):
    """
    Stores the result produced when a SENTINEL detector analyzes an event.

    Keeping anomaly results in their own table allows us to compare different
    detector versions later, including the temporary behavioral scorer and
    the final Isolation Forest model.
    """

    __tablename__ = "anomaly_scores"

    __table_args__ = (
        UniqueConstraint(
            "event_uuid",
            "detector_name",
            "detector_version",
            name="uq_anomaly_event_detector_version",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    event_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Detector metadata means that later we can compare:
    #
    # behavioral-baseline-v1
    # isolation-forest-v1
    # isolation-forest-v2
    detector_name: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    detector_version: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    detector_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    # Raw value produced by the detector.
    raw_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # Normalized display score between 0 and 1.
    anomaly_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        index=True,
    )

    risk_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    # Snapshot of the behavioral features used for this decision.
    #
    # This makes every anomaly decision explainable and inspectable.
    feature_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    # Human-readable reasons behind the score.
    explanation: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    event = relationship(
        "Event",
        back_populates="anomaly_scores",
    )

    def __repr__(self) -> str:
        return (
            f"<AnomalyScore score={self.anomaly_score:.3f} "
            f"risk={self.risk_level!r}>"
        )