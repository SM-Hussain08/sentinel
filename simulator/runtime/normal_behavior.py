"""
Live normal-behavior engine for SENTINEL.

Unlike the benchmark's NormalActivityGenerator, this engine does not
generate an entire employee-day in one call.

Instead, it maintains an employee's live session and emits one
observable event at a time as simulated time advances.
"""

from __future__ import annotations

from datetime import (
    date,
    datetime,
    time,
    timedelta,
    timezone,
)
import random
from uuid import uuid4

from app.models import (
    Employee,
    Event,
)

from simulator.generators import (
    EventFactory,
)

from simulator.runtime.state import (
    EmployeeRuntimeState,
)


# ============================================================
# Department behavior profiles
# ============================================================

DEPARTMENT_ACTIVITY_WEIGHTS: dict[
    str,
    dict[str, float],
] = {
    "Engineering": {
        "file": 0.42,
        "database": 0.18,
        "network": 0.40,
    },

    "Finance": {
        "file": 0.56,
        "database": 0.32,
        "network": 0.12,
    },

    "Sales": {
        "file": 0.60,
        "database": 0.10,
        "network": 0.30,
    },

    "IT Operations": {
        "file": 0.24,
        "database": 0.24,
        "network": 0.52,
    },

    "Human Resources": {
        "file": 0.70,
        "database": 0.20,
        "network": 0.10,
    },
}


DEFAULT_ACTIVITY_WEIGHTS = {
    "file": 0.58,
    "database": 0.16,
    "network": 0.26,
}


# ============================================================
# Live behavior engine
# ============================================================

class LiveNormalBehaviorEngine:
    """
    Generate realistic normal corporate activity one event at a time.

    This engine owns no database transaction.

    It constructs Event objects and updates ephemeral employee runtime
    state. Persistence remains the responsibility of the live worker.
    """

    def __init__(
        self,
        *,
        seed: int,
    ) -> None:
        self.random = random.Random(
            seed
        )

        self.factory = EventFactory()

    # ========================================================
    # Employee state
    # ========================================================

    def build_employee_state(
        self,
        employee: Employee,
    ) -> EmployeeRuntimeState:
        """
        Create runtime state from one persisted Employee baseline.
        """

        return EmployeeRuntimeState(
            employee_id=employee.id,
            user_id=employee.user_id,
            department=employee.department,
            job_role=employee.job_role,
            normal_start_hour=(
                employee.normal_start_hour
            ),
            normal_end_hour=(
                employee.normal_end_hour
            ),
            typical_ip=employee.typical_ip,
            typical_location=(
                employee.typical_location
            ),
            behavior_profile=dict(
                employee.behavior_profile
                or {}
            ),
        )

    # ========================================================
    # Workday scheduling
    # ========================================================

    def schedule_initial_activity(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
        simulated_now: datetime,
    ) -> None:
        """
        Initialize one employee relative to the current simulated time.

        If the worker begins before the employee's workday, schedule their
        login normally.

        If the worker starts during the employee's existing workday, restore
        a plausible already-active session instead of pretending the employee
        will not work until tomorrow.

        If today's workday has finished, schedule the next login.
        """

        today = (
            simulated_now
            .astimezone(
                timezone.utc
            )
            .date()
        )

        # Most employees do not work weekends.
        if today.weekday() >= 5:
            state.next_activity_at = (
                self._next_login_time(
                    employee=employee,
                    after=simulated_now,
                )
            )

            return

        login_time = (
            self._planned_login_time(
                employee=employee,
                work_date=today,
            )
        )

        logout_time = (
            self._planned_logout_time(
                employee=employee,
                login_time=login_time,
            )
        )

        # Workday has not begun yet.
        if simulated_now < login_time:
            state.next_activity_at = (
                login_time
            )

            return

        # Today's workday is already over.
        if simulated_now >= logout_time:
            state.next_activity_at = (
                self._next_login_time(
                    employee=employee,
                    after=(
                        simulated_now
                        + timedelta(
                            minutes=1
                        )
                    ),
                )
            )

            return

        # ----------------------------------------------------
        # Mid-day worker startup
        # ----------------------------------------------------
        #
        # The simulator started while this employee would
        # already be working.
        #
        # We restore a plausible active session rather than
        # generating a fake historical login event.
        # ----------------------------------------------------

        source_ip, location, is_remote = (
            self._choose_source_context(
                employee
            )
        )

        session_id = (
            f"session-{uuid4().hex[:12]}"
        )

        # A restored mid-day session should resume naturally soon after
        # worker startup, but employees must not all fire simultaneously.
        #
        # Subsequent events use the employee's normal calibrated cadence.
        next_activity = (
            simulated_now
            + timedelta(
                minutes=self.random.randint(
                    4,
                    24,
                )
            )
        )

        if next_activity > logout_time:
            next_activity = logout_time

        state.begin_session(
            session_id=session_id,
            source_ip=source_ip,
            source_location=location,
            is_remote=is_remote,
            login_time=login_time,
            logout_time=logout_time,
            next_activity_at=next_activity,
        )

    def _next_login_time(
        self,
        *,
        employee: Employee,
        after: datetime,
    ) -> datetime:
        """
        Find the next realistic login time at or after `after`.
        """

        candidate_date = (
            after.astimezone(
                timezone.utc
            ).date()
        )

        for day_offset in range(8):
            work_date = (
                candidate_date
                + timedelta(
                    days=day_offset
                )
            )

            # Most office employees do not work weekends.
            if work_date.weekday() >= 5:
                if self.random.random() > 0.06:
                    continue

            login_time = (
                self._planned_login_time(
                    employee=employee,
                    work_date=work_date,
                )
            )

            if login_time >= after:
                return login_time

        # Defensive fallback.
        fallback_date = (
            candidate_date
            + timedelta(
                days=1
            )
        )

        return self._planned_login_time(
            employee=employee,
            work_date=fallback_date,
        )

    def _planned_login_time(
        self,
        *,
        employee: Employee,
        work_date: date,
    ) -> datetime:
        """
        Calculate one slightly varied login time around the employee baseline.
        """

        minute_offset = int(
            employee.behavior_profile.get(
                "typical_start_minute_offset",
                0,
            )
        )

        variation = self.random.randint(
            -18,
            22,
        )

        total_minutes = (
            employee.normal_start_hour
            * 60
            + minute_offset
            + variation
        )

        total_minutes = max(
            0,
            min(
                total_minutes,
                (23 * 60) + 59,
            ),
        )

        return datetime.combine(
            work_date,
            time(
                hour=total_minutes // 60,
                minute=total_minutes % 60,
            ),
            tzinfo=timezone.utc,
        )

    def _planned_logout_time(
        self,
        *,
        employee: Employee,
        login_time: datetime,
    ) -> datetime:
        """
        Calculate one realistic logout time around the employee baseline.
        """

        minute_offset = int(
            employee.behavior_profile.get(
                "typical_end_minute_offset",
                0,
            )
        )

        variation = self.random.randint(
            -20,
            35,
        )

        work_date = login_time.date()

        total_minutes = (
            employee.normal_end_hour
            * 60
            + minute_offset
            + variation
        )

        total_minutes = max(
            0,
            min(
                total_minutes,
                (23 * 60) + 59,
            ),
        )

        logout_time = datetime.combine(
            work_date,
            time(
                hour=total_minutes // 60,
                minute=total_minutes % 60,
            ),
            tzinfo=timezone.utc,
        )

        # Prevent pathological profiles from ending before login.
        minimum_logout = (
            login_time
            + timedelta(
                hours=4
            )
        )

        return max(
            logout_time,
            minimum_logout,
        )

    # ========================================================
    # Source / work context
    # ========================================================

    def _choose_source_context(
        self,
        employee: Employee,
    ) -> tuple[
        str,
        str,
        bool,
    ]:
        """
        Choose whether this session is office-based or legitimate remote work.
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

    # ========================================================
    # Main event interface
    # ========================================================

    def generate_due_event(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
        simulated_now: datetime,
    ) -> Event | None:
        """
        Generate at most one normal event for this employee.

        None means the employee currently has no activity due.
        """

        if state.next_activity_at is None:
            self.schedule_initial_activity(
                employee=employee,
                state=state,
                simulated_now=simulated_now,
            )

        if (
            state.next_activity_at is None
            or state.next_activity_at
            > simulated_now
        ):
            return None

        # Employee has not started today's session yet.
        if not state.is_logged_in:
            return self._generate_login_event(
                employee=employee,
                state=state,
            )

        # Logout takes priority once the workday finishes.
        if (
            state.logout_time is not None
            and state.next_activity_at
            >= state.logout_time
        ):
            return self._generate_logout_event(
                employee=employee,
                state=state,
            )

        return self._generate_work_event(
            employee=employee,
            state=state,
        )

    # ========================================================
    # Login / logout
    # ========================================================

    def _generate_login_event(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
    ) -> Event:
        timestamp = state.next_activity_at

        if timestamp is None:
            raise RuntimeError(
                "Login event requested without a scheduled timestamp."
            )

        source_ip, location, is_remote = (
            self._choose_source_context(
                employee
            )
        )

        # ----------------------------------------------------
        # Harmless authentication failure
        # ----------------------------------------------------
        #
        # A small amount of normal password failure is
        # realistic and prevents LOGIN_FAILURE from becoming
        # an automatically malicious signal.
        # ----------------------------------------------------

        if (
            state.login_failures_this_session == 0
            and self.random.random() < 0.06
        ):
            event = self.factory.create_event(
                employee=employee,
                timestamp=timestamp,
                event_type="LOGIN_FAILURE",
                source_ip=source_ip,
                destination_ip="10.20.0.10",
                source_location=location,
                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",
                bytes_sent=1500,
                bytes_received=800,
                success=False,
                metadata={
                    "remote": is_remote,
                    "authentication_method": "PASSWORD",
                    "device": employee.behavior_profile.get(
                        "typical_device",
                        "WORKSTATION",
                    ),
                },
            )

            state.login_failures_this_session += 1

            state.last_activity_at = (
                timestamp
            )

            state.schedule_next_activity(
                timestamp
                + timedelta(
                    minutes=self.random.randint(
                        1,
                        3,
                    )
                )
            )

            return event

        # ----------------------------------------------------
        # Successful normal login
        # ----------------------------------------------------

        session_id = (
            f"session-"
            f"{uuid4().hex[:12]}"
        )

        logout_time = (
            self._planned_logout_time(
                employee=employee,
                login_time=timestamp,
            )
        )

        next_activity = (
            timestamp
            + self._next_activity_delay(
                employee=employee,
            )
        )

        state.begin_session(
            session_id=session_id,
            source_ip=source_ip,
            source_location=location,
            is_remote=is_remote,
            login_time=timestamp,
            logout_time=logout_time,
            next_activity_at=next_activity,
        )

        event = self.factory.create_event(
            employee=employee,
            timestamp=timestamp,
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
                18_000,
            ),
            success=True,
            session_id=session_id,
            metadata={
                "remote": is_remote,
                "authentication_method": "PASSWORD",
                "device": employee.behavior_profile.get(
                    "typical_device",
                    "WORKSTATION",
                ),
            },
        )

        state.record_event(
            event
        )

        return event

    def _generate_logout_event(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
    ) -> Event:
        timestamp = (
            state.logout_time
            or state.next_activity_at
        )

        if timestamp is None:
            raise RuntimeError(
                "Logout event requested without a timestamp."
            )

        source_ip = (
            state.source_ip
            or employee.typical_ip
        )

        source_location = (
            state.source_location
            or employee.typical_location
        )

        session_id = (
            state.current_session_id
        )

        event = self.factory.create_event(
            employee=employee,
            timestamp=timestamp,
            event_type="LOGOUT",
            source_ip=source_ip,
            destination_ip="10.20.0.10",
            source_location=source_location,
            resource_type="AUTH_SERVER",
            resource_name="corp-auth-01",
            success=True,
            session_id=session_id,
            metadata={
                "remote": state.is_remote,
            },
        )

        state.record_event(
            event
        )

        state.end_session(
            timestamp=timestamp,
        )

        state.next_activity_at = (
            self._next_login_time(
                employee=employee,
                after=(
                    timestamp
                    + timedelta(
                        minutes=1
                    )
                ),
            )
        )

        return event

    # ========================================================
    # Work activity
    # ========================================================

    def _generate_work_event(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
    ) -> Event:
        timestamp = state.next_activity_at

        if timestamp is None:
            raise RuntimeError(
                "Work event requested without scheduled activity."
            )

        category = self._choose_activity_category(
            employee=employee,
            state=state,
        )

        if category == "database":
            event = self._database_event(
                employee=employee,
                state=state,
                timestamp=timestamp,
            )

        elif category == "network":
            event = self._network_event(
                employee=employee,
                state=state,
                timestamp=timestamp,
            )

        else:
            event = self._file_event(
                employee=employee,
                state=state,
                timestamp=timestamp,
            )

        state.record_event(
            event
        )

        # ----------------------------------------------------
        # Base employee cadence
        # ----------------------------------------------------

        base_delay = (
            self._next_activity_delay(
                employee=employee,
            )
        )

        # ----------------------------------------------------
        # Business-day rhythm
        # ----------------------------------------------------
        #
        # A working day should not produce identical event
        # density every hour.
        # ----------------------------------------------------

        business_multiplier = (
            self._business_time_multiplier(
                timestamp=timestamp,
            )
        )

        next_activity = (
            timestamp
            + timedelta(
                seconds=(
                    base_delay.total_seconds()
                    * business_multiplier
                )
            )
        )

        if (
            state.logout_time is not None
            and next_activity
            > state.logout_time
        ):
            next_activity = (
                state.logout_time
            )

        state.schedule_next_activity(
            next_activity
        )

        return event

    def _choose_activity_category(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
    ) -> str:
        """
        Choose the next normal action using department and employee baselines.
        """

        weights = dict(
            DEPARTMENT_ACTIVITY_WEIGHTS.get(
                employee.department,
                DEFAULT_ACTIVITY_WEIGHTS,
            )
        )

        database_probability = float(
            employee.behavior_profile.get(
                "database_access_probability",
                0.0,
            )
        )

        network_probability = float(
            employee.behavior_profile.get(
                "network_activity_probability",
                0.0,
            )
        )

        # Employee-specific profiles nudge department behavior.
        weights["database"] *= (
            0.60
            + database_probability
        )

        weights["network"] *= (
            0.60
            + network_probability
        )

        # Prevent one activity family from dominating a long session.
        if state.file_events_this_session > 20:
            weights["file"] *= 0.75

        if state.network_events_this_session > 12:
            weights["network"] *= 0.75

        if state.database_events_this_session > 8:
            weights["database"] *= 0.75

        categories = list(
            weights.keys()
        )

        category_weights = [
            weights[
                category
            ]
            for category
            in categories
        ]

        return self.random.choices(
            categories,
            weights=category_weights,
            k=1,
        )[0]

    # ========================================================
    # File activity
    # ========================================================

    def _file_event(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
        timestamp: datetime,
    ) -> Event:
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

        resource_name = (
            self._choose_file_resource(
                state=state,
            )
        )

        bytes_sent = 0
        bytes_received = 0

        if event_type == "FILE_ACCESS":
            bytes_received = (
                self.random.randint(
                    5_000,
                    500_000,
                )
            )

        elif event_type == "FILE_DOWNLOAD":
            bytes_received = (
                self.random.randint(
                    100_000,
                    35_000_000,
                )
            )

        else:
            bytes_sent = (
                self.random.randint(
                    100_000,
                    22_000_000,
                )
            )

        return self.factory.create_event(
            employee=employee,
            timestamp=timestamp,
            event_type=event_type,
            source_ip=(
                state.source_ip
                or employee.typical_ip
            ),
            destination_ip="10.20.10.15",
            source_location=(
                state.source_location
                or employee.typical_location
            ),
            resource_type="FILE_SERVER",
            resource_name=resource_name,
            bytes_sent=bytes_sent,
            bytes_received=bytes_received,
            success=True,
            session_id=state.current_session_id,
            metadata={
                "share": "corporate-files",
                "classification": self.random.choices(
                    [
                        "INTERNAL",
                        "CONFIDENTIAL",
                    ],
                    weights=[
                        0.86,
                        0.14,
                    ],
                    k=1,
                )[0],
            },
        )

    def _choose_file_resource(
        self,
        *,
        state: EmployeeRuntimeState,
    ) -> str:
        """
        Choose a file while allowing realistic resource revisits.
        """

        # Real users often return to files they recently accessed.
        if (
            state.recent_resources
            and self.random.random() < 0.32
        ):
            return self.random.choice(
                state.recent_resources
            )

        extension = self.random.choices(
            [
                "pdf",
                "xlsx",
                "docx",
                "csv",
                "json",
                "log",
                "zip",
            ],
            weights=[
                0.20,
                0.19,
                0.19,
                0.13,
                0.10,
                0.11,
                0.08,
            ],
            k=1,
        )[0]

        return (
            f"corporate-file-"
            f"{self.random.randint(1, 900):04d}"
            f".{extension}"
        )

    # ========================================================
    # Database activity
    # ========================================================

    def _database_event(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
        timestamp: datetime,
    ) -> Event:
        """
        Create one normal department-aware database operation.
        """

        department_resources = {
            "Finance": [
                "finance_reporting",
                "corporate_erp",
                "analytics",
            ],

            "Sales": [
                "crm",
                "analytics",
                "corporate_erp",
            ],

            "Human Resources": [
                "corporate_erp",
                "analytics",
            ],

            "Engineering": [
                "analytics",
                "corporate_erp",
            ],

            "IT Operations": [
                "analytics",
                "corporate_erp",
                "finance_reporting",
                "crm",
            ],
        }

        resources = (
            department_resources.get(
                employee.department,
                [
                    "corporate_erp",
                    "analytics",
                    "crm",
                ],
            )
        )

        resource_name = (
            self.random.choice(
                resources
            )
        )

        return self.factory.create_event(
            employee=employee,
            timestamp=timestamp,
            event_type="DATABASE_ACCESS",
            source_ip=(
                state.source_ip
                or employee.typical_ip
            ),
            destination_ip="10.20.20.10",
            source_location=(
                state.source_location
                or employee.typical_location
            ),
            resource_type="DATABASE",
            resource_name=resource_name,
            bytes_sent=self.random.randint(
                2_000,
                120_000,
            ),
            bytes_received=self.random.randint(
                20_000,
                6_000_000,
            ),
            success=True,
            session_id=state.current_session_id,
            metadata={
                "operation": self.random.choices(
                    [
                        "SELECT",
                        "REPORT",
                    ],
                    weights=[
                        0.75,
                        0.25,
                    ],
                    k=1,
                )[0],
            },
        )

    # ========================================================
    # Network activity
    # ========================================================

    def _network_event(
        self,
        *,
        employee: Employee,
        state: EmployeeRuntimeState,
        timestamp: datetime,
    ) -> Event:
        """
        Create one normal internal network-service interaction.
        """

        protocols = list(
            employee.behavior_profile.get(
                "common_protocols",
                [
                    "HTTPS",
                ],
            )
        )

        if not protocols:
            protocols = [
                "HTTPS",
            ]

        protocol = self.random.choice(
            protocols
        )

        # Normal users often communicate with the same services repeatedly.
        if (
            state.recent_destinations
            and self.random.random() < 0.55
        ):
            destination_ip = (
                self.random.choice(
                    state.recent_destinations
                )
            )

        else:
            destination_ip = (
                f"10.20."
                f"{self.random.randint(30, 40)}."
                f"{self.random.randint(10, 220)}"
            )

        return self.factory.create_event(
            employee=employee,
            timestamp=timestamp,
            event_type="NETWORK_CONNECTION",
            source_ip=(
                state.source_ip
                or employee.typical_ip
            ),
            destination_ip=destination_ip,
            source_location=(
                state.source_location
                or employee.typical_location
            ),
            resource_type="NETWORK_SERVICE",
            resource_name=(
                f"{protocol.lower()}-service"
            ),
            bytes_sent=self.random.randint(
                10_000,
                3_000_000,
            ),
            bytes_received=self.random.randint(
                10_000,
                8_000_000,
            ),
            success=True,
            session_id=state.current_session_id,
            metadata={
                "protocol": protocol,
            },
        )

    # ========================================================
    # Business-day rhythm
    # ========================================================

    def _business_time_multiplier(
        self,
        *,
        timestamp: datetime,
    ) -> float:
        """
        Return a subtle cadence multiplier for normal office rhythm.

        > 1.0 means a longer gap before the next event.
        < 1.0 means slightly more activity.

        This avoids generating a perfectly uniform corporate workday.
        """

        hour = timestamp.hour
        minute = timestamp.minute

        minute_of_day = (
            hour * 60
            + minute
        )

        # Morning working period: slightly more activity.
        if (
            9 * 60
            <= minute_of_day
            < 12 * 60
        ):
            return 0.95

        # Lunch / prayer / break period.
        if (
            12 * 60
            <= minute_of_day
            < 14 * 60
        ):
            return 1.30

        # Main afternoon working period.
        if (
            14 * 60
            <= minute_of_day
            < 16 * 60 + 30
        ):
            return 1.00

        # End of day gradually slows.
        if (
            16 * 60 + 30
            <= minute_of_day
            < 19 * 60
        ):
            return 1.15

        return 1.10

    # ========================================================
    # Activity cadence
    # ========================================================

    def _next_activity_delay(
        self,
        *,
        employee: Employee,
    ) -> timedelta:
        """
        Choose the delay before the employee's next meaningful logged action.

        SENTINEL models security-relevant telemetry rather than every user
        interaction. Activity cadence is therefore intentionally much lower
        than raw operating-system or network-request frequency.

        The ranges are calibrated so aggregate live traffic remains reasonably
        close to the controlled benchmark/training environment.
        """

        baseline_files = max(
            employee.typical_files_accessed,
            1,
        )

        if baseline_files >= 80:
            minimum = 10
            maximum = 24

        elif baseline_files >= 45:
            minimum = 14
            maximum = 30

        elif baseline_files >= 25:
            minimum = 18
            maximum = 38

        else:
            minimum = 22
            maximum = 46

        variation = float(
            employee.behavior_profile.get(
                "daily_activity_variation",
                0.20,
            )
        )

        multiplier = self.random.uniform(
            max(
                0.60,
                1.0 - variation,
            ),
            1.0 + variation,
        )

        minutes = max(
            2,
            int(
                self.random.randint(
                    minimum,
                    maximum,
                )
                * multiplier
            ),
        )

        return timedelta(
            minutes=minutes
        )