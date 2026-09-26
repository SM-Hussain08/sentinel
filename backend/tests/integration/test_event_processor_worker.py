"""
PostgreSQL-backed integration tests for EventProcessorWorker.

These tests verify real worker database/session behavior while remaining
isolated inside the dedicated sentinel_test database.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

import app.workers.event_processor as worker_module

from app.models import (
    AnomalyScore,
    Employee,
    Event,
    EventProcessorState,
)
from app.selected_detector import (
    SELECTED_DETECTOR,
)
from app.workers.event_processor import (
    EventProcessorWorker,
    ProcessorConfig,
)


# ============================================================
# Helpers
# ============================================================


def _make_worker() -> EventProcessorWorker:
    return EventProcessorWorker(
        config=ProcessorConfig(
            poll_interval_seconds=1.0,
            batch_size=100,
            worker_id="pytest-db-worker",
        )
    )


def _create_employee(
    db_session: Session,
    *,
    user_id: str,
) -> Employee:
    employee = Employee(
        user_id=user_id,
        name="Worker Integration User",
        department="Engineering",
        job_role="Systems Engineer",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.140.1.25",
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
) -> Event:
    event = Event(
        event_id=event_id,
        timestamp=created_at,
        employee_id=employee.id,
        session_id="pytest-worker-session",
        event_type="LOGIN_SUCCESS",
        source_ip=employee.typical_ip,
        destination_ip="10.140.5.10",
        source_location=employee.typical_location,
        resource_type="authentication",
        resource_name="corporate-sso",
        bytes_sent=500,
        bytes_received=1_000,
        success=True,
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


@pytest.fixture
def patch_worker_sessionlocal(
    monkeypatch: pytest.MonkeyPatch,
    db_connection,
):
    """
    Redirect worker-created sessions into pytest's outer test transaction.

    Worker methods call SessionLocal() internally and may commit. Using
    create_savepoint keeps those commits contained by the outer transaction.
    """

    TestingSessionLocal = sessionmaker(
        bind=db_connection,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    monkeypatch.setattr(
        worker_module,
        "SessionLocal",
        TestingSessionLocal,
    )

    return TestingSessionLocal


# ============================================================
# Activation + discovery
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_worker_activation_persists_running_state_and_discovery_returns_live_ids(
    db_session: Session,
    patch_worker_sessionlocal,
) -> None:
    worker = _make_worker()

    employee = _create_employee(
        db_session,
        user_id="worker_db_user_001",
    )

    # Event before activation should never be discovered as live work.
    before = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-WORKER-DB-000001",
        created_at=(
            datetime.now(
                timezone.utc
            )
            - timedelta(
                minutes=5
            )
        ),
    )

    db_session.commit()

    worker._activate()

    assert worker._state_id is not None

    state = db_session.get(
        EventProcessorState,
        worker._state_id,
    )

    db_session.refresh(
        state
    )

    assert state is not None
    assert state.status == "running"
    assert state.worker_id == "pytest-db-worker"

    assert (
        state.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        state.detector_version
        == SELECTED_DETECTOR.version
    )

    # Post-activation Event must be eligible.
    after = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-WORKER-DB-000002",
        created_at=(
            state.activated_at
            + timedelta(
                seconds=1
            )
        ),
    )

    db_session.commit()

    discovered = worker._discover_event_ids()

    assert before.id not in discovered
    assert after.id in discovered


# ============================================================
# Successful per-event transaction
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_worker_process_one_event_commits_selected_model_score(
    db_session: Session,
    patch_worker_sessionlocal,
) -> None:
    worker = _make_worker()

    employee = _create_employee(
        db_session,
        user_id="worker_db_user_002",
    )

    db_session.commit()

    worker._activate()

    state = db_session.get(
        EventProcessorState,
        worker._state_id,
    )

    db_session.refresh(
        state
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-WORKER-DB-000003",
        created_at=(
            state.activated_at
            + timedelta(
                seconds=1
            )
        ),
    )

    db_session.commit()

    result = worker._process_one_event(
        event.id
    )

    assert result is not None
    assert result.status == "PROCESSED"

    score = db_session.scalar(
        select(
            AnomalyScore
        )
        .where(
            AnomalyScore.event_uuid
            == event.id,

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    assert score is not None

    refreshed_state = db_session.get(
        EventProcessorState,
        worker._state_id,
    )

    db_session.refresh(
        refreshed_state
    )

    assert refreshed_state.events_processed == 1
    assert refreshed_state.scores_created == 1

    assert (
        refreshed_state.runtime_metadata[
            "last_event_id"
        ]
        == event.event_id
    )


# ============================================================
# Event failure isolation
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_worker_event_failure_rolls_back_event_transaction_and_records_error(
    db_session: Session,
    patch_worker_sessionlocal,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _make_worker()

    worker._activate()

    state_id = worker._state_id

    assert state_id is not None

    class FailingService:
        def __init__(
            self,
            *,
            db,
        ):
            self.db = db

        def process_event(
            self,
            *,
            event_id,
            processor_state_id,
        ):
            del event_id
            del processor_state_id

            raise RuntimeError(
                "synthetic event processing failure"
            )

    monkeypatch.setattr(
        worker_module,
        "EventProcessingService",
        FailingService,
    )

    result = worker._process_one_event(
        UUID(
            "11111111-1111-1111-1111-111111111111"
        )
    )

    # Per-event failure does not kill the worker.
    assert result is None

    state = db_session.get(
        EventProcessorState,
        state_id,
    )

    db_session.refresh(
        state
    )

    assert (
        state.last_error
        == "synthetic event processing failure"
    )

    assert (
        state.runtime_metadata[
            "last_event_error"
        ]
        == "synthetic event processing failure"
    )

    # No live processing counters were incremented.
    assert state.events_processed == 0
    assert state.scores_created == 0


# ============================================================
# Idle heartbeat
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_worker_idle_heartbeat_persists_runtime_metadata(
    db_session: Session,
    patch_worker_sessionlocal,
) -> None:
    worker = _make_worker()

    worker._activate()

    state = db_session.get(
        EventProcessorState,
        worker._state_id,
    )

    db_session.refresh(
        state
    )

    heartbeat_before = (
        state.last_heartbeat_at
    )

    worker._heartbeat_idle()

    db_session.refresh(
        state
    )

    assert (
        state.last_heartbeat_at
        >= heartbeat_before
    )

    assert (
        state.runtime_metadata[
            "worker_state"
        ]
        == "idle"
    )

    assert (
        "last_poll_epoch"
        in state.runtime_metadata
    )


# ============================================================
# Failure + clean shutdown state
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_worker_failure_and_clean_stop_persist_correct_lifecycle_states(
    db_session: Session,
    patch_worker_sessionlocal,
) -> None:
    # --------------------------------------------------------
    # Failure state
    # --------------------------------------------------------

    failed_worker = _make_worker()

    failed_worker._activate()

    failed_worker._record_failure(
        RuntimeError(
            "synthetic worker failure"
        )
    )

    failed_state = db_session.get(
        EventProcessorState,
        failed_worker._state_id,
    )

    db_session.refresh(
        failed_state
    )

    assert failed_state.status == "failed"

    assert (
        failed_state.last_error
        == "synthetic worker failure"
    )

    assert failed_state.stopped_at is not None

    # _record_clean_stop must preserve FAILED.
    failed_worker._record_clean_stop()

    db_session.refresh(
        failed_state
    )

    assert failed_state.status == "failed"

    # --------------------------------------------------------
    # Clean stop requires a fresh selected-generation row.
    #
    # The processor state is unique per detector generation, so emulate
    # a fresh test generation by resetting the persisted lifecycle row.
    # --------------------------------------------------------

    failed_state.status = "running"
    failed_state.last_error = None
    failed_state.stopped_at = None

    db_session.commit()

    clean_worker = _make_worker()

    clean_worker._state_id = (
        failed_state.id
    )

    clean_worker._record_clean_stop()

    db_session.refresh(
        failed_state
    )

    assert failed_state.status == "stopped"
    assert failed_state.stopped_at is not None
