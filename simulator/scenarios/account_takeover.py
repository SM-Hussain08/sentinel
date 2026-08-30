from datetime import datetime, timedelta
from uuid import uuid4

from app.models import Employee, Event
from simulator.generators import EventFactory


class AccountTakeoverScenario:
    """
    Simulates compromised credentials followed by suspicious account use.
    """

    scenario_type = "ACCOUNT_TAKEOVER"

    def __init__(self) -> None:
        self.factory = EventFactory()

    def generate(
        self,
        employee: Employee,
        start_time: datetime,
    ) -> list[Event]:
        attacker_ip = "203.0.113.122"

        session_id = (
            f"attack-{uuid4().hex[:12]}"
        )

        events: list[Event] = []

        # Initial credential guessing.
        for attempt in range(5):
            events.append(
                self.factory.create_event(
                    employee=employee,

                    timestamp=(
                        start_time
                        + timedelta(
                            seconds=attempt * 30,
                        )
                    ),

                    event_type="LOGIN_FAILURE",

                    source_ip=attacker_ip,
                    destination_ip="10.20.0.10",

                    source_location=(
                        "Unknown External Network"
                    ),

                    resource_type="AUTH_SERVER",
                    resource_name="corp-auth-01",

                    bytes_sent=1700,
                    bytes_received=850,

                    success=False,

                    session_id=session_id,

                    is_injected_anomaly=True,
                    scenario_type=self.scenario_type,
                )
            )

        compromise_time = (
            start_time
            + timedelta(
                minutes=3,
            )
        )

        events.append(
            self.factory.create_event(
                employee=employee,

                timestamp=compromise_time,

                event_type="LOGIN_SUCCESS",

                source_ip=attacker_ip,
                destination_ip="10.20.0.10",

                source_location=(
                    "Unknown External Network"
                ),

                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",

                bytes_sent=4500,
                bytes_received=12_000,

                success=True,

                session_id=session_id,

                metadata={
                    "device": "UNKNOWN-DEVICE",
                    "authentication_method": "PASSWORD",
                },

                is_injected_anomaly=True,
                scenario_type=self.scenario_type,
            )
        )

        events.append(
            self.factory.create_event(
                employee=employee,

                timestamp=(
                    compromise_time
                    + timedelta(
                        minutes=2,
                    )
                ),

                event_type="DATABASE_ACCESS",

                source_ip=attacker_ip,
                destination_ip="10.20.20.10",

                source_location=(
                    "Unknown External Network"
                ),

                resource_type="DATABASE",
                resource_name="corporate_erp",

                bytes_sent=40_000,
                bytes_received=12_000_000,

                success=True,

                session_id=session_id,

                metadata={
                    "operation": "SELECT",
                    "device": "UNKNOWN-DEVICE",
                },

                is_injected_anomaly=True,
                scenario_type=self.scenario_type,
            )
        )

        events.append(
            self.factory.create_event(
                employee=employee,

                timestamp=(
                    compromise_time
                    + timedelta(
                        minutes=4,
                    )
                ),

                event_type="FILE_DOWNLOAD",

                source_ip=attacker_ip,
                destination_ip="10.20.10.15",

                source_location=(
                    "Unknown External Network"
                ),

                resource_type="FILE_SERVER",
                resource_name="employee-records.zip",

                bytes_sent=10_000,
                bytes_received=350_000_000,

                success=True,

                session_id=session_id,

                metadata={
                    "classification": "CONFIDENTIAL",
                    "device": "UNKNOWN-DEVICE",
                },

                is_injected_anomaly=True,
                scenario_type=self.scenario_type,
            )
        )

        return events