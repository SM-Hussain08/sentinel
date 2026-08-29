from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Event(Base):
    """
    Represents a single security or activity event generated inside SENTINEL.

    Events are intentionally generic enough to represent authentication,
    file, database, and network activity in the same pipeline.
    """

    __tablename__ = "events"

    # Internal database primary key.
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    # Public event identifier used by the API and dashboard.
    # Example: EVT-2026-000001
    event_id: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        nullable=False,
        index=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Link the event to its employee.
    employee_id: Mapped[UUID] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    session_id: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
        index=True,
    )

    # Examples:
    # LOGIN_SUCCESS, FILE_ACCESS, NETWORK_CONNECTION
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    source_ip: Mapped[str] = mapped_column(
        String(45),
        nullable=False,
        index=True,
    )

    destination_ip: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    source_location: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    resource_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    resource_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    bytes_sent: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    bytes_received: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    success: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # Additional event-specific information can be stored here.
    # Example:
    # {
    #     "protocol": "HTTPS",
    #     "device": "workstation-17"
    # }
    event_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    # -----------------------------------------------------
    # SIMULATOR GROUND TRUTH
    # -----------------------------------------------------
    #
    # These fields are NEVER given to the ML model as features.
    #
    # They exist only so we can later evaluate whether the model
    # successfully detected incidents intentionally injected by
    # the simulator.
    is_injected_anomaly: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    scenario_type: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship(
        "Employee",
        back_populates="events",
    )

    def __repr__(self) -> str:
        return (
            f"<Event event_id={self.event_id!r} "
            f"event_type={self.event_type!r}>"
        )