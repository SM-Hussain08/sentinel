from datetime import datetime, timedelta
from uuid import uuid4

from app.models import Employee, Event
from simulator.generators import EventFactory


class DataExfiltrationScenario:
    """
    Simulates abnormal collection and external transfer of corporate data.
    """

    scenario_type = "DATA_EXFILTRATION"

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

        source_ip = employee.typical_ip

        events: list[Event] = []

        # Rapidly access multiple sensitive archives.
        for index in range(8):
            events.append(
                self.factory.create_event(
                    employee=employee,

                    timestamp=(
                        start_time
                        + timedelta(
                            seconds=index * 35,
                        )
                    ),

                    event_type="FILE_ACCESS",

                    source_ip=source_ip,
                    destination_ip="10.20.10.15",

                    source_location=(
                        employee.typical_location
                    ),

                    resource_type="FILE_SERVER",

                    resource_name=(
                        f"sensitive-archive-"
                        f"{index + 1:02d}.zip"
                    ),

                    bytes_received=(
                        5_000_000
                    ),

                    success=True,

                    session_id=session_id,

                    metadata={
                        "classification": "CONFIDENTIAL",
                    },

                    is_injected_anomaly=True,
                    scenario_type=self.scenario_type,
                )
            )

        # Large external transfer.
        events.append(
            self.factory.create_event(
                employee=employee,

                timestamp=(
                    start_time
                    + timedelta(
                        minutes=6,
                    )
                ),

                event_type="FILE_UPLOAD",

                source_ip=source_ip,
                destination_ip="203.0.113.200",

                source_location=(
                    employee.typical_location
                ),

                resource_type="EXTERNAL_STORAGE",
                resource_name="external-upload",

                bytes_sent=(
                    12_000_000_000
                ),

                bytes_received=25_000,

                success=True,

                session_id=session_id,

                metadata={
                    "destination_type": "EXTERNAL",
                    "protocol": "HTTPS",
                },

                is_injected_anomaly=True,
                scenario_type=self.scenario_type,
            )
        )

        return events