"""
Integration tests for SENTINEL's always-on Event Processor runtime.

These tests exercise the real PostgreSQL-backed lifecycle and live-processing
contracts without starting the infinite worker loop itself.

Covered boundaries:

    processor activation / restart
        -> live Event discovery
        -> selected-model scoring
        -> processor counters / heartbeat
        -> selected-generation idempotency
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)

import pytest
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Employee,
    Event,
    EventProcessorState,
)
from app.selected_detector import (
    SELECTED_DETECTOR,
)
from app.services.event_processing import (
    EventProcessingService,
)
from app.services.event_processor_runtime import (
    PROCESSOR_NAME,
    PROCESSOR_VERSION,
    activate_processor,
    discover_live_events,
    mark_processor_running,
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
        name="Ali Raza",
        department="Engineering",
        job_role="Systems Engineer",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.110.1.25",
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
    event_timestamp: datetime,
    created_at: datetime | None = None,
    event_type: str = "LOGIN_SUCCESS",
) -> Event:
    """
    Persist one observable Event.

    event_timestamp is security-activity time.
    created_at is arrival time into SENTINEL.
    """

    event = Event(
        event_id=event_id,
        timestamp=event_timestamp,
        employee_id=employee.id,
        session_id="pytest-processor-session",
        event_type=event_type,
        source_ip=employee.typical_ip,
        destination_ip="10.110.5.10",
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
    )

    if created_at is not None:
        event.created_at = created_at

    db_session.add(
        event
    )

    db_session.flush()

    return event


def _activate_running_processor(
    db_session: Session,
    *,
    worker_id: str,
) -> EventProcessorState:
    state = activate_processor(
        db=db_session,
        worker_id=worker_id,
        configuration={
            "source": "pytest",
            "batch_size": 100,
        },
    )

    mark_processor_running(
        db=db_session,
        state=state,
    )

    db_session.flush()

    return state


# ============================================================
# Lifecycle
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_processor_restart_preserves_activation_boundary(
    db_session: Session,
) -> None:
    """
    Restarting the selected-detector processor must reuse its persistent
    state and must never advance activated_at.
    """

    first_state = _activate_running_processor(
        db_session,
        worker_id="pytest-worker-a",
    )

    original_id = first_state.id
    original_activated_at = (
        first_state.activated_at
    )

    assert original_id is not None

    assert (
        first_state.processor_name
        == PROCESSOR_NAME
    )

    assert (
        first_state.worker_version
        == PROCESSOR_VERSION
    )

    assert (
        first_state.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        first_state.detector_version
        == SELECTED_DETECTOR.version
    )

    assert first_state.status == "running"

    assert first_state.events_processed == 0
    assert first_state.scores_created == 0
    assert first_state.incidents_created == 0
    assert first_state.incidents_updated == 0

    # --------------------------------------------------------
    # Simulate worker restart.
    # --------------------------------------------------------

    restarted = activate_processor(
        db=db_session,
        worker_id="pytest-worker-b",
        configuration={
            "source": "pytest-restart",
            "batch_size": 25,
        },
    )

    assert restarted.id == original_id

    # Critical invariant: restart does NOT move the live boundary.
    assert (
        restarted.activated_at
        == original_activated_at
    )

    assert restarted.worker_id == "pytest-worker-b"
    assert restarted.status == "starting"

    assert (
        restarted.configuration[
            "batch_size"
        ]
        == 25
    )

    assert (
        "last_restart_at"
        in restarted.runtime_metadata
    )

    mark_processor_running(
        db=db_session,
        state=restarted,
    )

    assert restarted.status == "running"

    state_count = db_session.scalar(
        select(
            func.count(
                EventProcessorState.id
            )
        )
        .where(
            EventProcessorState.processor_name
            == PROCESSOR_NAME,

            EventProcessorState.detector_name
            == SELECTED_DETECTOR.name,

            EventProcessorState.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    assert state_count == 1


# ============================================================
# Live discovery
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_live_discovery_uses_arrival_boundary_and_excludes_already_scored_events(
    db_session: Session,
) -> None:
    """
    Live discovery must use Event.created_at as the processor-generation
    boundary, not the security event timestamp.

    It must also exclude Events already scored by the selected detector.
    """

    employee = _create_employee(
        db_session,
        user_id="processor_integration_user_001",
    )

    now = datetime.now(
        timezone.utc
    )

    # --------------------------------------------------------
    # Event that arrived before processor activation.
    # --------------------------------------------------------

    pre_activation_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-PROC-DISC-000001",
        event_timestamp=(
            now
            - timedelta(
                hours=2
            )
        ),
        created_at=(
            now
            - timedelta(
                minutes=10
            )
        ),
    )

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-discovery-worker",
    )

    # --------------------------------------------------------
    # Late-arriving historical log.
    #
    # Security timestamp predates activation, but arrival time is after
    # activation, therefore this IS valid live work.
    # --------------------------------------------------------

    late_arriving_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-PROC-DISC-000002",
        event_timestamp=(
            now
            - timedelta(
                days=2
            )
        ),
        created_at=(
            state.activated_at
            + timedelta(
                seconds=1
            )
        ),
    )

    later_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-PROC-DISC-000003",
        event_timestamp=(
            now
            + timedelta(
                minutes=1
            )
        ),
        created_at=(
            state.activated_at
            + timedelta(
                seconds=2
            )
        ),
        event_type="FILE_ACCESS",
    )

    already_scored_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-PROC-DISC-000004",
        event_timestamp=(
            now
            + timedelta(
                minutes=2
            )
        ),
        created_at=(
            state.activated_at
            + timedelta(
                seconds=3
            )
        ),
    )

    # Process one eligible event first so discovery must exclude it.
    service = EventProcessingService(
        db=db_session
    )

    processed = service.process_event(
        event_id=already_scored_event.id,
        processor_state_id=state.id,
    )

    assert processed.status == "PROCESSED"

    discovery = discover_live_events(
        db=db_session,
        state=state,
        batch_size=100,
    )

    discovered_ids = [
        event.event_id
        for event
        in discovery.events
    ]

    assert (
        pre_activation_event.event_id
        not in discovered_ids
    )

    assert (
        already_scored_event.event_id
        not in discovered_ids
    )

    # Arrival ordering must be deterministic.
    assert discovered_ids == [
        late_arriving_event.event_id,
        later_event.event_id,
    ]

    assert discovery.event_count == 2

    assert (
        discovery.activated_at
        == state.activated_at
    )

    assert (
        discovery.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        discovery.detector_version
        == SELECTED_DETECTOR.version
    )


# ============================================================
# Live processing accounting + idempotency
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_live_processing_scores_once_and_updates_processor_counters_once(
    db_session: Session,
) -> None:
    """
    Live processing should produce one selected-model score and increment
    processor accounting exactly once.

    Reprocessing the same Event must return SKIPPED_ALREADY_PROCESSED and
    leave counters unchanged.
    """

    employee = _create_employee(
        db_session,
        user_id="processor_integration_user_002",
    )

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-processing-worker",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-PROC-LIVE-000001",
        event_timestamp=(
            state.activated_at
            + timedelta(
                seconds=1
            )
        ),
        created_at=(
            state.activated_at
            + timedelta(
                seconds=1
            )
        ),
        event_type="LOGIN_SUCCESS",
    )

    heartbeat_before = (
        state.last_heartbeat_at
    )

    service = EventProcessingService(
        db=db_session
    )

    first_result = service.process_event(
        event_id=event.id,
        processor_state_id=state.id,
    )

    # --------------------------------------------------------
    # First processing attempt
    # --------------------------------------------------------

    assert first_result.status == "PROCESSED"
    assert first_result.event_id == event.event_id

    assert (
        first_result.anomaly_score_id
        is not None
    )

    assert (
        first_result.risk_level
        is not None
    )

    assert (
        first_result.anomaly_score
        is not None
    )

    assert (
        0.0
        <= first_result.anomaly_score
        <= 1.0
    )

    assert state.events_processed == 1
    assert state.scores_created == 1

    assert (
        state.incidents_created
        == first_result.incidents_created
    )

    assert (
        state.incidents_updated
        == first_result.incidents_updated
    )

    assert (
        state.last_heartbeat_at
        >= heartbeat_before
    )

    assert (
        state.runtime_metadata[
            "last_event_id"
        ]
        == event.event_id
    )

    assert (
        state.runtime_metadata[
            "last_event_uuid"
        ]
        == str(
            event.id
        )
    )

    assert (
        state.runtime_metadata[
            "last_risk_level"
        ]
        == first_result.risk_level
    )

    selected_scores = list(
        db_session.scalars(
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
        ).all()
    )

    assert len(selected_scores) == 1

    score = selected_scores[0]

    assert (
        score.id
        == first_result.anomaly_score_id
    )

    # --------------------------------------------------------
    # Reprocessing same Event
    # --------------------------------------------------------

    counters_before_second_attempt = (
        state.events_processed,
        state.scores_created,
        state.incidents_created,
        state.incidents_updated,
    )

    second_result = service.process_event(
        event_id=event.id,
        processor_state_id=state.id,
    )

    assert (
        second_result.status
        == "SKIPPED_ALREADY_PROCESSED"
    )

    assert (
        second_result.anomaly_score_id
        == first_result.anomaly_score_id
    )

    assert second_result.candidates_evaluated == 0
    assert second_result.incidents_created == 0
    assert second_result.incidents_updated == 0
    assert second_result.incident_ids == ()

    counters_after_second_attempt = (
        state.events_processed,
        state.scores_created,
        state.incidents_created,
        state.incidents_updated,
    )

    assert (
        counters_after_second_attempt
        == counters_before_second_attempt
    )

    selected_score_count = db_session.scalar(
        select(
            func.count(
                AnomalyScore.id
            )
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

    assert selected_score_count == 1


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_live_processing_skips_event_that_arrived_before_activation(
    db_session: Session,
) -> None:
    """
    Live processing must respect the processor generation's permanent
    activation boundary.

    An Event that arrived before activation must be skipped even when
    explicitly passed to process_event().
    """

    employee = _create_employee(
        db_session,
        user_id="processor_integration_user_003",
    )

    now = datetime.now(
        timezone.utc
    )

    # --------------------------------------------------------
    # Persist Event before processor activation.
    # --------------------------------------------------------

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-PROC-PREACT-000001",
        event_timestamp=(
            now
            - timedelta(
                hours=1
            )
        ),
        created_at=(
            now
            - timedelta(
                minutes=5
            )
        ),
        event_type="LOGIN_FAILURE",
    )

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-preactivation-worker",
    )

    assert (
        event.created_at
        < state.activated_at
    )

    original_heartbeat = (
        state.last_heartbeat_at
    )

    original_counters = (
        state.events_processed,
        state.scores_created,
        state.incidents_created,
        state.incidents_updated,
    )

    service = EventProcessingService(
        db=db_session
    )

    result = service.process_event(
        event_id=event.id,
        processor_state_id=state.id,
    )

    # --------------------------------------------------------
    # Explicit live processing still obeys activation boundary.
    # --------------------------------------------------------

    assert (
        result.status
        == "SKIPPED_BEFORE_ACTIVATION"
    )

    assert result.event_id == event.event_id

    assert result.anomaly_score_id is None
    assert result.risk_level is None
    assert result.anomaly_score is None

    assert result.candidates_evaluated == 0
    assert result.incidents_created == 0
    assert result.incidents_updated == 0
    assert result.incident_ids == ()

    # --------------------------------------------------------
    # No selected-model score must have been created.
    # --------------------------------------------------------

    selected_score_count = db_session.scalar(
        select(
            func.count(
                AnomalyScore.id
            )
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

    assert selected_score_count == 0

    # --------------------------------------------------------
    # Skipped Events do not affect live accounting.
    # --------------------------------------------------------

    current_counters = (
        state.events_processed,
        state.scores_created,
        state.incidents_created,
        state.incidents_updated,
    )

    assert (
        current_counters
        == original_counters
    )

    assert (
        state.last_heartbeat_at
        == original_heartbeat
    )


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_backfill_processes_historical_event_without_mutating_live_processor_state(
    db_session: Session,
) -> None:
    """
    Historical backfill must be able to process an Event that live processing
    correctly rejects because it arrived before activation.

    Backfill uses the same scoring/correlation/persistence pipeline but must
    not modify live processor counters, heartbeat, or activation boundary.
    """

    employee = _create_employee(
        db_session,
        user_id="processor_integration_user_004",
    )

    now = datetime.now(
        timezone.utc
    )

    historical_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-PROC-BACKFILL-000001",
        event_timestamp=(
            now
            - timedelta(
                days=3
            )
        ),
        created_at=(
            now
            - timedelta(
                hours=2
            )
        ),
        event_type="FILE_ACCESS",
    )

    state = _activate_running_processor(
        db_session,
        worker_id="pytest-backfill-worker",
    )

    assert (
        historical_event.created_at
        < state.activated_at
    )

    original_activation = (
        state.activated_at
    )

    original_heartbeat = (
        state.last_heartbeat_at
    )

    original_runtime_metadata = dict(
        state.runtime_metadata
        or {}
    )

    original_counters = (
        state.events_processed,
        state.scores_created,
        state.incidents_created,
        state.incidents_updated,
    )

    service = EventProcessingService(
        db=db_session
    )

    # --------------------------------------------------------
    # Live path rejects historical arrival.
    # --------------------------------------------------------

    live_result = service.process_event(
        event_id=historical_event.id,
        processor_state_id=state.id,
    )

    assert (
        live_result.status
        == "SKIPPED_BEFORE_ACTIVATION"
    )

    # --------------------------------------------------------
    # Maintenance/backfill path may process it.
    # --------------------------------------------------------

    backfill_result = (
        service.process_event_backfill(
            event_id=historical_event.id,
        )
    )

    assert backfill_result.status == "PROCESSED"

    assert (
        backfill_result.event_id
        == historical_event.event_id
    )

    assert (
        backfill_result.anomaly_score_id
        is not None
    )

    assert (
        backfill_result.risk_level
        is not None
    )

    assert (
        backfill_result.anomaly_score
        is not None
    )

    assert (
        0.0
        <= backfill_result.anomaly_score
        <= 1.0
    )

    # --------------------------------------------------------
    # Selected detector score really exists.
    # --------------------------------------------------------

    selected_scores = list(
        db_session.scalars(
            select(
                AnomalyScore
            )
            .where(
                AnomalyScore.event_uuid
                == historical_event.id,

                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,
            )
        ).all()
    )

    assert len(selected_scores) == 1

    assert (
        selected_scores[0].id
        == backfill_result.anomaly_score_id
    )

    # --------------------------------------------------------
    # Backfill must not mutate live processor state.
    # --------------------------------------------------------

    assert (
        state.activated_at
        == original_activation
    )

    assert (
        state.last_heartbeat_at
        == original_heartbeat
    )

    assert (
        dict(
            state.runtime_metadata
            or {}
        )
        == original_runtime_metadata
    )

    current_counters = (
        state.events_processed,
        state.scores_created,
        state.incidents_created,
        state.incidents_updated,
    )

    assert (
        current_counters
        == original_counters
    )

    # --------------------------------------------------------
    # Backfill must also be idempotent.
    # --------------------------------------------------------

    second_backfill = (
        service.process_event_backfill(
            event_id=historical_event.id,
        )
    )

    assert (
        second_backfill.status
        == "SKIPPED_ALREADY_PROCESSED"
    )

    assert (
        second_backfill.anomaly_score_id
        == backfill_result.anomaly_score_id
    )

    assert second_backfill.candidates_evaluated == 0
    assert second_backfill.incidents_created == 0
    assert second_backfill.incidents_updated == 0
    assert second_backfill.incident_ids == ()

    selected_score_count = db_session.scalar(
        select(
            func.count(
                AnomalyScore.id
            )
        )
        .where(
            AnomalyScore.event_uuid
            == historical_event.id,

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    assert selected_score_count == 1

    final_counters = (
        state.events_processed,
        state.scores_created,
        state.incidents_created,
        state.incidents_updated,
    )

    assert (
        final_counters
        == original_counters
    )
