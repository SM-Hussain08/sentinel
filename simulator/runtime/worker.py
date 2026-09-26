"""
SENTINEL live simulation worker.

The simulator generates an evolving synthetic corporate environment and
writes observable telemetry into PostgreSQL.

Attack truth is stored separately in SimulationGroundTruth.

The worker deliberately does NOT:
- perform anomaly detection;
- create incidents;
- invoke AI investigation.

Those responsibilities belong to SENTINEL's independent operational
processing pipeline.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)
import random
import signal
import time
from typing import Iterable

from sqlalchemy import (
    select,
)
from sqlalchemy.orm import Session

from app.database.session import (
    SessionLocal,
)

from app.models import (
    Employee,
    Event,
    SimulationRun,
)

from app.services.simulation_runtime import (
    create_simulation_run,
    heartbeat_simulation_run,
    mark_simulation_run_failed,
    mark_simulation_run_running,
    mark_simulation_run_stopped,
    mark_simulation_run_stopping,
    record_simulation_ground_truth,
    record_simulation_progress,
    utc_now,
)

from simulator.runtime.config import (
    LiveSimulationConfig,
    load_live_simulation_config,
)

from simulator.runtime.normal_behavior import (
    LiveNormalBehaviorEngine,
)

from simulator.runtime.scenario_orchestrator import (
    LiveScenarioOrchestrator,
)

from simulator.runtime.state import (
    LiveRuntimeState,
    ScenarioEpisode,
)


class LiveSimulationWorker:
    """
    Long-running live corporate simulation worker.
    """

    def __init__(
        self,
        *,
        config: LiveSimulationConfig | None = None,
    ) -> None:
        self.config = (
            config
            if config is not None
            else load_live_simulation_config()
        )

        # Independent deterministic stream preserves reproducible
        # live-simulation behavior.
        self.random = random.Random(  # nosec B311
            self.config.seed
        )

        # Separate deterministic random streams prevent normal behavior
        # changes from silently changing attack scheduling.
        self.normal_engine = (
            LiveNormalBehaviorEngine(
                seed=(
                    self.config.seed
                    + 1000
                )
            )
        )

        self.scenario_orchestrator = (
            LiveScenarioOrchestrator(
                config=self.config,
                seed=(
                    self.config.seed
                    + 2000
                ),
            )
        )

        self.runtime_state: (
            LiveRuntimeState
            | None
        ) = None

        self.simulation_run_id: (
            str
            | None
        ) = None

        self.stop_requested = False

        self._employee_cursor = 0

        self._last_real_heartbeat: (
            float
            | None
        ) = None

        self._last_real_employee_refresh: (
            float
            | None
        ) = None

    # ========================================================
    # Signal handling
    # ========================================================

    def install_signal_handlers(
        self,
    ) -> None:
        signal.signal(
            signal.SIGINT,
            self._handle_stop_signal,
        )

        signal.signal(
            signal.SIGTERM,
            self._handle_stop_signal,
        )

    def _handle_stop_signal(
        self,
        signum,
        frame,
    ) -> None:
        _ = signum
        _ = frame

        self.stop_requested = True

    # ========================================================
    # Existing worker safety
    # ========================================================

    def _guard_against_existing_worker(
        self,
        *,
        db: Session,
    ) -> None:
        """
        Prevent two healthy live workers from writing simultaneously.

        Non-terminal live runs with sufficiently old heartbeats are marked
        failed as stale crash remnants.
        """

        active_runs = list(
            db.scalars(
                select(
                    SimulationRun
                )
                .where(
                    SimulationRun.mode
                    == "live",
                    SimulationRun.status.in_(
                        [
                            "starting",
                            "running",
                            "stopping",
                        ]
                    ),
                )
                .order_by(
                    SimulationRun.started_at.desc()
                )
            )
        )

        if not active_runs:
            return

        now = utc_now()

        stale_after_seconds = max(
            self.config.heartbeat_seconds
            * 3.0,
            30.0,
        )

        for run in active_runs:
            heartbeat = (
                run.last_heartbeat_at
                or run.started_at
            )

            age_seconds = (
                now - heartbeat
            ).total_seconds()

            if age_seconds <= stale_after_seconds:
                raise RuntimeError(
                    (
                        "Another live simulation worker appears "
                        "to be active. "
                        f"Run ID: {run.run_id}, "
                        f"worker: {run.worker_id}, "
                        f"heartbeat age: {age_seconds:.1f}s."
                    )
                )

            mark_simulation_run_failed(
                db=db,
                run_id=run.run_id,
                error_message=(
                    "Stale live simulation run recovered "
                    "during worker startup."
                ),
            )

            metadata = dict(
                run.runtime_metadata
                or {}
            )

            metadata[
                "stale_recovery"
            ] = {
                "recovered_at": (
                    now.isoformat()
                ),
                "heartbeat_age_seconds": (
                    age_seconds
                ),
                "recovered_by": (
                    self.config.worker_id
                ),
            }

            run.runtime_metadata = metadata

        db.commit()

    # ========================================================
    # Employee loading / refresh
    # ========================================================

    def load_employees(
        self,
        *,
        db: Session,
    ) -> list[Employee]:
        employees = list(
            db.scalars(
                select(
                    Employee
                )
                .where(
                    Employee.is_active.is_(
                        True
                    )
                )
                .order_by(
                    Employee.user_id
                )
            )
        )

        if not employees:
            raise RuntimeError(
                "No active employees are available for live simulation."
            )

        return employees

    def _initialize_employee_states(
        self,
        *,
        employees: Iterable[Employee],
        simulated_now: datetime,
    ) -> None:
        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        for employee in employees:
            if (
                employee.id
                in self.runtime_state.employees
            ):
                continue

            state = (
                self.normal_engine
                .build_employee_state(
                    employee
                )
            )

            self.normal_engine.schedule_initial_activity(
                employee=employee,
                state=state,
                simulated_now=simulated_now,
            )

            self.runtime_state.employees[
                employee.id
            ] = state

    def _employee_refresh_due(
        self,
    ) -> bool:
        now = time.monotonic()

        if (
            self._last_real_employee_refresh
            is None
        ):
            return True

        return (
            now
            - self._last_real_employee_refresh
            >= self.config.employee_refresh_seconds
        )

    def _refresh_employees(
        self,
        *,
        db: Session,
        current_employees: list[Employee],
    ) -> list[Employee]:
        """
        Reload active employees without restarting the worker.

        Newly created employees join the simulation.
        Employees made inactive stop receiving future normal activity.
        """

        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        if not self._employee_refresh_due():
            return current_employees

        refreshed = self.load_employees(
            db=db
        )

        refreshed_ids = {
            employee.id
            for employee in refreshed
        }

        self._initialize_employee_states(
            employees=refreshed,
            simulated_now=(
                self.runtime_state
                .simulated_now
            ),
        )

        # Remove employees that are no longer active.
        #
        # Existing attack episode Event objects remain valid because they
        # already contain the employee UUID and are independently queued.
        stale_ids = [
            employee_id
            for employee_id
            in self.runtime_state.employees
            if employee_id
            not in refreshed_ids
        ]

        for employee_id in stale_ids:
            self.runtime_state.employees.pop(
                employee_id,
                None,
            )

        self._last_real_employee_refresh = (
            time.monotonic()
        )

        return refreshed

    # ========================================================
    # Clock
    # ========================================================

    def _initial_simulated_time(
        self,
    ) -> datetime:
        now = datetime.now(
            timezone.utc
        )

        return now.replace(
            hour=(
                self.config
                .initial_simulated_hour
            ),
            minute=0,
            second=0,
            microsecond=0,
        )

    def _advance_clock(
        self,
    ) -> None:
        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        simulated_seconds = (
            self.config
            .simulated_seconds_per_real_second
            * self.config.tick_seconds
        )

        self.runtime_state.simulated_now += (
            timedelta(
                seconds=simulated_seconds
            )
        )

    # ========================================================
    # Persistence helpers
    # ========================================================

    def _persist_event(
        self,
        *,
        db: Session,
        event: Event,
    ) -> None:
        db.add(
            event
        )

        db.flush()

    def _persist_attack_event(
        self,
        *,
        db: Session,
        simulation_run: SimulationRun,
        episode: ScenarioEpisode,
        event: Event,
        sequence_number: int,
    ) -> None:
        self._persist_event(
            db=db,
            event=event,
        )

        attack_stage = (
            episode.attack_stage_for_index(
                sequence_number - 1
            )
        )

        record_simulation_ground_truth(
            db=db,
            simulation_run=simulation_run,
            event=event,
            scenario_instance_id=(
                episode.scenario_instance_id
            ),
            scenario_type=(
                episode.scenario_type
            ),
            is_injected=True,
            attack_stage=attack_stage,
            sequence_number=(
                sequence_number
            ),
            metadata={
                **episode.metadata,
                "live_simulation": True,
            },
        )

    # ========================================================
    # Normal event generation
    # ========================================================

    def _emit_due_normal_events(
        self,
        *,
        db: Session,
        employees: list[Employee],
    ) -> int:
        """
        Emit due normal telemetry fairly across the workforce.

        Important scheduler properties:

        1. Employees are rotated between ticks so a global capacity limit
        cannot permanently favor low user IDs.

        2. An employee may emit multiple overdue events when simulated time
        advances faster than real time.

        3. Per-employee and global limits prevent catch-up storms.

        4. Event timestamps remain their original simulated timestamps rather
        than being rewritten to the current worker tick.
        """

        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        if not employees:
            return 0

        employee_map = {
            employee.id: employee
            for employee in employees
        }

        employee_ids = [
            employee.id
            for employee in employees
            if (
                employee.id
                in self.runtime_state.employees
            )
        ]

        if not employee_ids:
            return 0

        employee_count = len(
            employee_ids
        )

        # --------------------------------------------------------
        # Round-robin starting point
        # --------------------------------------------------------

        start_index = (
            self._employee_cursor
            % employee_count
        )

        ordered_ids = (
            employee_ids[
                start_index:
            ]
            + employee_ids[
                :start_index
            ]
        )

        events_written = 0

        # --------------------------------------------------------
        # Fair workforce iteration
        # --------------------------------------------------------

        for employee_id in ordered_ids:
            if (
                events_written
                >= self.config.max_events_per_tick
            ):
                break

            employee = employee_map.get(
                employee_id
            )

            state = (
                self.runtime_state
                .employees
                .get(
                    employee_id
                )
            )

            if (
                employee is None
                or state is None
            ):
                continue

            employee_events = 0

            # ----------------------------------------------------
            # Catch up due activity for this employee
            # ----------------------------------------------------

            while (
                employee_events
                < (
                    self.config
                    .max_events_per_employee_per_tick
                )
                and events_written
                < self.config.max_events_per_tick
            ):
                event = (
                    self.normal_engine
                    .generate_due_event(
                        employee=employee,
                        state=state,
                        simulated_now=(
                            self.runtime_state
                            .simulated_now
                        ),
                    )
                )

                if event is None:
                    break

                self._persist_event(
                    db=db,
                    event=event,
                )

                self.runtime_state.total_events_generated += 1

                employee_events += 1
                events_written += 1

        # --------------------------------------------------------
        # Advance round-robin cursor
        # --------------------------------------------------------

        self._employee_cursor = (
            start_index + 1
        ) % employee_count

        return events_written

    # ========================================================
    # Attack generation
    # ========================================================

    def _maybe_start_attack(
        self,
        *,
        employees: list[Employee],
    ) -> ScenarioEpisode | None:
        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        return (
            self.scenario_orchestrator
            .maybe_start_episode(
                employees=employees,
                runtime_state=self.runtime_state,
            )
        )

    def _emit_due_attack_events(
        self,
        *,
        db: Session,
        simulation_run: SimulationRun,
    ) -> int:
        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        events_written = 0

        remaining_capacity = max(
            self.config.max_events_per_tick // 2,
            1,
        )

        for episode in list(
            self.runtime_state.active_scenarios
        ):
            if remaining_capacity <= 0:
                break

            starting_index = (
                episode.next_event_index
            )

            due_events = episode.pop_due_events(
                simulated_now=(
                    self.runtime_state
                    .simulated_now
                ),
                limit=remaining_capacity,
            )

            for offset, event in enumerate(
                due_events
            ):
                sequence_number = (
                    starting_index
                    + offset
                    + 1
                )

                self._persist_attack_event(
                    db=db,
                    simulation_run=simulation_run,
                    episode=episode,
                    event=event,
                    sequence_number=(
                        sequence_number
                    ),
                )

                self.runtime_state.total_events_generated += 1
                self.runtime_state.total_attack_events_generated += 1

                events_written += 1
                remaining_capacity -= 1

        self.runtime_state.remove_completed_scenarios()

        return events_written

    # ========================================================
    # Progress + heartbeat
    # ========================================================

    def _record_progress(
        self,
        *,
        db: Session,
        events_generated: int,
    ) -> None:
        if self.simulation_run_id is None:
            raise RuntimeError(
                "Simulation run ID is not initialized."
            )

        if events_generated <= 0:
            return

        record_simulation_progress(
            db=db,
            run_id=self.simulation_run_id,
            events_generated=(
                events_generated
            ),
        )

    def _heartbeat_due(
        self,
    ) -> bool:
        now = time.monotonic()

        if self._last_real_heartbeat is None:
            return True

        return (
            now
            - self._last_real_heartbeat
            >= self.config.heartbeat_seconds
        )

    def _heartbeat(
        self,
        *,
        db: Session,
    ) -> None:
        if self.simulation_run_id is None:
            raise RuntimeError(
                "Simulation run ID is not initialized."
            )

        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        heartbeat_simulation_run(
            db=db,
            run_id=self.simulation_run_id,
            events_generated=0,
            anomalies_scored=0,
            incidents_created=0,
            runtime_metadata_update={
                "simulated_now": (
                    self.runtime_state
                    .simulated_now
                    .isoformat()
                ),
                "active_employees": (
                    self.runtime_state
                    .active_employee_count()
                ),
                "active_scenarios": (
                    self.runtime_state
                    .active_scenario_count()
                ),
                "next_attack_at": (
                    self.runtime_state
                    .next_attack_at
                    .isoformat()
                    if (
                        self.runtime_state
                        .next_attack_at
                        is not None
                    )
                    else None
                ),
                "total_attack_events_generated": (
                    self.runtime_state
                    .total_attack_events_generated
                ),
            },
        )

        self.runtime_state.last_heartbeat_at = (
            utc_now()
        )

        self._last_real_heartbeat = (
            time.monotonic()
        )

    # ========================================================
    # Initialization
    # ========================================================

    def _create_run(
        self,
        *,
        db: Session,
        employees: list[Employee],
    ) -> SimulationRun:
        simulated_now = (
            self._initial_simulated_time()
        )

        self.runtime_state = (
            LiveRuntimeState(
                simulated_now=simulated_now
            )
        )

        self._initialize_employee_states(
            employees=employees,
            simulated_now=simulated_now,
        )

        self.scenario_orchestrator.schedule_next_attack(
            runtime_state=(
                self.runtime_state
            ),
            after=simulated_now,
        )

        run = create_simulation_run(
            db=db,
            mode="live",
            seed=self.config.seed,
            worker_id=(
                self.config.worker_id
            ),
            worker_version=(
                self.config.worker_version
            ),
            configuration=(
                self.config.as_dict()
            ),
            runtime_metadata={
                "simulated_start_time": (
                    simulated_now.isoformat()
                ),
                "simulated_now": (
                    simulated_now.isoformat()
                ),
                "generator": (
                    "continuous-live-runtime"
                ),
                "active_employees": 0,
                "active_scenarios": 0,
                "next_attack_at": (
                    self.runtime_state
                    .next_attack_at
                    .isoformat()
                    if (
                        self.runtime_state
                        .next_attack_at
                        is not None
                    )
                    else None
                ),
                "total_attack_events_generated": 0,
            },
        )

        self.simulation_run_id = (
            run.run_id
        )

        mark_simulation_run_running(
            db=db,
            run_id=run.run_id,
            employees_loaded=len(
                employees
            ),
        )

        db.commit()

        self._last_real_employee_refresh = (
            time.monotonic()
        )

        return run

    # ========================================================
    # One worker iteration
    # ========================================================

    def tick(
        self,
        *,
        db: Session,
        employees: list[Employee],
        simulation_run: SimulationRun,
    ) -> tuple[
        int,
        list[Employee],
    ]:
        if self.runtime_state is None:
            raise RuntimeError(
                "Runtime state is not initialized."
            )

        self._advance_clock()

        employees = self._refresh_employees(
            db=db,
            current_employees=employees,
        )

        self._maybe_start_attack(
            employees=employees,
        )

        normal_count = (
            self._emit_due_normal_events(
                db=db,
                employees=employees,
            )
        )

        attack_count = (
            self._emit_due_attack_events(
                db=db,
                simulation_run=simulation_run,
            )
        )

        total_written = (
            normal_count
            + attack_count
        )

        # Progress belongs in the same DB transaction as the events.
        self._record_progress(
            db=db,
            events_generated=(
                total_written
            ),
        )

        if self._heartbeat_due():
            self._heartbeat(
                db=db
            )

        db.commit()

        return (
            total_written,
            employees,
        )

    # ========================================================
    # Final heartbeat
    # ========================================================

    def _finalize_runtime_metadata(
        self,
        *,
        db: Session,
    ) -> None:
        """
        Persist one final runtime snapshot before terminal transition.
        """

        if (
            self.simulation_run_id is None
            or self.runtime_state is None
        ):
            return

        heartbeat_simulation_run(
            db=db,
            run_id=self.simulation_run_id,
            runtime_metadata_update={
                "simulated_now": (
                    self.runtime_state
                    .simulated_now
                    .isoformat()
                ),
                "active_employees": (
                    self.runtime_state
                    .active_employee_count()
                ),
                "active_scenarios": (
                    self.runtime_state
                    .active_scenario_count()
                ),
                "next_attack_at": (
                    self.runtime_state
                    .next_attack_at
                    .isoformat()
                    if (
                        self.runtime_state
                        .next_attack_at
                        is not None
                    )
                    else None
                ),
                "total_attack_events_generated": (
                    self.runtime_state
                    .total_attack_events_generated
                ),
                "clean_shutdown": True,
            },
        )

    # ========================================================
    # Main execution
    # ========================================================

    def run(
        self,
        *,
        max_ticks: int | None = None,
        sleep_between_ticks: bool = True,
    ) -> None:
        """
        Run the live worker.

        max_ticks is primarily intended for deterministic smoke tests.

        None means run continuously until SIGINT/SIGTERM.
        """

        self.install_signal_handlers()

        db = SessionLocal()

        simulation_run: (
            SimulationRun
            | None
        ) = None

        try:
            self._guard_against_existing_worker(
                db=db
            )

            employees = self.load_employees(
                db=db
            )

            simulation_run = self._create_run(
                db=db,
                employees=employees,
            )

            print()
            print(
                "SENTINEL live simulation started."
            )
            print(
                "=" * 68
            )
            print(
                f"Run ID             : "
                f"{simulation_run.run_id}"
            )
            print(
                f"Employees loaded   : "
                f"{len(employees)}"
            )
            print(
                f"Initially active   : "
                f"{self.runtime_state.active_employee_count()}"
            )
            print(
                f"Seed               : "
                f"{self.config.seed}"
            )
            print(
                f"Simulation speed   : "
                f"{self.config.simulation_minutes_per_real_second}"
                f" simulated min / real sec"
            )
            print(
                f"First attack after : "
                f"{self.runtime_state.next_attack_at}"
            )
            print(
                "=" * 68
            )

            tick_number = 0

            while not self.stop_requested:
                if (
                    max_ticks is not None
                    and tick_number >= max_ticks
                ):
                    break

                written, employees = (
                    self.tick(
                        db=db,
                        employees=employees,
                        simulation_run=simulation_run,
                    )
                )

                tick_number += 1

                if (
                    written > 0
                    and self.runtime_state
                    is not None
                ):
                    print(
                        f"[{self.runtime_state.simulated_now.isoformat()}] "
                        f"events={written} "
                        f"active_users="
                        f"{self.runtime_state.active_employee_count()} "
                        f"active_attacks="
                        f"{self.runtime_state.active_scenario_count()}"
                    )

                if sleep_between_ticks:
                    time.sleep(
                        self.config.tick_seconds
                    )

            self._finalize_runtime_metadata(
                db=db
            )

            mark_simulation_run_stopping(
                db=db,
                run_id=(
                    simulation_run.run_id
                ),
            )

            mark_simulation_run_stopped(
                db=db,
                run_id=(
                    simulation_run.run_id
                ),
            )

            db.commit()

            print()
            print(
                "SENTINEL live simulation stopped cleanly."
            )

        except Exception as exc:
            db.rollback()

            if (
                simulation_run is not None
                and self.simulation_run_id
                is not None
            ):
                try:
                    mark_simulation_run_failed(
                        db=db,
                        run_id=(
                            self.simulation_run_id
                        ),
                        error_message=str(
                            exc
                        ),
                    )

                    db.commit()

                except Exception:
                    db.rollback()

            raise

        finally:
            db.close()


def main() -> None:
    worker = LiveSimulationWorker()

    worker.run()


if __name__ == "__main__":
    main()