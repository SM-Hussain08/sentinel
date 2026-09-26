"""
Integration tests for SENTINEL simulation runtime persistence.

These tests exercise the real PostgreSQL-backed simulation control plane:

    create
      -> running
      -> progress
      -> heartbeat
      -> stopping
      -> stopped / failed

Transaction ownership remains with pytest's isolated outer transaction.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import app.services.simulation_runtime as simulation_runtime_module

from app.models import SimulationRun

from app.services.simulation_runtime import (
    create_simulation_run,
    generate_run_id,
    generate_scenario_instance_id,
    get_latest_simulation_run,
    get_simulation_run,
    heartbeat_simulation_run,
    mark_simulation_run_failed,
    mark_simulation_run_running,
    mark_simulation_run_stopped,
    mark_simulation_run_stopping,
    record_simulation_progress,
)


# ============================================================
# Identifier helpers
# ============================================================


@pytest.mark.integration
def test_simulation_identifiers_have_stable_operator_friendly_shapes() -> None:
    run_id = generate_run_id()

    assert run_id.startswith(
        "SIMRUN-"
    )

    parts = run_id.split(
        "-"
    )

    assert len(parts) == 3
    assert len(parts[1]) == 8
    assert len(parts[2]) == 8

    scenario_id = (
        generate_scenario_instance_id(
            "network scan"
        )
    )

    assert scenario_id.startswith(
        "SCN-NETWORK-SCAN-"
    )

    assert (
        len(
            scenario_id.split(
                "-"
            )[-1]
        )
        == 8
    )


# ============================================================
# Creation + retrieval
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_create_simulation_run_persists_starting_state_and_can_be_retrieved(
    db_session: Session,
) -> None:
    run = create_simulation_run(
        db=db_session,
        mode="live",
        seed=42,
        worker_id="pytest-simulator-worker",
        worker_version="1.0",
        configuration={
            "preset": "enterprise",
            "heartbeat_seconds": 5,
        },
        runtime_metadata={
            "source": "pytest",
        },
    )

    assert run.id is not None
    assert run.run_id.startswith("SIMRUN-")

    assert run.mode == "live"
    assert run.status == "starting"
    assert run.seed == 42

    assert (
        run.worker_id
        == "pytest-simulator-worker"
    )

    assert run.worker_version == "1.0"

    assert run.employees_loaded == 0
    assert run.events_generated == 0
    assert run.anomalies_scored == 0
    assert run.incidents_created == 0

    assert run.last_heartbeat_at is not None

    assert (
        run.configuration["preset"]
        == "enterprise"
    )

    assert (
        run.runtime_metadata["source"]
        == "pytest"
    )

    fetched = get_simulation_run(
        db=db_session,
        run_id=run.run_id,
    )

    assert fetched is not None
    assert fetched.id == run.id

    latest = get_latest_simulation_run(
        db=db_session
    )

    assert latest is not None
    assert latest.id == run.id

    count = db_session.scalar(
        select(
            func.count(
                SimulationRun.id
            )
        )
    )

    assert count == 1


# ============================================================
# Running + exact progress
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_simulation_progress_accumulates_exact_counters(
    db_session: Session,
) -> None:
    run = create_simulation_run(
        db=db_session,
        mode="live",
        seed=7,
    )

    running = mark_simulation_run_running(
        db=db_session,
        run_id=run.run_id,
        employees_loaded=300,
    )

    assert running.status == "running"
    assert running.employees_loaded == 300

    first = record_simulation_progress(
        db=db_session,
        run_id=run.run_id,
        events_generated=10,
        anomalies_scored=4,
        incidents_created=1,
    )

    assert first.events_generated == 10
    assert first.anomalies_scored == 4
    assert first.incidents_created == 1

    second = record_simulation_progress(
        db=db_session,
        run_id=run.run_id,
        events_generated=7,
        anomalies_scored=3,
        incidents_created=2,
    )

    assert second.events_generated == 17
    assert second.anomalies_scored == 7
    assert second.incidents_created == 3


# ============================================================
# Heartbeat + metadata merging
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_simulation_heartbeat_merges_metadata_and_preserves_existing_values(
    db_session: Session,
) -> None:
    run = create_simulation_run(
        db=db_session,
        mode="development",
        runtime_metadata={
            "simulated_start_time":
                "2026-08-24T08:00:00+00:00",

            "existing_key":
                "preserve-me",
        },
    )

    mark_simulation_run_running(
        db=db_session,
        run_id=run.run_id,
        employees_loaded=50,
    )

    heartbeat_before = (
        run.last_heartbeat_at
    )

    heartbeated = heartbeat_simulation_run(
        db=db_session,
        run_id=run.run_id,
        events_generated=2,
        anomalies_scored=1,
        incidents_created=1,
        runtime_metadata_update={
            "simulated_now":
                "2026-08-24T09:00:00+00:00",

            "active_employees":
                45,
        },
    )

    assert (
        heartbeated.last_heartbeat_at
        >= heartbeat_before
    )

    assert heartbeated.events_generated == 2
    assert heartbeated.anomalies_scored == 1
    assert heartbeated.incidents_created == 1

    assert (
        heartbeated.runtime_metadata[
            "existing_key"
        ]
        == "preserve-me"
    )

    assert (
        heartbeated.runtime_metadata[
            "active_employees"
        ]
        == 45
    )

    assert (
        heartbeated.runtime_metadata[
            "simulated_now"
        ]
        == "2026-08-24T09:00:00+00:00"
    )


# ============================================================
# Clean lifecycle
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_simulation_clean_shutdown_transitions_running_to_stopping_to_stopped(
    db_session: Session,
) -> None:
    run = create_simulation_run(
        db=db_session,
        mode="live",
    )

    mark_simulation_run_running(
        db=db_session,
        run_id=run.run_id,
        employees_loaded=300,
    )

    stopping = mark_simulation_run_stopping(
        db=db_session,
        run_id=run.run_id,
    )

    assert stopping.status == "stopping"

    heartbeat_at_stopping = (
        stopping.last_heartbeat_at
    )

    stopped = mark_simulation_run_stopped(
        db=db_session,
        run_id=run.run_id,
    )

    assert stopped.status == "stopped"
    assert stopped.stopped_at is not None

    assert (
        stopped.last_heartbeat_at
        >= heartbeat_at_stopping
    )


# ============================================================
# Failure lifecycle
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_simulation_failure_persists_diagnostics_and_terminal_state(
    db_session: Session,
) -> None:
    run = create_simulation_run(
        db=db_session,
        mode="live",
        runtime_metadata={
            "existing": "metadata",
        },
    )

    mark_simulation_run_running(
        db=db_session,
        run_id=run.run_id,
        employees_loaded=300,
    )

    failed = mark_simulation_run_failed(
        db=db_session,
        run_id=run.run_id,
        error_message=(
            "Synthetic simulator failure."
        ),
    )

    assert failed.status == "failed"
    assert failed.stopped_at is not None
    assert failed.last_heartbeat_at is not None

    assert (
        failed.runtime_metadata[
            "existing"
        ]
        == "metadata"
    )

    failure = (
        failed.runtime_metadata[
            "failure"
        ]
    )

    assert (
        failure["message"]
        == "Synthetic simulator failure."
    )

    parsed_failure_time = (
        datetime.fromisoformat(
            failure["timestamp"]
        )
    )

    assert (
        parsed_failure_time.tzinfo
        is not None
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "A failed simulation run "
            "cannot become stopped"
        ),
    ):
        mark_simulation_run_stopped(
            db=db_session,
            run_id=run.run_id,
        )


# ============================================================
# Validation + terminal protection
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_simulation_runtime_rejects_invalid_values_and_terminal_mutations(
    db_session: Session,
) -> None:
    with pytest.raises(
        ValueError,
        match="Unsupported simulation mode",
    ):
        create_simulation_run(
            db=db_session,
            mode="invalid-mode",
        )

    run = create_simulation_run(
        db=db_session,
        mode="live",
    )

    with pytest.raises(
        ValueError,
        match=(
            "employees_loaded "
            "must be non-negative"
        ),
    ):
        mark_simulation_run_running(
            db=db_session,
            run_id=run.run_id,
            employees_loaded=-1,
        )

    mark_simulation_run_running(
        db=db_session,
        run_id=run.run_id,
        employees_loaded=10,
    )

    with pytest.raises(
        ValueError,
        match=(
            "events_generated "
            "must be non-negative"
        ),
    ):
        record_simulation_progress(
            db=db_session,
            run_id=run.run_id,
            events_generated=-1,
        )

    with pytest.raises(
        ValueError,
        match=(
            "anomalies_scored "
            "must be non-negative"
        ),
    ):
        heartbeat_simulation_run(
            db=db_session,
            run_id=run.run_id,
            anomalies_scored=-1,
        )

    mark_simulation_run_stopped(
        db=db_session,
        run_id=run.run_id,
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "Cannot record progress "
            "for terminal simulation run"
        ),
    ):
        record_simulation_progress(
            db=db_session,
            run_id=run.run_id,
            events_generated=1,
        )

    with pytest.raises(
        RuntimeError,
        match=(
            "Cannot heartbeat terminal "
            "simulation run"
        ),
    ):
        heartbeat_simulation_run(
            db=db_session,
            run_id=run.run_id,
        )

    with pytest.raises(
        RuntimeError,
        match=(
            "Cannot start a terminal "
            "simulation run"
        ),
    ):
        mark_simulation_run_running(
            db=db_session,
            run_id=run.run_id,
            employees_loaded=10,
        )

    with pytest.raises(
        RuntimeError,
        match=(
            "Cannot stop a terminal "
            "simulation run"
        ),
    ):
        mark_simulation_run_stopping(
            db=db_session,
            run_id=run.run_id,
        )


# ============================================================
# Missing-run behavior
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.parametrize(
    "operation",
    [
        "running",
        "progress",
        "heartbeat",
        "stopping",
        "stopped",
        "failed",
    ],
)
def test_simulation_runtime_reports_missing_run_cleanly(
    db_session: Session,
    operation: str,
) -> None:
    missing_id = (
        "SIMRUN-20990101-DEADBEEF"
    )

    with pytest.raises(
        LookupError,
        match=(
            "Simulation run not found"
        ),
    ):
        if operation == "running":
            mark_simulation_run_running(
                db=db_session,
                run_id=missing_id,
                employees_loaded=1,
            )

        elif operation == "progress":
            record_simulation_progress(
                db=db_session,
                run_id=missing_id,
                events_generated=1,
            )

        elif operation == "heartbeat":
            heartbeat_simulation_run(
                db=db_session,
                run_id=missing_id,
            )

        elif operation == "stopping":
            mark_simulation_run_stopping(
                db=db_session,
                run_id=missing_id,
            )

        elif operation == "stopped":
            mark_simulation_run_stopped(
                db=db_session,
                run_id=missing_id,
            )

        elif operation == "failed":
            mark_simulation_run_failed(
                db=db_session,
                run_id=missing_id,
                error_message="failure",
            )


# ============================================================
# Ground-truth persistence
# ============================================================

from app.models import (
    Employee,
    Event,
    SimulationGroundTruth,
)

from app.services.simulation_runtime import (
    record_simulation_ground_truth,
)


def _create_ground_truth_employee(
    db_session: Session,
    *,
    user_id: str,
) -> Employee:
    employee = Employee(
        user_id=user_id,
        name="Ground Truth Test User",
        department="Security",
        job_role="Security Analyst",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.150.1.25",
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


def _create_ground_truth_event(
    db_session: Session,
    *,
    employee: Employee,
    event_id: str,
) -> Event:
    now = datetime.now(
        timezone.utc
    )

    event = Event(
        event_id=event_id,
        timestamp=now,
        employee_id=employee.id,
        session_id="pytest-ground-truth-session",
        event_type="LOGIN_FAILURE",
        source_ip="203.0.113.50",
        destination_ip="10.150.5.10",
        source_location="Remote",
        resource_type="authentication",
        resource_name="corporate-sso",
        bytes_sent=500,
        bytes_received=200,
        success=False,
        event_metadata={
            "source": "pytest",
        },
        created_at=now,
    )

    db_session.add(
        event
    )

    db_session.flush()

    return event


# ============================================================
# Simulation provenance
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.safety
def test_ground_truth_can_be_recorded_for_live_simulation_without_mutating_event(
    db_session: Session,
) -> None:
    employee = _create_ground_truth_employee(
        db_session,
        user_id="gt_runtime_user_001",
    )

    event = _create_ground_truth_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-RUNTIME-000001",
    )

    run = create_simulation_run(
        db=db_session,
        mode="live",
        seed=42,
    )

    scenario_instance_id = (
        generate_scenario_instance_id(
            "credential attack"
        )
    )

    truth = record_simulation_ground_truth(
        db=db_session,
        event=event,
        simulation_run=run,
        benchmark_batch_id=None,
        scenario_instance_id=(
            scenario_instance_id
        ),
        scenario_type="credential_attack",
        is_injected=True,
        attack_stage="initial_access",
        sequence_number=1,
        metadata={
            "campaign": "pytest",
        },
    )

    assert truth.id is not None

    assert (
        truth.simulation_run_id
        == run.id
    )

    assert (
        truth.benchmark_batch_id
        is None
    )

    assert (
        truth.event_uuid
        == event.id
    )

    assert (
        truth.scenario_instance_id
        == scenario_instance_id
    )

    assert (
        truth.scenario_type
        == "credential_attack"
    )

    assert truth.is_injected is True

    assert (
        truth.attack_stage
        == "initial_access"
    )

    assert truth.sequence_number == 1

    assert (
        truth.ground_truth_metadata[
            "campaign"
        ]
        == "pytest"
    )

    # --------------------------------------------------------
    # Core separation guarantee:
    # the observable Event remains free of authoritative truth.
    # --------------------------------------------------------

    event_columns = {
        column.name
        for column
        in Event.__table__.columns
    }

    forbidden_event_columns = {
        "is_injected",
        "scenario_type",
        "scenario_instance_id",
        "attack_stage",
        "sequence_number",
        "ground_truth",
    }

    assert (
        event_columns
        .isdisjoint(
            forbidden_event_columns
        )
    )

    db_session.refresh(
        event
    )

    assert (
        event.event_metadata
        == {
            "source": "pytest",
        }
    )


# ============================================================
# Benchmark provenance
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.safety
def test_ground_truth_can_use_benchmark_provenance_without_simulation_run(
    db_session: Session,
) -> None:
    employee = _create_ground_truth_employee(
        db_session,
        user_id="gt_runtime_user_002",
    )

    event = _create_ground_truth_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-RUNTIME-000002",
    )

    truth = record_simulation_ground_truth(
        db=db_session,
        event=event,
        simulation_run=None,
        benchmark_batch_id=(
            " benchmark-seed-42 "
        ),
        scenario_instance_id=(
            "SCN-BENCHMARK-0001"
        ),
        scenario_type="network_scan",
        is_injected=True,
        attack_stage="reconnaissance",
        sequence_number=2,
    )

    assert (
        truth.simulation_run_id
        is None
    )

    assert (
        truth.benchmark_batch_id
        == "benchmark-seed-42"
    )

    assert (
        truth.scenario_type
        == "network_scan"
    )

    assert truth.sequence_number == 2


# ============================================================
# Provenance exclusivity
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.safety
def test_ground_truth_requires_exactly_one_provenance_source(
    db_session: Session,
) -> None:
    employee = _create_ground_truth_employee(
        db_session,
        user_id="gt_runtime_user_003",
    )

    event_1 = _create_ground_truth_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-RUNTIME-000003",
    )

    run = create_simulation_run(
        db=db_session,
        mode="live",
    )

    with pytest.raises(
        ValueError,
        match=(
            "Ground-truth provenance must "
            "specify exactly one"
        ),
    ):
        record_simulation_ground_truth(
            db=db_session,
            event=event_1,
            simulation_run=None,
            benchmark_batch_id=None,
            scenario_instance_id="SCN-INVALID-1",
            scenario_type="network_scan",
        )

    event_2 = _create_ground_truth_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-RUNTIME-000004",
    )

    with pytest.raises(
        ValueError,
        match=(
            "Ground-truth provenance must "
            "specify exactly one"
        ),
    ):
        record_simulation_ground_truth(
            db=db_session,
            event=event_2,
            simulation_run=run,
            benchmark_batch_id="benchmark-42",
            scenario_instance_id="SCN-INVALID-2",
            scenario_type="network_scan",
        )


# ============================================================
# Validation
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.safety
def test_ground_truth_validates_injected_scenario_type_and_sequence_number(
    db_session: Session,
) -> None:
    employee = _create_ground_truth_employee(
        db_session,
        user_id="gt_runtime_user_004",
    )

    run = create_simulation_run(
        db=db_session,
        mode="live",
    )

    missing_type_event = (
        _create_ground_truth_event(
            db_session,
            employee=employee,
            event_id="EVT-GT-RUNTIME-000005",
        )
    )

    with pytest.raises(
        ValueError,
        match=(
            "scenario_type is required "
            "for injected ground truth"
        ),
    ):
        record_simulation_ground_truth(
            db=db_session,
            event=missing_type_event,
            simulation_run=run,
            benchmark_batch_id=None,
            scenario_instance_id="SCN-MISSING-TYPE",
            scenario_type=None,
            is_injected=True,
        )

    bad_sequence_event = (
        _create_ground_truth_event(
            db_session,
            employee=employee,
            event_id="EVT-GT-RUNTIME-000006",
        )
    )

    with pytest.raises(
        ValueError,
        match=(
            "sequence_number "
            "must be >= 1"
        ),
    ):
        record_simulation_ground_truth(
            db=db_session,
            event=bad_sequence_event,
            simulation_run=run,
            benchmark_batch_id=None,
            scenario_instance_id="SCN-BAD-SEQUENCE",
            scenario_type="credential_attack",
            is_injected=True,
            sequence_number=0,
        )


# ============================================================
# Duplicate protection
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.safety
def test_ground_truth_rejects_duplicate_truth_for_same_event(
    db_session: Session,
) -> None:
    employee = _create_ground_truth_employee(
        db_session,
        user_id="gt_runtime_user_005",
    )

    event = _create_ground_truth_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-RUNTIME-000007",
    )

    run = create_simulation_run(
        db=db_session,
        mode="live",
    )

    record_simulation_ground_truth(
        db=db_session,
        event=event,
        simulation_run=run,
        benchmark_batch_id=None,
        scenario_instance_id="SCN-DUPLICATE",
        scenario_type="network_scan",
        is_injected=True,
        sequence_number=1,
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "Ground truth already exists"
        ),
    ):
        record_simulation_ground_truth(
            db=db_session,
            event=event,
            simulation_run=run,
            benchmark_batch_id=None,
            scenario_instance_id="SCN-DUPLICATE",
            scenario_type="network_scan",
            is_injected=True,
            sequence_number=2,
        )

    count = db_session.scalar(
        select(
            func.count(
                SimulationGroundTruth.id
            )
        )
        .where(
            SimulationGroundTruth.event_uuid
            == event.id
        )
    )

    assert count == 1


# ============================================================
# Normal / non-injected evaluation truth
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.safety
def test_non_injected_ground_truth_does_not_require_attack_scenario_type(
    db_session: Session,
) -> None:
    employee = _create_ground_truth_employee(
        db_session,
        user_id="gt_runtime_user_006",
    )

    event = _create_ground_truth_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-RUNTIME-000008",
    )

    run = create_simulation_run(
        db=db_session,
        mode="development",
    )

    truth = record_simulation_ground_truth(
        db=db_session,
        event=event,
        simulation_run=run,
        benchmark_batch_id=None,
        scenario_instance_id=None,
        scenario_type=None,
        is_injected=False,
        attack_stage=None,
        sequence_number=None,
        metadata={
            "label": "normal",
        },
    )

    assert truth.is_injected is False
    assert truth.scenario_type is None
    assert truth.attack_stage is None
    assert truth.sequence_number is None

    assert (
        truth.ground_truth_metadata[
            "label"
        ]
        == "normal"
    )
