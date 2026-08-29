from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EventBase(BaseModel):
    """
    Common security-event fields.

    The same structure supports authentication, file, database,
    and network events.
    """

    event_id: str = Field(
        min_length=5,
        max_length=40,
        examples=["EVT-2026-000001"],
    )

    timestamp: datetime

    session_id: str | None = Field(
        default=None,
        max_length=80,
    )

    event_type: str = Field(
        min_length=3,
        max_length=50,
        examples=["LOGIN_SUCCESS"],
    )

    source_ip: str = Field(
        max_length=45,
        examples=["10.20.3.44"],
    )

    destination_ip: str | None = Field(
        default=None,
        max_length=45,
    )

    source_location: str | None = Field(
        default=None,
        max_length=120,
    )

    resource_type: str | None = Field(
        default=None,
        max_length=50,
    )

    resource_name: str | None = Field(
        default=None,
        max_length=255,
    )

    bytes_sent: int = Field(
        default=0,
        ge=0,
    )

    bytes_received: int = Field(
        default=0,
        ge=0,
    )

    success: bool = True

    event_metadata: dict[str, Any] = Field(
        default_factory=dict,
    )


class EventCreate(EventBase):
    """
    Data used to create a security event.

    Ground-truth fields are included for the simulator but will never
    be exposed to the ML model as features.
    """

    employee_id: UUID

    is_injected_anomaly: bool = False

    scenario_type: str | None = Field(
        default=None,
        max_length=80,
    )


class EventRead(EventBase):
    """
    Event representation returned by the SENTINEL API.
    """

    id: UUID
    employee_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)