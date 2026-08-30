from datetime import datetime
from uuid import uuid4

from app.models import Employee, Event


class EventFactory:
    """
    Creates consistent security events for SENTINEL simulations.

    Event IDs use UUID-derived identifiers so independently executed
    generators cannot accidentally create duplicate public event IDs.
    """

    def _generate_event_id(self) -> str:
        """
        Generate a globally unique, compact SENTINEL event identifier.

        Example:
            EVT-A19F8407D21C
        """

        return (
            f"EVT-"
            f"{uuid4().hex[:12].upper()}"
        )

    def create_event(
        self,
        *,
        employee: Employee,
        timestamp: datetime,
        event_type: str,
        source_ip: str,
        destination_ip: str | None = None,
        source_location: str | None = None,
        resource_type: str | None = None,
        resource_name: str | None = None,
        bytes_sent: int = 0,
        bytes_received: int = 0,
        success: bool = True,
        metadata: dict | None = None,
        session_id: str | None = None,
        is_injected_anomaly: bool = False,
        scenario_type: str | None = None,
    ) -> Event:
        """
        Build one Event object without writing it to PostgreSQL.

        Attack scenarios may pass the same session_id to several related
        events so SENTINEL can correlate them later into one incident.
        """

        return Event(
            event_id=self._generate_event_id(),

            employee_id=employee.id,

            timestamp=timestamp,

            session_id=(
                session_id
                or f"session-{uuid4().hex[:12]}"
            ),

            event_type=event_type,

            source_ip=source_ip,
            destination_ip=destination_ip,

            source_location=source_location,

            resource_type=resource_type,
            resource_name=resource_name,

            bytes_sent=max(
                bytes_sent,
                0,
            ),

            bytes_received=max(
                bytes_received,
                0,
            ),

            success=success,

            event_metadata=(
                metadata or {}
            ),

            is_injected_anomaly=(
                is_injected_anomaly
            ),

            scenario_type=scenario_type,
        )