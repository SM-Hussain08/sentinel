from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.models import Employee, Event
from simulator.generators import EventFactory


class BruteForceScenario:
    """
    Simulates repeated authentication attempts against one employee account.
    """

    scenario_type = "BRUTE_FORCE"

    def __init__(self) -> None:
        self.factory = EventFactory()

    def generate(
        self,
        employee: Employee,
        start_time: datetime,
    ) -> list[Event]:
        attacker_ip = "203.0.113.81"

        session_id = (
            f"attack-{uuid4().hex[:12]}"
        )

        events: list[Event] = []

        failure_count = 18

        for attempt in range(
            failure_count
        ):
            timestamp = (
                start_time
                + timedelta(
                    seconds=attempt * 18,
                )
            )

            events.append(
                self.factory.create_event(
                    employee=employee,
                    timestamp=timestamp,
                    event_type="LOGIN_FAILURE",

                    source_ip=attacker_ip,
                    destination_ip="10.20.0.10",

                    source_location=(
                        "Unknown External Network"
                    ),

                    resource_type="AUTH_SERVER",
                    resource_name="corp-auth-01",

                    bytes_sent=1500,
                    bytes_received=750,

                    success=False,

                    session_id=session_id,

                    metadata={
                        "authentication_method": "PASSWORD",
                        "attempt_number": attempt + 1,
                    },

                    is_injected_anomaly=True,
                    scenario_type=self.scenario_type,
                )
            )

        return events