"""
Simulation runtime persistence helpers.

This module is the database-facing control plane used by the future live
simulation worker.

Transaction ownership remains with the caller:
    - functions flush;
    - functions do not commit.

That allows one worker iteration to persist its operational changes
atomically.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    select,
    update,
)
from sqlalchemy.orm import Session

from app.models import (
    Event,
    SimulationGroundTruth,
    SimulationRun,
)


VALID_RUN_MODES = {
    "live",
    "development",
}

VALID_RUN_STATUSES = {
    "starting",
    "running",
    "stopping",
    "stopped",
    "failed",
}

TERMINAL_RUN_STATUSES = {
    "stopped",
    "failed",
}


def utc_now() -> datetime:
    """
    Return an aware UTC timestamp.
    """

    return datetime.now(
        timezone.utc
    )


def generate_run_id() -> str:
    """
    Generate a readable, collision-resistant simulation run identifier.

    Example:
        SIMRUN-20260916-A1B2C3D4
    """

    now = utc_now()

    return (
        f"SIMRUN-"
        f"{now:%Y%m%d}-"
        f"{uuid4().hex[:8].upper()}"
    )


def generate_scenario_instance_id(
    scenario_type: str,
) -> str:
    """
    Generate one campaign identifier shared by all events in a scenario.

    Example:
        SCN-NETWORK-SCAN-A1B2C3D4
    """

    normalized = (
        scenario_type
        .strip()
        .upper()
        .replace("_", "-")
        .replace(" ", "-")
    )

    return (
        f"SCN-"
        f"{normalized}-"
        f"{uuid4().hex[:8].upper()}"
    )


def _validate_non_negative(
    *,
    field_name: str,
    value: int,
) -> None:
    if value < 0:
        raise ValueError(
            f"{field_name} must be non-negative."
        )


def create_simulation_run(
    *,
    db: Session,
    mode: str = "live",
    seed: int | None = None,
    worker_id: str | None = None,
    worker_version: str = "1.0",
    configuration: dict[str, Any] | None = None,
    runtime_metadata: dict[str, Any] | None = None,
) -> SimulationRun:
    """
    Create a new simulation run in STARTING state.
    """

    if mode not in VALID_RUN_MODES:
        raise ValueError(
            f"Unsupported simulation mode: {mode}"
        )

    now = utc_now()

    run = SimulationRun(
        run_id=generate_run_id(),
        mode=mode,
        status="starting",
        seed=seed,
        worker_id=worker_id,
        worker_version=worker_version,
        started_at=now,
        last_heartbeat_at=now,
        employees_loaded=0,
        events_generated=0,
        anomalies_scored=0,
        incidents_created=0,
        configuration=(
            configuration
            if configuration is not None
            else {}
        ),
        runtime_metadata=(
            runtime_metadata
            if runtime_metadata is not None
            else {}
        ),
        created_at=now,
        updated_at=now,
    )

    db.add(
        run
    )

    db.flush()

    return run


def get_simulation_run(
    *,
    db: Session,
    run_id: str,
) -> SimulationRun | None:
    """
    Retrieve a simulation run by its human-readable identifier.
    """

    return db.scalar(
        select(
            SimulationRun
        )
        .where(
            SimulationRun.run_id
            == run_id
        )
    )


def get_latest_simulation_run(
    *,
    db: Session,
) -> SimulationRun | None:
    """
    Return the most recently started simulation run.
    """

    return db.scalar(
        select(
            SimulationRun
        )
        .order_by(
            SimulationRun.started_at.desc(),
            SimulationRun.created_at.desc(),
        )
        .limit(1)
    )


def mark_simulation_run_running(
    *,
    db: Session,
    run_id: str,
    employees_loaded: int,
) -> SimulationRun:
    """
    Transition a run from STARTING to RUNNING.
    """

    _validate_non_negative(
        field_name="employees_loaded",
        value=employees_loaded,
    )

    run = get_simulation_run(
        db=db,
        run_id=run_id,
    )

    if run is None:
        raise LookupError(
            f"Simulation run not found: {run_id}"
        )

    if run.status in TERMINAL_RUN_STATUSES:
        raise RuntimeError(
            (
                "Cannot start a terminal simulation run: "
                f"{run.status}"
            )
        )

    now = utc_now()

    run.status = "running"
    run.employees_loaded = employees_loaded
    run.last_heartbeat_at = now
    run.updated_at = now

    db.flush()

    return run


def record_simulation_progress(
    *,
    db: Session,
    run_id: str,
    events_generated: int = 0,
    anomalies_scored: int = 0,
    incidents_created: int = 0,
) -> SimulationRun:
    """
    Atomically increment persistent run counters.

    Progress accounting is intentionally separate from worker heartbeat.

    A worker may generate many events between heartbeats, but every
    committed event must still be reflected exactly in SimulationRun.
    """

    _validate_non_negative(
        field_name="events_generated",
        value=events_generated,
    )

    _validate_non_negative(
        field_name="anomalies_scored",
        value=anomalies_scored,
    )

    _validate_non_negative(
        field_name="incidents_created",
        value=incidents_created,
    )

    now = utc_now()

    result = db.execute(
        update(
            SimulationRun
        )
        .where(
            SimulationRun.run_id == run_id,
            SimulationRun.status.not_in(
                TERMINAL_RUN_STATUSES
            ),
        )
        .values(
            updated_at=now,
            events_generated=(
                SimulationRun.events_generated
                + events_generated
            ),
            anomalies_scored=(
                SimulationRun.anomalies_scored
                + anomalies_scored
            ),
            incidents_created=(
                SimulationRun.incidents_created
                + incidents_created
            ),
        )
    )

    if result.rowcount != 1:
        existing = get_simulation_run(
            db=db,
            run_id=run_id,
        )

        if existing is None:
            raise LookupError(
                f"Simulation run not found: {run_id}"
            )

        raise RuntimeError(
            (
                "Cannot record progress for terminal "
                f"simulation run: {existing.status}"
            )
        )

    db.flush()

    refreshed = get_simulation_run(
        db=db,
        run_id=run_id,
    )

    if refreshed is None:
        raise RuntimeError(
            "Simulation run disappeared after progress update."
        )

    db.refresh(
        refreshed
    )

    return refreshed


def heartbeat_simulation_run(
    *,
    db: Session,
    run_id: str,
    events_generated: int = 0,
    anomalies_scored: int = 0,
    incidents_created: int = 0,
    runtime_metadata_update: dict[str, Any] | None = None,
) -> SimulationRun:
    """
    Record worker liveness and optionally increment runtime counters.

    Counter arguments remain supported for compatibility, but the live
    worker uses record_simulation_progress() for exact event accounting.

    runtime_metadata_update is merged with existing runtime metadata.
    """

    _validate_non_negative(
        field_name="events_generated",
        value=events_generated,
    )

    _validate_non_negative(
        field_name="anomalies_scored",
        value=anomalies_scored,
    )

    _validate_non_negative(
        field_name="incidents_created",
        value=incidents_created,
    )

    run = get_simulation_run(
        db=db,
        run_id=run_id,
    )

    if run is None:
        raise LookupError(
            f"Simulation run not found: {run_id}"
        )

    if run.status in TERMINAL_RUN_STATUSES:
        raise RuntimeError(
            (
                "Cannot heartbeat terminal "
                f"simulation run: {run.status}"
            )
        )

    now = utc_now()

    metadata = dict(
        run.runtime_metadata
        or {}
    )

    if runtime_metadata_update:
        metadata.update(
            runtime_metadata_update
        )

    run.last_heartbeat_at = now
    run.updated_at = now

    run.events_generated += (
        events_generated
    )

    run.anomalies_scored += (
        anomalies_scored
    )

    run.incidents_created += (
        incidents_created
    )

    run.runtime_metadata = metadata

    db.flush()

    return run


def mark_simulation_run_stopping(
    *,
    db: Session,
    run_id: str,
) -> SimulationRun:
    """
    Mark a running worker as intentionally stopping.
    """

    run = get_simulation_run(
        db=db,
        run_id=run_id,
    )

    if run is None:
        raise LookupError(
            f"Simulation run not found: {run_id}"
        )

    if run.status in TERMINAL_RUN_STATUSES:
        raise RuntimeError(
            (
                "Cannot stop a terminal simulation run: "
                f"{run.status}"
            )
        )

    now = utc_now()

    run.status = "stopping"
    run.last_heartbeat_at = now
    run.updated_at = now

    db.flush()

    return run


def mark_simulation_run_stopped(
    *,
    db: Session,
    run_id: str,
) -> SimulationRun:
    """
    Mark a simulation run as cleanly stopped.
    """

    run = get_simulation_run(
        db=db,
        run_id=run_id,
    )

    if run is None:
        raise LookupError(
            f"Simulation run not found: {run_id}"
        )

    if run.status == "failed":
        raise RuntimeError(
            "A failed simulation run cannot become stopped."
        )

    now = utc_now()

    run.status = "stopped"
    run.stopped_at = now
    run.last_heartbeat_at = now
    run.updated_at = now

    db.flush()

    return run


def mark_simulation_run_failed(
    *,
    db: Session,
    run_id: str,
    error_message: str,
) -> SimulationRun:
    """
    Mark a run as failed while preserving diagnostic metadata.
    """

    run = get_simulation_run(
        db=db,
        run_id=run_id,
    )

    if run is None:
        raise LookupError(
            f"Simulation run not found: {run_id}"
        )

    now = utc_now()

    metadata = dict(
        run.runtime_metadata
        or {}
    )

    metadata[
        "failure"
    ] = {
        "message": error_message,
        "timestamp": now.isoformat(),
    }

    run.status = "failed"
    run.stopped_at = now
    run.last_heartbeat_at = now
    run.updated_at = now
    run.runtime_metadata = metadata

    db.flush()

    return run


def record_simulation_ground_truth(
    *,
    db: Session,
    event: Event,
    scenario_instance_id: str | None,
    scenario_type: str | None,
    simulation_run: SimulationRun | None = None,
    benchmark_batch_id: str | None = None,
    is_injected: bool = True,
    attack_stage: str | None = None,
    sequence_number: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> SimulationGroundTruth:
    """
    Attach private evaluation truth to one observable event.

    Provenance must come from exactly one source:

    - simulation_run:
        live/development simulator execution

    - benchmark_batch_id:
        controlled reproducible benchmark

    The observable Event remains free of authoritative
    attack truth.
    """

    if (
        is_injected
        and not scenario_type
    ):
        raise ValueError(
            (
                "scenario_type is required "
                "for injected ground truth."
            )
        )


    if (
        sequence_number is not None
        and sequence_number < 1
    ):
        raise ValueError(
            "sequence_number must be >= 1."
        )


    normalized_batch_id = (
        benchmark_batch_id.strip()
        if benchmark_batch_id
        else None
    )


    has_simulation_run = (
        simulation_run is not None
    )

    has_benchmark_batch = (
        normalized_batch_id
        is not None
    )


    if (
        has_simulation_run
        == has_benchmark_batch
    ):
        raise ValueError(
            (
                "Ground-truth provenance must "
                "specify exactly one of "
                "simulation_run or "
                "benchmark_batch_id."
            )
        )


    existing = db.scalar(
        select(
            SimulationGroundTruth
        )
        .where(
            SimulationGroundTruth.event_uuid
            == event.id
        )
    )


    if existing is not None:
        raise RuntimeError(
            (
                "Ground truth already exists "
                f"for event {event.event_id}."
            )
        )


    truth = SimulationGroundTruth(
        simulation_run_id=(
            simulation_run.id
            if simulation_run
            is not None
            else None
        ),

        benchmark_batch_id=(
            normalized_batch_id
        ),

        event_uuid=event.id,

        scenario_instance_id=(
            scenario_instance_id
        ),

        scenario_type=(
            scenario_type
        ),

        is_injected=(
            is_injected
        ),

        attack_stage=(
            attack_stage
        ),

        sequence_number=(
            sequence_number
        ),

        ground_truth_metadata=(
            metadata
            if metadata is not None
            else {}
        ),
    )


    db.add(
        truth
    )

    db.flush()

    return truth
