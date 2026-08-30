from datetime import datetime, timedelta
from uuid import uuid4

from app.models import Employee, Event
from simulator.generators import EventFactory


class NetworkScanScenario:
    """
    Simulates rapid probing of many internal hosts.
    """

    scenario_type = "NETWORK_SCAN"

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

        for host_number in range(
            10,
            50,
        ):
            destination_ip = (
                f"10.20.30."
                f"{host_number}"
            )

            events.append(
                self.factory.create_event(
                    employee=employee,

                    timestamp=(
                        start_time
                        + timedelta(
                            seconds=(
                                host_number - 10
                            )
                            * 2
                        )
                    ),

                    event_type="NETWORK_CONNECTION",

                    source_ip=source_ip,
                    destination_ip=destination_ip,

                    source_location=(
                        employee.typical_location
                    ),

                    resource_type="NETWORK_HOST",
                    resource_name=destination_ip,

                    bytes_sent=1200,
                    bytes_received=(
                        0
                        if host_number % 3
                        else 600
                    ),

                    success=True,

                    session_id=session_id,

                    metadata={
                        "probe_type": "TCP_CONNECT",
                        "target_port": (
                            20
                            + (
                                host_number % 10
                            )
                        ),
                    },

                    is_injected_anomaly=True,
                    scenario_type=self.scenario_type,
                )
            )

        return events