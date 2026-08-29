from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Employee(Base):
    """
    Represents a simulated employee inside SENTINEL's fictional company.

    Each employee has a basic behavioral profile that will later be used by
    the simulator and anomaly-detection engine to generate and evaluate
    realistic activity.
    """

    __tablename__ = "employees"

    # Internal database identifier.
    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    # Human-readable SENTINEL identifier, e.g. user_001.
    user_id: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    department: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )

    job_role: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Typical working hours. These are behavioral baselines, not restrictions.
    normal_start_hour: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=9,
    )

    normal_end_hour: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=17,
    )

    typical_ip: Mapped[str] = mapped_column(
        String(45),
        nullable=False,
    )

    typical_location: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="Corporate Office",
    )

    # Approximate normal activity per working day.
    typical_login_frequency: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=2,
    )

    typical_files_accessed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=20,
    )

    typical_data_transfer_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=50_000_000,
    )

    # Flexible room for future behavioral attributes without constantly
    # changing the table schema.
    behavior_profile: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # One employee can generate many security events.
    events = relationship(
        "Event",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Employee user_id={self.user_id!r} "
            f"department={self.department!r}>"
        )