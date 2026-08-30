import random
from datetime import date, datetime, timedelta, timezone

from app.models import Employee, Event
from simulator.generators.event_factory import EventFactory


class NormalActivityGenerator:
    """
    Generates realistic normal corporate activity.

    Behavior is based on each employee's stored baseline and includes
    natural variation so that normal activity is not perfectly predictable.
    """

    def __init__(
        self,
        seed: int = 100,
    ) -> None:
        self.random = random.Random(
            seed,
        )

        self.event_factory = (
            EventFactory(
                starting_sequence=1000,
            )
        )

    def _working_start_time(
        self,
        employee: Employee,
        simulation_date: date,
    ) -> datetime:
        """
        Generate a slightly varied login time around the employee baseline.
        """

        minute_offset = int(
            employee.behavior_profile.get(
                "typical_start_minute_offset",
                0,
            )
        )

        random_variation = (
            self.random.randint(
                -20,
                20,
            )
        )

        total_minutes = (
            employee.normal_start_hour
            * 60
            + minute_offset
            + random_variation
        )

        hour = max(
            0,
            min(
                total_minutes // 60,
                23,
            ),
        )

        minute = (
            total_minutes % 60
        )

        return datetime(
            simulation_date.year,
            simulation_date.month,
            simulation_date.day,
            hour,
            minute,
            tzinfo=timezone.utc,
        )

    def _working_end_time(
        self,
        employee: Employee,
        simulation_date: date,
    ) -> datetime:
        """
        Generate a slightly varied logout time.
        """

        minute_offset = int(
            employee.behavior_profile.get(
                "typical_end_minute_offset",
                0,
            )
        )

        variation = self.random.randint(
            -20,
            30,
        )

        total_minutes = (
            employee.normal_end_hour
            * 60
            + minute_offset
            + variation
        )

        hour = max(
            0,
            min(
                total_minutes // 60,
                23,
            ),
        )

        minute = (
            total_minutes % 60
        )

        return datetime(
            simulation_date.year,
            simulation_date.month,
            simulation_date.day,
            hour,
            minute,
            tzinfo=timezone.utc,
        )

    def _source_identity(
        self,
        employee: Employee,
    ) -> tuple[str, str, bool]:
        """
        Decide whether this normal day is office-based or remote.

        Remote work is legitimate normal activity here, not automatically
        malicious behavior.
        """

        remote_probability = float(
            employee.behavior_profile.get(
                "remote_work_probability",
                0.0,
            )
        )

        is_remote = (
            self.random.random()
            < remote_probability
        )

        if not is_remote:
            return (
                employee.typical_ip,
                employee.typical_location,
                False,
            )

        # RFC 5737 documentation subnet.
        # Safe for synthetic/demo use.
        remote_ip = (
            f"198.51.100."
            f"{self.random.randint(10, 240)}"
        )

        return (
            remote_ip,
            "Remote / VPN",
            True,
        )

    def _random_timestamp_between(
        self,
        start: datetime,
        end: datetime,
    ) -> datetime:
        seconds = int(
            (
                end - start
            ).total_seconds()
        )

        if seconds <= 0:
            return start

        return (
            start
            + timedelta(
                seconds=self.random.randint(
                    0,
                    seconds,
                )
            )
        )

    def _login_events(
        self,
        employee: Employee,
        login_time: datetime,
        source_ip: str,
        location: str,
        is_remote: bool,
    ) -> list[Event]:
        events: list[Event] = []

        # A small amount of normal password failure is realistic.
        if self.random.random() < 0.08:
            failure_time = (
                login_time
                - timedelta(
                    minutes=self.random.randint(
                        1,
                        4,
                    )
                )
            )

            events.append(
                self.event_factory.create_event(
                    employee=employee,
                    timestamp=failure_time,
                    event_type="LOGIN_FAILURE",
                    source_ip=source_ip,
                    destination_ip="10.20.0.10",
                    source_location=location,
                    resource_type="AUTH_SERVER",
                    resource_name="corp-auth-01",
                    bytes_sent=1500,
                    bytes_received=900,
                    success=False,
                    metadata={
                        "remote": is_remote,
                        "authentication_method": "PASSWORD",
                    },
                )
            )

        events.append(
            self.event_factory.create_event(
                employee=employee,
                timestamp=login_time,
                event_type="LOGIN_SUCCESS",
                source_ip=source_ip,
                destination_ip="10.20.0.10",
                source_location=location,
                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",
                bytes_sent=self.random.randint(
                    3000,
                    7000,
                ),
                bytes_received=self.random.randint(
                    8000,
                    18000,
                ),
                success=True,
                metadata={
                    "remote": is_remote,
                    "authentication_method": "PASSWORD",
                    "device": employee.behavior_profile.get(
                        "typical_device",
                        "WORKSTATION",
                    ),
                },
            )
        )

        return events

    def _file_events(
        self,
        employee: Employee,
        start: datetime,
        end: datetime,
        source_ip: str,
        location: str,
    ) -> list[Event]:
        events: list[Event] = []

        variation = float(
            employee.behavior_profile.get(
                "daily_activity_variation",
                0.20,
            )
        )

        baseline = (
            employee.typical_files_accessed
        )

        lower = max(
            1,
            int(
                baseline
                * (1 - variation)
            ),
        )

        upper = max(
            lower,
            int(
                baseline
                * (1 + variation)
            ),
        )

        file_count = self.random.randint(
            lower,
            upper,
        )

        # We do not create one event for every theoretical read.
        # This models meaningful logged file operations.
        logged_file_events = max(
            3,
            min(
                file_count // 3,
                35,
            ),
        )

        for index in range(
            logged_file_events
        ):
            timestamp = (
                self._random_timestamp_between(
                    start,
                    end,
                )
            )

            event_type = self.random.choices(
                [
                    "FILE_ACCESS",
                    "FILE_DOWNLOAD",
                    "FILE_UPLOAD",
                ],
                weights=[
                    0.68,
                    0.20,
                    0.12,
                ],
                k=1,
            )[0]

            extension = self.random.choice(
                [
                    "pdf",
                    "xlsx",
                    "docx",
                    "csv",
                    "json",
                    "log",
                    "zip",
                ]
            )

            resource_name = (
                f"corporate-file-"
                f"{self.random.randint(1, 900):04d}"
                f".{extension}"
            )

            bytes_sent = 0
            bytes_received = 0

            if event_type == "FILE_ACCESS":
                bytes_received = (
                    self.random.randint(
                        5_000,
                        300_000,
                    )
                )

            elif event_type == "FILE_DOWNLOAD":
                bytes_received = (
                    self.random.randint(
                        100_000,
                        30_000_000,
                    )
                )

            elif event_type == "FILE_UPLOAD":
                bytes_sent = (
                    self.random.randint(
                        100_000,
                        20_000_000,
                    )
                )

            events.append(
                self.event_factory.create_event(
                    employee=employee,
                    timestamp=timestamp,
                    event_type=event_type,
                    source_ip=source_ip,
                    destination_ip="10.20.10.15",
                    source_location=location,
                    resource_type="FILE_SERVER",
                    resource_name=resource_name,
                    bytes_sent=bytes_sent,
                    bytes_received=bytes_received,
                    success=True,
                    metadata={
                        "share": "corporate-files",
                        "classification": self.random.choice(
                            [
                                "INTERNAL",
                                "INTERNAL",
                                "INTERNAL",
                                "CONFIDENTIAL",
                            ]
                        ),
                    },
                )
            )

        return events

    def _database_events(
        self,
        employee: Employee,
        start: datetime,
        end: datetime,
        source_ip: str,
        location: str,
    ) -> list[Event]:
        probability = float(
            employee.behavior_profile.get(
                "database_access_probability",
                0.0,
            )
        )

        if (
            self.random.random()
            >= probability
        ):
            return []

        event_count = self.random.randint(
            1,
            4,
        )

        events: list[Event] = []

        for _ in range(event_count):
            events.append(
                self.event_factory.create_event(
                    employee=employee,
                    timestamp=self._random_timestamp_between(
                        start,
                        end,
                    ),
                    event_type="DATABASE_ACCESS",
                    source_ip=source_ip,
                    destination_ip="10.20.20.10",
                    source_location=location,
                    resource_type="DATABASE",
                    resource_name=self.random.choice(
                        [
                            "corporate_erp",
                            "analytics",
                            "crm",
                            "finance_reporting",
                        ]
                    ),
                    bytes_sent=self.random.randint(
                        2_000,
                        100_000,
                    ),
                    bytes_received=self.random.randint(
                        20_000,
                        5_000_000,
                    ),
                    success=True,
                    metadata={
                        "operation": self.random.choice(
                            [
                                "SELECT",
                                "SELECT",
                                "REPORT",
                            ]
                        ),
                    },
                )
            )

        return events

    def _network_events(
        self,
        employee: Employee,
        start: datetime,
        end: datetime,
        source_ip: str,
        location: str,
    ) -> list[Event]:
        probability = float(
            employee.behavior_profile.get(
                "network_activity_probability",
                0.0,
            )
        )

        if (
            self.random.random()
            >= probability
        ):
            return []

        event_count = self.random.randint(
            1,
            5,
        )

        protocols = list(
            employee.behavior_profile.get(
                "common_protocols",
                [
                    "HTTPS",
                ],
            )
        )

        events: list[Event] = []

        for _ in range(event_count):
            protocol = (
                self.random.choice(
                    protocols
                )
            )

            events.append(
                self.event_factory.create_event(
                    employee=employee,
                    timestamp=self._random_timestamp_between(
                        start,
                        end,
                    ),
                    event_type="NETWORK_CONNECTION",
                    source_ip=source_ip,
                    destination_ip=(
                        f"10.20."
                        f"{self.random.randint(30, 40)}."
                        f"{self.random.randint(10, 220)}"
                    ),
                    source_location=location,
                    resource_type="NETWORK_SERVICE",
                    resource_name=f"{protocol.lower()}-service",
                    bytes_sent=self.random.randint(
                        10_000,
                        3_000_000,
                    ),
                    bytes_received=self.random.randint(
                        10_000,
                        8_000_000,
                    ),
                    success=True,
                    metadata={
                        "protocol": protocol,
                    },
                )
            )

        return events

    def generate_employee_day(
        self,
        employee: Employee,
        simulation_date: date,
    ) -> list[Event]:
        """
        Generate one employee's normal activity for one simulated day.
        """

        # Most office employees do not work weekends.
        if (
            simulation_date.weekday()
            >= 5
            and self.random.random()
            > 0.08
        ):
            return []

        login_time = (
            self._working_start_time(
                employee,
                simulation_date,
            )
        )

        logout_time = (
            self._working_end_time(
                employee,
                simulation_date,
            )
        )

        source_ip, location, is_remote = (
            self._source_identity(
                employee
            )
        )

        events: list[Event] = []

        events.extend(
            self._login_events(
                employee=employee,
                login_time=login_time,
                source_ip=source_ip,
                location=location,
                is_remote=is_remote,
            )
        )

        activity_start = (
            login_time
            + timedelta(
                minutes=10,
            )
        )

        activity_end = (
            logout_time
            - timedelta(
                minutes=10,
            )
        )

        events.extend(
            self._file_events(
                employee=employee,
                start=activity_start,
                end=activity_end,
                source_ip=source_ip,
                location=location,
            )
        )

        events.extend(
            self._database_events(
                employee=employee,
                start=activity_start,
                end=activity_end,
                source_ip=source_ip,
                location=location,
            )
        )

        events.extend(
            self._network_events(
                employee=employee,
                start=activity_start,
                end=activity_end,
                source_ip=source_ip,
                location=location,
            )
        )

        events.append(
            self.event_factory.create_event(
                employee=employee,
                timestamp=logout_time,
                event_type="LOGOUT",
                source_ip=source_ip,
                destination_ip="10.20.0.10",
                source_location=location,
                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",
                success=True,
                metadata={
                    "remote": is_remote,
                },
            )
        )

        return sorted(
            events,
            key=lambda event: event.timestamp,
        )