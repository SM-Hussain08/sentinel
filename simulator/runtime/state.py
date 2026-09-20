"""
Runtime state models for SENTINEL's continuous simulator.

These objects are intentionally in-memory.

Persistent facts belong in PostgreSQL:
- employees
- events
- simulation runs
- private ground truth

Ephemeral scheduling state belongs here:
- who is logged in
- current session
- next activity time
- active attack episodes
"""

from __future__ import annotations

from dataclasses import (
    dataclass,
    field,
)
from datetime import datetime
from typing import Any
from uuid import UUID

from app.models import Event


# ============================================================
# Employee runtime state
# ============================================================

@dataclass
class EmployeeRuntimeState:
    """
    Live working-session state for one employee.

    One EmployeeRuntimeState exists per active corporate employee
    loaded by the simulator worker.
    """

    employee_id: UUID
    user_id: str

    department: str
    job_role: str

    normal_start_hour: int
    normal_end_hour: int

    typical_ip: str
    typical_location: str

    behavior_profile: dict

    # --------------------------------------------------------
    # Current simulated session
    # --------------------------------------------------------

    is_logged_in: bool = False

    current_session_id: str | None = None

    source_ip: str | None = None
    source_location: str | None = None

    is_remote: bool = False

    login_time: datetime | None = None
    logout_time: datetime | None = None

    last_activity_at: datetime | None = None
    next_activity_at: datetime | None = None

    # --------------------------------------------------------
    # Runtime counters
    # --------------------------------------------------------

    events_emitted: int = 0

    login_failures_this_session: int = 0
    file_events_this_session: int = 0
    database_events_this_session: int = 0
    network_events_this_session: int = 0

    # --------------------------------------------------------
    # Behavioral memory
    # --------------------------------------------------------

    recent_destinations: list[str] = field(
        default_factory=list,
    )

    recent_resources: list[str] = field(
        default_factory=list,
    )

    def begin_session(
        self,
        *,
        session_id: str,
        source_ip: str,
        source_location: str,
        is_remote: bool,
        login_time: datetime,
        logout_time: datetime,
        next_activity_at: datetime,
    ) -> None:
        """
        Start a new simulated working session.
        """

        self.is_logged_in = True

        self.current_session_id = (
            session_id
        )

        self.source_ip = source_ip
        self.source_location = (
            source_location
        )

        self.is_remote = is_remote

        self.login_time = login_time
        self.logout_time = logout_time

        self.last_activity_at = (
            login_time
        )

        self.next_activity_at = (
            next_activity_at
        )

        self.login_failures_this_session = 0
        self.file_events_this_session = 0
        self.database_events_this_session = 0
        self.network_events_this_session = 0

        self.recent_destinations.clear()
        self.recent_resources.clear()

    def end_session(
        self,
        *,
        timestamp: datetime,
    ) -> None:
        """
        Finish the employee's current simulated working session.
        """

        self.is_logged_in = False

        self.last_activity_at = (
            timestamp
        )

        self.next_activity_at = None

        self.current_session_id = None

        self.source_ip = None
        self.source_location = None

        self.is_remote = False

        self.login_time = None
        self.logout_time = None

    def record_event(
        self,
        event: Event,
    ) -> None:
        """
        Update runtime memory after one observable event is emitted.
        """

        self.events_emitted += 1

        self.last_activity_at = (
            event.timestamp
        )

        event_type = event.event_type

        if event_type == "LOGIN_FAILURE":
            self.login_failures_this_session += 1

        elif event_type in {
            "FILE_ACCESS",
            "FILE_DOWNLOAD",
            "FILE_UPLOAD",
        }:
            self.file_events_this_session += 1

        elif event_type == "DATABASE_ACCESS":
            self.database_events_this_session += 1

        elif event_type == "NETWORK_CONNECTION":
            self.network_events_this_session += 1

        if event.destination_ip:
            self._remember_destination(
                event.destination_ip
            )

        if event.resource_name:
            self._remember_resource(
                event.resource_name
            )

    def schedule_next_activity(
        self,
        timestamp: datetime,
    ) -> None:
        self.next_activity_at = (
            timestamp
        )

    def _remember_destination(
        self,
        destination: str,
    ) -> None:
        """
        Keep a small bounded history for realistic live behavior.
        """

        if destination in self.recent_destinations:
            return

        self.recent_destinations.append(
            destination
        )

        if len(self.recent_destinations) > 20:
            self.recent_destinations.pop(0)

    def _remember_resource(
        self,
        resource: str,
    ) -> None:
        if resource in self.recent_resources:
            return

        self.recent_resources.append(
            resource
        )

        if len(self.recent_resources) > 20:
            self.recent_resources.pop(0)


# ============================================================
# Attack scenario runtime state
# ============================================================

@dataclass
class ScenarioEpisode:
    """
    One attack campaign currently unfolding inside the simulator.

    The scenario generator creates the event sequence once.
    The live worker then releases those events progressively as the
    simulated clock reaches each event timestamp.
    """

    scenario_instance_id: str
    scenario_type: str

    employee_id: UUID
    employee_user_id: str

    started_at: datetime

    scheduled_events: list[Event]

    attack_stages: list[str] = field(
        default_factory=list,
    )

    metadata: dict[str, Any] = field(
        default_factory=dict,
    )

    next_event_index: int = 0

    completed_at: datetime | None = None

    @property
    def is_complete(
        self,
    ) -> bool:
        return (
            self.next_event_index
            >= len(
                self.scheduled_events
            )
        )

    @property
    def events_total(
        self,
    ) -> int:
        return len(
            self.scheduled_events
        )

    @property
    def events_emitted(
        self,
    ) -> int:
        return min(
            self.next_event_index,
            self.events_total,
        )

    @property
    def next_event(
        self,
    ) -> Event | None:
        if self.is_complete:
            return None

        return self.scheduled_events[
            self.next_event_index
        ]

    @property
    def next_event_at(
        self,
    ) -> datetime | None:
        event = self.next_event

        if event is None:
            return None

        return event.timestamp

    def attack_stage_for_index(
        self,
        index: int,
    ) -> str | None:
        """
        Return private simulator stage metadata for one event.
        """

        if (
            index < 0
            or index >= len(
                self.attack_stages
            )
        ):
            return None

        return self.attack_stages[
            index
        ]

    def pop_due_events(
        self,
        *,
        simulated_now: datetime,
        limit: int | None = None,
    ) -> list[Event]:
        """
        Release scheduled scenario events whose timestamps have arrived.

        The episode itself performs no database writes.
        """

        due: list[Event] = []

        while not self.is_complete:
            event = self.scheduled_events[
                self.next_event_index
            ]

            if event.timestamp > simulated_now:
                break

            if (
                limit is not None
                and len(due) >= limit
            ):
                break

            due.append(
                event
            )

            self.next_event_index += 1

        if (
            self.is_complete
            and self.completed_at is None
        ):
            self.completed_at = (
                simulated_now
            )

        return due


# ============================================================
# Aggregate worker runtime state
# ============================================================

@dataclass
class LiveRuntimeState:
    """
    Top-level in-memory state owned by one simulator worker.
    """

    simulated_now: datetime

    employees: dict[
        UUID,
        EmployeeRuntimeState,
    ] = field(
        default_factory=dict,
    )

    active_scenarios: list[
        ScenarioEpisode
    ] = field(
        default_factory=list,
    )

    next_attack_at: datetime | None = None

    scenario_last_started_at: dict[
        str,
        datetime,
    ] = field(
        default_factory=dict,
    )

    last_heartbeat_at: datetime | None = None
    last_employee_refresh_at: datetime | None = None

    total_events_generated: int = 0
    total_attack_events_generated: int = 0

    def active_employee_count(
        self,
    ) -> int:
        return sum(
            1
            for state in self.employees.values()
            if state.is_logged_in
        )

    def active_scenario_count(
        self,
    ) -> int:
        return sum(
            1
            for episode in self.active_scenarios
            if not episode.is_complete
        )

    def remove_completed_scenarios(
        self,
    ) -> list[ScenarioEpisode]:
        """
        Remove completed scenarios and return them for logging/reporting.
        """

        completed = [
            episode
            for episode
            in self.active_scenarios
            if episode.is_complete
        ]

        self.active_scenarios = [
            episode
            for episode
            in self.active_scenarios
            if not episode.is_complete
        ]

        return completed