"""
API and service tests for SENTINEL operational runtime status.

These tests verify the public processor-health contract backed by the
isolated PostgreSQL test database.

Covered behavior:

    persistent processor state
        -> heartbeat health
        -> selected-detector live backlog
        -> read-only operations API
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Employee,
    Event,
)
from app.services.event_processor_runtime import (
    activate_processor,
    mark_processor_running,
)
from app.services.ml_scoring import (
    score_event,
)
from app.services.runtime_status import (
    PROCESSOR_HEARTBEAT_STALE_SECONDS,
    build_processor_status,
)


# ============================================================
# Helpers
# ============================================================


def _create_employee(
    db_session: Session,
    *,
    user_id: str,
) -> Employee:
    employee = Employee(
        user_id=user_id,
        name="Sara Ahmed",
        department="Security",
        job_role="SOC Analyst",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.120.1.25",
        typical_location="Karachi Office",
        typical_login_frequency=2,
        typical_files_accessed=20,
        typical_data_transfer_bytes=50_000_000,
        behavior_profile={
            "remote_work_probability": 0.10,
        },
        is_active=True,
    )

    db_session.add(
        employee
    )

    db_session.flush()

    return employee


def _create_event(
    db_session: Session,
    *,
    employee: Employee,
    event_id: str,
    created_at: datetime,
    event_timestamp: datetime | None = None,
    event_type: str = "LOGIN_SUCCESS",
) -> Event:
    event = Event(
        event_id=event_id,
        timestamp=(
            event_timestamp
            or created_at
        ),
        employee_id=employee.id,
        session_id="pytest-operations-session",
        event_type=event_type,
        source_ip=employee.typical_ip,
        destination_ip="10.120.5.10",
        source_location=employee.typical_location,
        resource_type="authentication",
        resource_name="corporate-sso",
        bytes_sent=500,
        bytes_received=1_000,
        success=(
            event_type
            != "LOGIN_FAILURE"
        ),
        event_metadata={
            "source": "pytest",
        },
        created_at=created_at,
    )

    db_session.add(
        event
    )

    db_session.flush()

    return event


def _activate_running_processor(
    db_session: Session,
    *,
    worker_id: str,
):
    state = activate_processor(
        db=db_session,
        worker_id=worker_id,
        configuration={
            "source": "pytest",
        },
    )

    mark_processor_running(
        db=db_session,
        state=state,
    )

    db_session.flush()

    return state


# ============================================================
# Unknown / not activated
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
def test_processor_status_is_unknown_before_first_activation(
    db_session: Session,
    client: TestClient,
) -> None:
    """
    With no processor generation in PostgreSQL, the public status must
    accurately report that SENTINEL has not yet established live runtime
    state rather than pretending to be healthy.
    """

    now = datetime(
        2026,
        3,
        1,
        12,
        0,
        tzinfo=timezone.utc,
    )

    status = build_processor_status(
        db=db_session,
        now=now,
    )

    assert status.service == "event-processor"
    assert status.operational is False
    assert status.health == "UNKNOWN"
    assert status.status == "unknown"
    assert status.processor_name == "event-processor"

    assert status.worker_id is None
    assert status.worker_version is None
    assert status.activated_at is None
    assert status.last_heartbeat_at is None
    assert status.heartbeat_age_seconds is None
    assert status.detector is None
    assert status.last_error is None

    assert status.counters.events_processed == 0
    assert status.counters.scores_created == 0
    assert status.counters.incidents_created == 0
    assert status.counters.incidents_updated == 0
    assert status.counters.live_backlog == 0

    # --------------------------------------------------------
    # Public API contract
    # --------------------------------------------------------

    response = client.get(
        "/api/v1/operations/processor"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["service"] == "event-processor"
    assert payload["operational"] is False
    assert payload["health"] == "UNKNOWN"
    assert payload["status"] == "unknown"
    assert payload["counters"]["live_backlog"] == 0


# ============================================================
# Healthy + backlog
# ============================================================


@pytest.mark.api
@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_healthy_processor_status_reports_only_real_live_backlog(
    db_session: Session,
    client: TestClient,
) -> None:
    """
    A running processor with a fresh heartbeat must be HEALTHY.

    live_backlog must include only Events that:
    - arrived on/after activation; and
    - do not already have a selected-detector score.
    """

    employee = _create_employee(
        db_session,
        user_id="operations_status_user_001",
    )

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-operations-worker",
    )

    activation = state.activated_at

    # --------------------------------------------------------
    # Pre-activation Event: never part of live backlog.
    # --------------------------------------------------------

    _create_event(
        db_session,
        employee=employee,
        event_id="EVT-OPS-000001",
        created_at=(
            activation
            - timedelta(
                seconds=10
            )
        ),
    )

    # --------------------------------------------------------
    # Post-activation unscored Events: backlog.
    # --------------------------------------------------------

    pending_1 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-OPS-000002",
        created_at=(
            activation
            + timedelta(
                seconds=1
            )
        ),
    )

    pending_2 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-OPS-000003",
        created_at=(
            activation
            + timedelta(
                seconds=2
            )
        ),
        event_type="FILE_ACCESS",
    )

    # --------------------------------------------------------
    # Post-activation but already scored: not backlog.
    # --------------------------------------------------------

    scored_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-OPS-000004",
        created_at=(
            activation
            + timedelta(
                seconds=3
            )
        ),
    )

    score_event(
        db=db_session,
        event=scored_event,
        employee=employee,
    )

    # Give the state meaningful counters.
    state.events_processed = 12
    state.scores_created = 12
    state.incidents_created = 3
    state.incidents_updated = 5

    db_session.flush()

    now = (
        state.last_heartbeat_at
        + timedelta(
            seconds=5
        )
    )

    status = build_processor_status(
        db=db_session,
        now=now,
    )

    assert status.operational is True
    assert status.health == "HEALTHY"
    assert status.status == "running"

    assert (
        status.worker_id
        == "pytest-operations-worker"
    )

    assert status.detector is not None

    assert (
        status.detector.name
        == state.detector_name
    )

    assert (
        status.detector.version
        == state.detector_version
    )

    assert (
        status.heartbeat_age_seconds
        == pytest.approx(
            5.0
        )
    )

    assert status.counters.events_processed == 12
    assert status.counters.scores_created == 12
    assert status.counters.incidents_created == 3
    assert status.counters.incidents_updated == 5

    # Only pending_1 and pending_2 are live backlog.
    assert status.counters.live_backlog == 2

    assert pending_1.id is not None
    assert pending_2.id is not None

    # --------------------------------------------------------
    # API returns the same current runtime facts.
    # --------------------------------------------------------

    response = client.get(
        "/api/v1/operations/processor"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["service"] == "event-processor"
    assert payload["operational"] is True
    assert payload["health"] == "HEALTHY"
    assert payload["status"] == "running"

    assert (
        payload["worker_id"]
        == "pytest-operations-worker"
    )

    assert (
        payload["detector"]["name"]
        == state.detector_name
    )

    assert (
        payload["detector"]["version"]
        == state.detector_version
    )

    assert payload["counters"] == {
        "events_processed": 12,
        "scores_created": 12,
        "incidents_created": 3,
        "incidents_updated": 5,
        "live_backlog": 2,
    }


# ============================================================
# Stale heartbeat
# ============================================================


@pytest.mark.api
@pytest.mark.integration
@pytest.mark.postgres
def test_running_processor_with_stale_heartbeat_is_not_operational(
    db_session: Session,
) -> None:
    """
    A RUNNING database status alone must not make the processor operational.

    Heartbeat freshness is required.
    """

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-stale-worker",
    )

    now = datetime(
        2026,
        3,
        2,
        12,
        0,
        tzinfo=timezone.utc,
    )

    state.last_heartbeat_at = (
        now
        - timedelta(
            seconds=(
                PROCESSOR_HEARTBEAT_STALE_SECONDS
                + 1
            )
        )
    )

    db_session.flush()

    status = build_processor_status(
        db=db_session,
        now=now,
    )

    assert status.status == "running"
    assert status.health == "STALE"
    assert status.operational is False

    assert (
        status.heartbeat_age_seconds
        == pytest.approx(
            PROCESSOR_HEARTBEAT_STALE_SECONDS
            + 1
        )
    )

    assert status.last_error is None


# ============================================================
# Persisted processor error
# ============================================================


@pytest.mark.api
@pytest.mark.integration
@pytest.mark.postgres
def test_processor_error_takes_precedence_over_fresh_heartbeat(
    db_session: Session,
) -> None:
    """
    A fresh heartbeat proves worker liveness, not successful processing.

    Persisted processing errors must therefore force ERROR health even
    when the processor heartbeat is fresh.
    """

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-error-worker",
    )

    now = datetime(
        2026,
        3,
        3,
        12,
        0,
        tzinfo=timezone.utc,
    )

    state.last_heartbeat_at = (
        now
        - timedelta(
            seconds=1
        )
    )

    state.last_error = (
        "Synthetic pytest processing failure."
    )

    db_session.flush()

    status = build_processor_status(
        db=db_session,
        now=now,
    )

    assert status.status == "running"
    assert status.health == "ERROR"
    assert status.operational is False

    assert (
        status.heartbeat_age_seconds
        == pytest.approx(
            1.0
        )
    )

    assert status.last_error is not None

    assert (
        status.last_error.message
        == "Synthetic pytest processing failure."
    )

    # Since this is a persisted processing error rather than a FAILED
    # lifecycle state, no stopped_at failure timestamp is exposed.
    assert status.last_error.occurred_at is None


# ============================================================
# Additional runtime-status imports
# ============================================================

from app.models import SimulationRun

from app.services.runtime_status import (
    build_operations_status,
    build_simulation_status,
)


def _create_simulation_run(
    db_session: Session,
    *,
    run_id: str,
    status: str,
    started_at: datetime,
    last_heartbeat_at: datetime | None,
    stopped_at: datetime | None = None,
    configuration: dict | None = None,
    runtime_metadata: dict | None = None,
    employees_loaded: int = 0,
    events_generated: int = 0,
    anomalies_scored: int = 0,
    incidents_created: int = 0,
) -> SimulationRun:
    run = SimulationRun(
        run_id=run_id,
        mode="live",
        status=status,
        seed=42,
        worker_id="pytest-simulator-worker",
        worker_version="1.0",
        started_at=started_at,
        stopped_at=stopped_at,
        last_heartbeat_at=last_heartbeat_at,
        employees_loaded=employees_loaded,
        events_generated=events_generated,
        anomalies_scored=anomalies_scored,
        incidents_created=incidents_created,
        configuration=(
            configuration
            or {}
        ),
        runtime_metadata=(
            runtime_metadata
            or {}
        ),
    )

    db_session.add(
        run
    )

    db_session.flush()

    return run


# ============================================================
# Processor terminal states
# ============================================================


@pytest.mark.api
@pytest.mark.integration
@pytest.mark.postgres
def test_processor_stopped_and_failed_states_are_never_operational(
    db_session: Session,
) -> None:
    """
    STOPPED and FAILED lifecycle states must never be presented as an
    operational SENTINEL processor.

    FAILED additionally exposes a safe persisted error message.
    """

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-terminal-worker",
    )

    now = datetime(
        2026,
        3,
        4,
        12,
        0,
        tzinfo=timezone.utc,
    )

    # --------------------------------------------------------
    # Clean stop
    # --------------------------------------------------------

    state.status = "stopped"
    state.stopped_at = (
        now
        - timedelta(
            seconds=2
        )
    )
    state.last_heartbeat_at = (
        now
        - timedelta(
            seconds=2
        )
    )
    state.last_error = None

    db_session.flush()

    stopped_status = build_processor_status(
        db=db_session,
        now=now,
    )

    assert stopped_status.status == "stopped"
    assert stopped_status.health == "STOPPED"
    assert stopped_status.operational is False
    assert stopped_status.last_error is None

    # --------------------------------------------------------
    # Failed processor
    # --------------------------------------------------------

    state.status = "failed"
    state.stopped_at = (
        now
        - timedelta(
            seconds=1
        )
    )
    state.last_heartbeat_at = (
        now
        - timedelta(
            seconds=1
        )
    )
    state.last_error = (
        "Selected-model runtime failure."
    )

    db_session.flush()

    failed_status = build_processor_status(
        db=db_session,
        now=now,
    )

    assert failed_status.status == "failed"
    assert failed_status.health == "ERROR"
    assert failed_status.operational is False

    assert failed_status.last_error is not None

    assert (
        failed_status.last_error.message
        == "Selected-model runtime failure."
    )

    assert (
        failed_status.last_error.occurred_at
        == state.stopped_at
    )


# ============================================================
# No simulation history
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
def test_simulation_status_is_unknown_when_no_run_history_exists(
    db_session: Session,
    client: TestClient,
) -> None:
    """
    The simulator is optional.

    Absence of simulation history must therefore be represented honestly as
    UNKNOWN rather than as a SENTINEL platform failure.
    """

    now = datetime(
        2026,
        3,
        5,
        12,
        0,
        tzinfo=timezone.utc,
    )

    status = build_simulation_status(
        db=db_session,
        now=now,
    )

    assert status.service == "simulator"
    assert status.running is False
    assert status.health == "UNKNOWN"
    assert status.status == "unknown"
    assert status.has_run_history is False

    assert status.run_id is None
    assert status.clock is None
    assert status.configuration is None
    assert status.metrics is None
    assert status.last_error is None

    response = client.get(
        "/api/v1/operations/simulation"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["service"] == "simulator"
    assert payload["running"] is False
    assert payload["health"] == "UNKNOWN"
    assert payload["status"] == "unknown"
    assert payload["has_run_history"] is False


# ============================================================
# Healthy simulation runtime
# ============================================================


@pytest.mark.api
@pytest.mark.integration
@pytest.mark.postgres
def test_running_simulation_reports_clock_configuration_and_observed_metrics(
    db_session: Session,
    client: TestClient,
) -> None:
    """
    Public simulator status should expose only operational configuration,
    synthetic clock information, and observable SENTINEL outcomes.

    It must not require simulator ground truth.
    """

    now = datetime.now(
        timezone.utc
    )

    started_at = (
        now
        - timedelta(
            seconds=60
        )
    )

    simulated_start = datetime(
        2026,
        8,
        24,
        8,
        0,
        tzinfo=timezone.utc,
    )

    simulated_now = (
        simulated_start
        + timedelta(
            hours=2
        )
    )

    run = _create_simulation_run(
        db_session,
        run_id="SIM-PYTEST-HEALTHY-001",
        status="running",
        started_at=started_at,
        last_heartbeat_at=(
            now
            - timedelta(
                seconds=1
            )
        ),
        employees_loaded=300,
        events_generated=120,
        anomalies_scored=115,
        incidents_created=4,
        configuration={
            "preset": "enterprise",
            "heartbeat_seconds": 5,
            "attack_rate_per_simulated_hour": 0.5,
            "simulation_minutes_per_real_second": 2,
            "max_events_per_tick": 50,
            "max_events_per_employee_per_tick": 3,
            "scenario_cooldown_minutes": 30,
            "max_concurrent_attacks": 2,
        },
        runtime_metadata={
            "active_employees": 275,
            "simulated_start_time": (
                simulated_start.isoformat()
            ),
            "simulated_now": (
                simulated_now.isoformat()
            ),
        },
    )

    status = build_simulation_status(
        db=db_session,
        now=now,
    )

    assert status.running is True
    assert status.health == "HEALTHY"
    assert status.status == "running"
    assert status.has_run_history is True

    assert status.run_id == run.run_id
    assert status.mode == "live"
    assert status.worker_id == "pytest-simulator-worker"
    assert status.seed == 42

    assert (
        status.heartbeat_age_seconds
        == pytest.approx(
            1.0
        )
    )

    assert status.clock is not None

    assert (
        status.clock.real_runtime_seconds
        == pytest.approx(
            60.0
        )
    )

    assert (
        status.clock.simulated_runtime_seconds
        == pytest.approx(
            7200.0
        )
    )

    assert (
        status.clock.simulated_hours_elapsed
        == pytest.approx(
            2.0
        )
    )

    assert (
        status.clock.simulation_minutes_per_real_second
        == pytest.approx(
            2.0
        )
    )

    # 2 simulated minutes per real second
    # = 120 simulated seconds / real second.
    assert (
        status.clock.speed_multiplier
        == pytest.approx(
            120.0
        )
    )

    assert status.configuration is not None

    assert (
        status.configuration.preset
        == "enterprise"
    )

    assert (
        status.configuration.heartbeat_seconds
        == pytest.approx(
            5.0
        )
    )

    assert (
        status.configuration.attack_campaign_rate_per_simulated_hour
        == pytest.approx(
            0.5
        )
    )

    assert (
        status.configuration.max_events_per_tick
        == 50
    )

    assert (
        status.configuration.max_events_per_employee_per_tick
        == 3
    )

    assert (
        status.configuration.scenario_cooldown_minutes
        == pytest.approx(
            30.0
        )
    )

    assert (
        status.configuration.max_concurrent_attacks
        == 2
    )

    assert status.metrics is not None

    assert status.metrics.employees_loaded == 300
    assert status.metrics.active_employees == 275
    assert status.metrics.events_generated == 120

    # 120 Events over one real minute.
    assert (
        status.metrics.event_throughput_per_real_minute
        == pytest.approx(
            120.0
        )
    )

    # No incidents are linked to Events inside this synthetic run window.
    assert status.metrics.incidents_observed == 0

    assert (
        status.metrics.incident_rate_per_real_hour
        == pytest.approx(
            0.0
        )
    )

    assert (
        status.metrics.incident_rate_per_simulated_hour
        == pytest.approx(
            0.0
        )
    )

    assert status.last_error is None

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    response = client.get(
        "/api/v1/operations/simulation"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["service"] == "simulator"
    assert payload["running"] is True
    assert payload["health"] == "HEALTHY"

    assert (
        payload["run_id"]
        == "SIM-PYTEST-HEALTHY-001"
    )

    assert (
        payload["configuration"]["preset"]
        == "enterprise"
    )

    assert (
        payload["metrics"]["employees_loaded"]
        == 300
    )

    # Ground-truth concepts are intentionally absent from the public surface.
    serialized = str(
        payload
    ).lower()

    assert "is_injected" not in serialized
    assert "scenario_instance_id" not in serialized
    assert "attack_stage" not in serialized


# ============================================================
# Simulator stale + failure states
# ============================================================


@pytest.mark.api
@pytest.mark.integration
@pytest.mark.postgres
def test_simulation_stale_and_failed_states_are_reported_safely(
    db_session: Session,
) -> None:
    """
    Simulator health must distinguish heartbeat staleness from an explicit
    worker failure and surface only safe failure diagnostics.
    """

    now = datetime(
        2026,
        3,
        6,
        12,
        0,
        tzinfo=timezone.utc,
    )

    run = _create_simulation_run(
        db_session,
        run_id="SIM-PYTEST-STATE-001",
        status="running",
        started_at=(
            now
            - timedelta(
                minutes=10
            )
        ),
        last_heartbeat_at=(
            now
            - timedelta(
                seconds=31
            )
        ),
        configuration={
            # Stale threshold = max(15, 5 * 3) = 15 seconds.
            "heartbeat_seconds": 5,
        },
    )

    stale_status = build_simulation_status(
        db=db_session,
        now=now,
    )

    assert stale_status.status == "running"
    assert stale_status.health == "STALE"
    assert stale_status.running is False

    assert (
        stale_status.heartbeat_age_seconds
        == pytest.approx(
            31.0
        )
    )

    assert stale_status.last_error is None

    # --------------------------------------------------------
    # Explicit worker failure takes precedence.
    # --------------------------------------------------------

    failure_time = (
        now
        - timedelta(
            seconds=2
        )
    )

    run.status = "failed"
    run.stopped_at = failure_time
    run.last_heartbeat_at = failure_time

    run.runtime_metadata = {
        "failure": {
            "message": (
                "Synthetic simulator worker failure."
            ),
            "timestamp": (
                failure_time.isoformat()
            ),
        },
    }

    db_session.flush()

    failed_status = build_simulation_status(
        db=db_session,
        now=now,
    )

    assert failed_status.status == "failed"
    assert failed_status.health == "ERROR"
    assert failed_status.running is False

    assert failed_status.last_error is not None

    assert (
        failed_status.last_error.message
        == "Synthetic simulator worker failure."
    )

    assert (
        failed_status.last_error.occurred_at
        == failure_time
    )


# ============================================================
# Combined operations view
# ============================================================


@pytest.mark.api
@pytest.mark.integration
@pytest.mark.postgres
def test_combined_operations_status_keeps_processor_and_simulator_independent(
    db_session: Session,
    client: TestClient,
) -> None:
    """
    SENTINEL must remain operational even when the optional simulator is
    stopped.

    The combined operations endpoint must represent those two runtime states
    independently.
    """

    processor_state = (
        _activate_running_processor(
            db_session,
            worker_id="pytest-combined-processor",
        )
    )

    now = datetime.now(
        timezone.utc
    )

    # Keep processor heartbeat fresh for both direct service and API calls.
    processor_state.last_heartbeat_at = now

    _create_simulation_run(
        db_session,
        run_id="SIM-PYTEST-STOPPED-001",
        status="stopped",
        started_at=(
            now
            - timedelta(
                minutes=5
            )
        ),
        stopped_at=(
            now
            - timedelta(
                seconds=5
            )
        ),
        last_heartbeat_at=(
            now
            - timedelta(
                seconds=5
            )
        ),
        configuration={
            "preset": "enterprise",
            "heartbeat_seconds": 5,
        },
        employees_loaded=300,
        events_generated=20,
    )

    db_session.flush()

    combined = build_operations_status(
        db=db_session,
        now=now,
    )

    assert combined.generated_at == now

    assert combined.sentinel.operational is True
    assert combined.sentinel.health == "HEALTHY"
    assert combined.sentinel.status == "running"

    assert combined.simulation.running is False
    assert combined.simulation.health == "STOPPED"
    assert combined.simulation.status == "stopped"
    assert combined.simulation.has_run_history is True

    # --------------------------------------------------------
    # Combined public API
    # --------------------------------------------------------

    response = client.get(
        "/api/v1/operations/status"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["sentinel"]["service"] == "event-processor"
    assert payload["sentinel"]["operational"] is True
    assert payload["sentinel"]["health"] == "HEALTHY"

    assert payload["simulation"]["service"] == "simulator"
    assert payload["simulation"]["running"] is False
    assert payload["simulation"]["health"] == "STOPPED"

    # This is one of SENTINEL's core architectural guarantees:
    # stopping the data generator does not stop the detection platform.
    assert (
        payload["sentinel"]["operational"]
        is True
    )

    assert (
        payload["simulation"]["running"]
        is False
    )
