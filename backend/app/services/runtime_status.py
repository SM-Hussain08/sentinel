"""
Read-only operational runtime intelligence for SENTINEL.

This service builds public health/status responses for:

- the always-on event processor;
- the optional corporate simulator;
- the combined operations dashboard.

The simulator and SENTINEL processor remain independent.

IMPORTANT
---------
This module must never read simulator ground truth.

Public simulation status describes runtime configuration and observable
platform outcomes only. It does not expose hidden scenario state,
injected-event labels, attack stages, or future attack scheduling.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timezone,
)
from typing import Any

from sqlalchemy import (
    exists,
    func,
    select,
)
from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Event,
    Incident,
    IncidentEvent,
    SimulationRun,
)

from app.schemas import (
    OperationsStatus,
    ProcessorDetectorInfo,
    ProcessorRuntimeCounters,
    ProcessorRuntimeStatus,
    RuntimeErrorInfo,
    RuntimeHealth,
    SimulationObservedMetrics,
    SimulationRuntimeClock,
    SimulationRuntimeConfiguration,
    SimulationRuntimeStatus,
)

from app.services.event_processor_runtime import (
    get_processor_state,
)

from app.services.simulation_runtime import (
    get_latest_simulation_run,
)


PROCESSOR_HEARTBEAT_STALE_SECONDS = 15.0

SIMULATOR_MINIMUM_STALE_SECONDS = 15.0


# ============================================================
# Generic helpers
# ============================================================


def _utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def _ensure_aware(
    value: datetime | None,
) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(
            tzinfo=timezone.utc
        )

    return value


def _parse_datetime(
    value: Any,
) -> datetime | None:
    if value is None:
        return None

    if isinstance(
        value,
        datetime,
    ):
        return _ensure_aware(
            value
        )

    if not isinstance(
        value,
        str,
    ):
        return None

    try:
        parsed = datetime.fromisoformat(
            value.replace(
                "Z",
                "+00:00",
            )
        )
    except ValueError:
        return None

    return _ensure_aware(
        parsed
    )


def _as_float(
    value: Any,
) -> float | None:
    if value is None:
        return None

    try:
        parsed = float(
            value
        )
    except (
        TypeError,
        ValueError,
    ):
        return None

    if parsed < 0:
        return None

    return parsed


def _as_int(
    value: Any,
) -> int | None:
    if value is None:
        return None

    try:
        parsed = int(
            value
        )
    except (
        TypeError,
        ValueError,
    ):
        return None

    if parsed < 0:
        return None

    return parsed


def _elapsed_seconds(
    *,
    start: datetime | None,
    end: datetime | None,
) -> float:
    aware_start = _ensure_aware(
        start
    )

    aware_end = _ensure_aware(
        end
    )

    if (
        aware_start is None
        or aware_end is None
    ):
        return 0.0

    return max(
        (
            aware_end
            - aware_start
        ).total_seconds(),
        0.0,
    )


def _heartbeat_age_seconds(
    *,
    heartbeat: datetime | None,
    now: datetime,
) -> float | None:
    aware_heartbeat = (
        _ensure_aware(
            heartbeat
        )
    )

    if aware_heartbeat is None:
        return None

    return max(
        (
            now
            - aware_heartbeat
        ).total_seconds(),
        0.0,
    )


# ============================================================
# Processor health
# ============================================================


def _processor_health(
    *,
    status: str | None,
    heartbeat_age_seconds: float | None,
    has_error: bool = False,
) -> RuntimeHealth:
    """
    Determine the public operational health of the SENTINEL
    event processor.

    A fresh heartbeat only proves that the worker process is
    alive. It does not prove that event processing is working.

    A persisted processing error therefore takes precedence
    over heartbeat freshness.
    """

    if status is None:
        return "UNKNOWN"

    normalized_status = (
        status
        .strip()
        .lower()
    )

    if normalized_status == "failed":
        return "ERROR"

    if has_error:
        return "ERROR"

    if normalized_status in {
        "stopping",
        "stopped",
    }:
        return "STOPPED"

    if heartbeat_age_seconds is None:
        return "UNKNOWN"

    if (
        heartbeat_age_seconds
        > PROCESSOR_HEARTBEAT_STALE_SECONDS
    ):
        return "STALE"

    return "HEALTHY"


def _count_live_processor_backlog(
    *,
    db: Session,
    activated_at: datetime,
    detector_name: str,
    detector_version: str,
) -> int:
    """
    Count only post-activation events still awaiting the
    selected detector generation.

    Historical pre-activation events are deliberately excluded.
    """

    already_scored = exists(
        select(
            AnomalyScore.id
        )
        .where(
            AnomalyScore.event_uuid
            == Event.id,

            AnomalyScore.detector_name
            == detector_name,

            AnomalyScore.detector_version
            == detector_version,
        )
    )

    statement = (
        select(
            func.count(
                Event.id
            )
        )
        .where(
            Event.created_at
            >= activated_at,

            ~already_scored,
        )
    )

    return int(
        db.scalar(
            statement
        )
        or 0
    )


def build_processor_status(
    *,
    db: Session,
    now: datetime | None = None,
) -> ProcessorRuntimeStatus:
    """
    Build current public status for SENTINEL's selected
    detector processor generation.
    """

    effective_now = (
        _ensure_aware(
            now
        )
        or _utc_now()
    )

    state = get_processor_state(
        db=db
    )

    if state is None:
        return ProcessorRuntimeStatus(
            operational=False,
            health="UNKNOWN",
            status="unknown",
            processor_name=(
                "event-processor"
            ),
            counters=(
                ProcessorRuntimeCounters()
            ),
        )

    heartbeat_age = (
        _heartbeat_age_seconds(
            heartbeat=(
                state.last_heartbeat_at
            ),
            now=effective_now,
        )
    )

    has_error = bool(
        state.last_error
    )

    health = _processor_health(
        status=state.status,
        heartbeat_age_seconds=(
            heartbeat_age
        ),
        has_error=has_error,
    )

    operational = (
        state.status.lower() == "running"
        and health == "HEALTHY"
    )

    live_backlog = (
        _count_live_processor_backlog(
            db=db,
            activated_at=(
                state.activated_at
            ),
            detector_name=(
                state.detector_name
            ),
            detector_version=(
                state.detector_version
            ),
        )
    )

    last_error = None

    if state.last_error:
        last_error = RuntimeErrorInfo(
            message=state.last_error,
            occurred_at=(
                state.stopped_at
                if (
                    state.status
                    == "failed"
                )
                else None
            ),
        )

    return ProcessorRuntimeStatus(
        operational=operational,
        health=health,
        status=state.status,
        processor_name=(
            state.processor_name
        ),
        worker_id=state.worker_id,
        worker_version=(
            state.worker_version
        ),
        activated_at=(
            state.activated_at
        ),
        last_heartbeat_at=(
            state.last_heartbeat_at
        ),
        heartbeat_age_seconds=(
            heartbeat_age
        ),
        stopped_at=(
            state.stopped_at
        ),
        detector=(
            ProcessorDetectorInfo(
                name=(
                    state.detector_name
                ),
                version=(
                    state.detector_version
                ),
            )
        ),
        counters=(
            ProcessorRuntimeCounters(
                events_processed=(
                    state.events_processed
                ),
                scores_created=(
                    state.scores_created
                ),
                incidents_created=(
                    state.incidents_created
                ),
                incidents_updated=(
                    state.incidents_updated
                ),
                live_backlog=(
                    live_backlog
                ),
            )
        ),
        last_error=last_error,
    )


# ============================================================
# Simulator health
# ============================================================


def _get_current_or_latest_simulation_run(
    *,
    db: Session,
) -> SimulationRun | None:
    """
    Prefer an active run.

    If no run is active, return the latest historical run
    so the UI can still show last-run information.
    """

    active_statement = (
        select(
            SimulationRun
        )
        .where(
            SimulationRun.status.in_(
                [
                    "starting",
                    "running",
                    "stopping",
                ]
            )
        )
        .order_by(
            SimulationRun
            .started_at
            .desc(),
        )
        .limit(1)
    )

    active_run = db.scalar(
        active_statement
    )

    if active_run is not None:
        return active_run

    return get_latest_simulation_run(
        db=db
    )


def _simulator_stale_threshold(
    *,
    configuration: dict[str, Any],
) -> float:
    configured_heartbeat = (
        _as_float(
            configuration.get(
                "heartbeat_seconds"
            )
        )
    )

    if configured_heartbeat is None:
        return (
            SIMULATOR_MINIMUM_STALE_SECONDS
        )

    return max(
        SIMULATOR_MINIMUM_STALE_SECONDS,
        configured_heartbeat * 3.0,
    )


def _simulator_health(
    *,
    status: str,
    heartbeat_age_seconds: float | None,
    stale_threshold_seconds: float,
) -> RuntimeHealth:
    normalized = (
        status
        .strip()
        .lower()
    )

    if normalized == "failed":
        return "ERROR"

    if normalized in {
        "stopping",
        "stopped",
    }:
        return "STOPPED"

    if heartbeat_age_seconds is None:
        return "UNKNOWN"

    if (
        heartbeat_age_seconds
        > stale_threshold_seconds
    ):
        return "STALE"

    return "HEALTHY"


def _count_incidents_observed_during_run(
    *,
    db: Session,
    started_at: datetime,
    ended_at: datetime,
) -> int:
    """
    Count distinct SENTINEL incidents containing at least one event
    ingested during the simulation's wall-clock runtime.

    This uses only operational Event -> IncidentEvent -> Incident
    relationships.

    It does NOT read simulator ground truth and does NOT claim that
    the simulator caused an incident. It only reports incidents
    correlated from activity ingested during the run window.
    """

    statement = (
        select(
            func.count(
                func.distinct(
                    Incident.id
                )
            )
        )
        .select_from(
            Incident
        )
        .join(
            IncidentEvent,
            IncidentEvent.incident_uuid
            == Incident.id,
        )
        .join(
            Event,
            Event.id
            == IncidentEvent.event_uuid,
        )
        .where(
            Event.created_at
            >= started_at,

            Event.created_at
            <= ended_at,
        )
    )

    return int(
        db.scalar(
            statement
        )
        or 0
    )


def _simulation_failure_info(
    runtime_metadata: dict[str, Any],
) -> RuntimeErrorInfo | None:
    failure = (
        runtime_metadata.get(
            "failure"
        )
    )

    if not isinstance(
        failure,
        dict,
    ):
        return None

    message = failure.get(
        "message"
    )

    if not message:
        return None

    return RuntimeErrorInfo(
        message=str(
            message
        ),
        occurred_at=(
            _parse_datetime(
                failure.get(
                    "timestamp"
                )
            )
        ),
    )


def build_simulation_status(
    *,
    db: Session,
    now: datetime | None = None,
) -> SimulationRuntimeStatus:
    """
    Build current or latest simulator runtime status.

    No SimulationGroundTruth rows are read here.
    """

    effective_now = (
        _ensure_aware(
            now
        )
        or _utc_now()
    )

    run = (
        _get_current_or_latest_simulation_run(
            db=db
        )
    )

    if run is None:
        return SimulationRuntimeStatus(
            running=False,
            health="UNKNOWN",
            status="unknown",
            has_run_history=False,
        )

    configuration = dict(
        run.configuration
        or {}
    )

    runtime_metadata = dict(
        run.runtime_metadata
        or {}
    )

    heartbeat_age = (
        _heartbeat_age_seconds(
            heartbeat=(
                run.last_heartbeat_at
            ),
            now=effective_now,
        )
    )

    stale_threshold = (
        _simulator_stale_threshold(
            configuration=(
                configuration
            )
        )
    )

    health = _simulator_health(
        status=run.status,
        heartbeat_age_seconds=(
            heartbeat_age
        ),
        stale_threshold_seconds=(
            stale_threshold
        ),
    )

    running = (
        run.status == "running"
        and health == "HEALTHY"
    )

    runtime_end = (
        run.stopped_at
        if run.stopped_at
        is not None
        else effective_now
    )

    real_runtime_seconds = (
        _elapsed_seconds(
            start=run.started_at,
            end=runtime_end,
        )
    )

    simulated_now = (
        _parse_datetime(
            runtime_metadata.get(
                "simulated_now"
            )
        )
    )

    simulated_start_time = (
        _parse_datetime(
            runtime_metadata.get(
                "simulated_start_time"
            )
        )
    )

    simulated_runtime_seconds = None

    simulated_hours_elapsed = None

    if (
        simulated_start_time
        is not None
        and simulated_now
        is not None
    ):
        simulated_runtime_seconds = (
            _elapsed_seconds(
                start=(
                    simulated_start_time
                ),
                end=simulated_now,
            )
        )

        simulated_hours_elapsed = (
            simulated_runtime_seconds
            / 3600.0
        )

    simulation_minutes_per_real_second = (
        _as_float(
            configuration.get(
                "simulation_minutes_per_real_second"
            )
        )
    )

    speed_multiplier = None

    if (
        simulation_minutes_per_real_second
        is not None
    ):
        speed_multiplier = (
            simulation_minutes_per_real_second
            * 60.0
        )

    active_employees = (
        _as_int(
            runtime_metadata.get(
                "active_employees"
            )
        )
    )

    if active_employees is None:
        active_employees = (
            run.employees_loaded
        )

    incidents_observed = (
        _count_incidents_observed_during_run(
            db=db,
            started_at=(
                run.started_at
            ),
            ended_at=runtime_end,
        )
    )

    event_throughput = None

    if real_runtime_seconds > 0:
        event_throughput = (
            run.events_generated
            / (
                real_runtime_seconds
                / 60.0
            )
        )

    incident_rate_real = None

    if real_runtime_seconds > 0:
        incident_rate_real = (
            incidents_observed
            / (
                real_runtime_seconds
                / 3600.0
            )
        )

    incident_rate_simulated = None

    if (
        simulated_hours_elapsed
        is not None
        and simulated_hours_elapsed > 0
    ):
        incident_rate_simulated = (
            incidents_observed
            / simulated_hours_elapsed
        )

    public_configuration = (
        SimulationRuntimeConfiguration(
            preset=(
                configuration.get(
                    "preset"
                )
            ),
            heartbeat_seconds=(
                _as_float(
                    configuration.get(
                        "heartbeat_seconds"
                    )
                )
            ),
            attack_campaign_rate_per_simulated_hour=(
                _as_float(
                    configuration.get(
                        "attack_rate_per_simulated_hour"
                    )
                )
            ),
            simulation_minutes_per_real_second=(
                simulation_minutes_per_real_second
            ),
            max_events_per_tick=(
                _as_int(
                    configuration.get(
                        "max_events_per_tick"
                    )
                )
            ),
            max_events_per_employee_per_tick=(
                _as_int(
                    configuration.get(
                        "max_events_per_employee_per_tick"
                    )
                )
            ),
            scenario_cooldown_minutes=(
                _as_float(
                    configuration.get(
                        "scenario_cooldown_minutes"
                    )
                )
            ),
            max_concurrent_attacks=(
                _as_int(
                    configuration.get(
                        "max_concurrent_attacks"
                    )
                )
            ),
        )
    )

    clock = SimulationRuntimeClock(
        real_runtime_seconds=(
            real_runtime_seconds
        ),
        simulated_runtime_seconds=(
            simulated_runtime_seconds
        ),
        simulated_hours_elapsed=(
            simulated_hours_elapsed
        ),
        simulation_minutes_per_real_second=(
            simulation_minutes_per_real_second
        ),
        speed_multiplier=(
            speed_multiplier
        ),
        simulated_now=(
            simulated_now
        ),
        simulated_start_time=(
            simulated_start_time
        ),
    )

    metrics = SimulationObservedMetrics(
        employees_loaded=(
            run.employees_loaded
        ),
        active_employees=(
            active_employees
        ),
        events_generated=(
            run.events_generated
        ),
        event_throughput_per_real_minute=(
            event_throughput
        ),
        incidents_observed=(
            incidents_observed
        ),
        incident_rate_per_real_hour=(
            incident_rate_real
        ),
        incident_rate_per_simulated_hour=(
            incident_rate_simulated
        ),
    )

    return SimulationRuntimeStatus(
        running=running,
        health=health,
        status=run.status,
        has_run_history=True,
        run_id=run.run_id,
        mode=run.mode,
        worker_id=run.worker_id,
        worker_version=(
            run.worker_version
        ),
        seed=run.seed,
        started_at=run.started_at,
        stopped_at=run.stopped_at,
        last_heartbeat_at=(
            run.last_heartbeat_at
        ),
        heartbeat_age_seconds=(
            heartbeat_age
        ),
        clock=clock,
        configuration=(
            public_configuration
        ),
        metrics=metrics,
        last_error=(
            _simulation_failure_info(
                runtime_metadata
            )
        ),
    )


# ============================================================
# Combined operations status
# ============================================================


def build_operations_status(
    *,
    db: Session,
    now: datetime | None = None,
) -> OperationsStatus:
    """
    Build the complete read-only SOC runtime view.
    """

    effective_now = (
        _ensure_aware(
            now
        )
        or _utc_now()
    )

    return OperationsStatus(
        generated_at=effective_now,
        sentinel=(
            build_processor_status(
                db=db,
                now=effective_now,
            )
        ),
        simulation=(
            build_simulation_status(
                db=db,
                now=effective_now,
            )
        ),
    )