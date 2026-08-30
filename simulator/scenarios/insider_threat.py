from datetime import datetime, timedelta
from uuid import uuid4

from app.models import Employee, Event
from simulator.generators import EventFactory


class InsiderThreatScenario:
    """
    Simulates a legitimate employee abusing valid access privileges.
    """

    scenario_type = "INSIDER_THREAT"

    def __init__(self) -> None:
        self.factory = EventFactory()

    def generate(
        self,
        employee: Employee,
        start_time: datetime,
    ) -> list[Event]:
        session_id = (
            f"attack-{uuid4().hex[:12]}"
        )

        events: list[Event] = []

        # Legitimate login from normal workstation.
        events.append(
            self.factory.create_event(
                employee=employee,

                timestamp=start_time,

                event_type="LOGIN_SUCCESS",

                source_ip=employee.typical_ip,
                destination_ip="10.20.0.10",

                source_location=(
                    employee.typical_location
                ),

                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",

                bytes_sent=4500,
                bytes_received=13_000,

                success=True,

                session_id=session_id,

                metadata={
                    "device": employee.behavior_profile.get(
                        "typical_device",
                        "WORKSTATION",
                    ),
                },

                is_injected_anomaly=True,
                scenario_type=self.scenario_type,
            )
        )

        # Unusual access to sensitive resources.
        for index in range(12):
            events.append(
                self.factory.create_event(
                    employee=employee,

                    timestamp=(
                        start_time
                        + timedelta(
                            minutes=3 + index,
                        )
                    ),

                    event_type="FILE_ACCESS",

                    source_ip=employee.typical_ip,
                    destination_ip="10.20.10.15",

                    source_location=(
                        employee.typical_location
                    ),

                    resource_type="FILE_SERVER",

                    resource_name=(
                        f"executive-confidential-"
                        f"{index + 1:02d}.pdf"
                    ),

                    bytes_received=(
                        8_000_000
                    ),

                    success=True,

                    session_id=session_id,

                    metadata={
                        "classification": "RESTRICTED",
                    },

                    is_injected_anomaly=True,
                    scenario_type=self.scenario_type,
                )
            )

        events.append(
            self.factory.create_event(
                employee=employee,

                timestamp=(
                    start_time
                    + timedelta(
                        minutes=18,
                    )
                ),

                event_type="FILE_DOWNLOAD",

                source_ip=employee.typical_ip,
                destination_ip="10.20.10.15",

                source_location=(
                    employee.typical_location
                ),

                resource_type="FILE_SERVER",
                resource_name="executive-archive.zip",

                bytes_received=(
                    2_500_000_000
                ),

                success=True,

                session_id=session_id,

                metadata={
                    "classification": "RESTRICTED",
                },

                is_injected_anomaly=True,
                scenario_type=self.scenario_type,
            )
        )

        return events