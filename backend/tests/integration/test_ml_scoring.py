"""
Integration tests for SENTINEL's production ML scoring boundary.

These tests exercise the real promoted Isolation Forest artifact against
real PostgreSQL-backed Employee and Event rows:

    Employee / Event
        -> EventFeatureBuilder
        -> promoted Isolation Forest
        -> score_event()
        -> persisted AnomalyScore

Simulator ground truth and evaluation-only metadata are deliberately absent.
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
)
from app.selected_detector import (
    SELECTED_DETECTOR,
)
from app.services.ml_scoring import (
    get_selected_model,
    score_event,
)
from ml_engine.evaluation import (
    classify_ml_risk,
)
from ml_engine.features.feature_sets import (
    V1_FEATURE_COLUMNS,
)


# ============================================================
# Test helpers
# ============================================================


def _create_employee(
    db_session: Session,
    *,
    user_id: str,
) -> Employee:
    """
    Persist one realistic employee inside the isolated sentinel_test DB.
    """

    employee = Employee(
        user_id=user_id,
        name="Hamza Siddiqui",
        department="Engineering",
        job_role="Platform Engineer",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.60.1.25",
        typical_location="Karachi Office",
        typical_login_frequency=2,
        typical_files_accessed=20,
        typical_data_transfer_bytes=50_000_000,
        behavior_profile={
            "remote_work_probability": 0.20,
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
    timestamp: datetime,
    event_type: str,
    source_ip: str,
    destination_ip: str | None,
    source_location: str,
    bytes_sent: int,
    bytes_received: int,
    success: bool,
) -> Event:
    """
    Persist one observable operational Event.

    No synthetic attack label or evaluation-only field is attached.
    """

    event = Event(
        event_id=event_id,
        timestamp=timestamp,
        employee_id=employee.id,
        session_id="pytest-ml-session",
        event_type=event_type,
        source_ip=source_ip,
        destination_ip=destination_ip,
        source_location=source_location,
        resource_type="pytest",
        resource_name="pytest-resource",
        bytes_sent=bytes_sent,
        bytes_received=bytes_received,
        success=success,
        event_metadata={
            "source": "pytest",
        },
    )

    db_session.add(
        event
    )

    db_session.flush()

    return event


# ============================================================
# Production scoring integration
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_real_selected_model_scores_and_persists_exact_operational_contract(
    db_session: Session,
) -> None:
    """
    score_event() must use the promoted production detector and persist
    a lineage-correct, schema-bounded AnomalyScore.

    Re-scoring the same event must return the existing selected-model
    result instead of creating a duplicate row.
    """

    employee = _create_employee(
        db_session,
        user_id="ml_integration_user_001",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-INT-000001",
        timestamp=datetime(
            2026,
            2,
            15,
            22,
            30,
            tzinfo=timezone.utc,
        ),
        event_type="FILE_UPLOAD",
        source_ip="203.0.113.90",
        destination_ip="198.51.100.25",
        source_location="Remote / VPN",
        bytes_sent=2_000_000,
        bytes_received=3_000_000,
        success=True,
    )

    # --------------------------------------------------------
    # Real checked-in production model
    # --------------------------------------------------------

    detector = get_selected_model()

    assert (
        detector.model_name
        == SELECTED_DETECTOR.name
    )

    assert (
        detector.model_version
        == SELECTED_DETECTOR.version
    )

    assert (
        detector.feature_columns
        == V1_FEATURE_COLUMNS
    )

    assert len(
        detector.feature_columns
    ) == 17

    # --------------------------------------------------------
    # Real production scoring service
    # --------------------------------------------------------

    anomaly = score_event(
        db=db_session,
        event=event,
        employee=employee,
    )

    assert anomaly.id is not None

    assert (
        anomaly.event_uuid
        == event.id
    )

    assert (
        anomaly.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        anomaly.detector_version
        == SELECTED_DETECTOR.version
    )

    assert (
        anomaly.detector_type
        == SELECTED_DETECTOR.detector_type
    )

    # --------------------------------------------------------
    # Score semantics
    # --------------------------------------------------------

    assert (
        0.0
        <= anomaly.anomaly_score
        <= 1.0
    )

    assert (
        anomaly.risk_level
        == classify_ml_risk(
            anomaly.anomaly_score
        )
    )

    assert isinstance(
        anomaly.raw_score,
        float,
    )

    explanation = anomaly.explanation

    assert (
        explanation["model_name"]
        == SELECTED_DETECTOR.name
    )

    assert (
        explanation["model_version"]
        == SELECTED_DETECTOR.version
    )

    assert (
        explanation["alert_threshold"]
        == pytest.approx(
            detector.threshold_percentile
        )
    )

    assert (
        "Historical anomaly percentile"
        in explanation[
            "score_interpretation"
        ]
    )

    assert (
        "not a probability of attack"
        in explanation[
            "score_interpretation"
        ]
    )

    # --------------------------------------------------------
    # Exact production feature boundary
    # --------------------------------------------------------

    snapshot = anomaly.feature_snapshot

    assert set(
        snapshot.keys()
    ) == set(
        V1_FEATURE_COLUMNS
    )

    assert len(snapshot) == 17

    # Values expected from this event.
    assert snapshot[
        "outside_work_hours"
    ] == 1

    assert snapshot[
        "source_ip_is_baseline"
    ] == 0

    assert snapshot[
        "remote_work_probability"
    ] == pytest.approx(
        0.20
    )

    assert snapshot[
        "bytes_sent"
    ] == 2_000_000

    assert snapshot[
        "bytes_received"
    ] == 3_000_000

    assert snapshot[
        "total_bytes"
    ] == 5_000_000

    assert snapshot[
        "data_volume_ratio"
    ] == pytest.approx(
        0.10
    )

    assert snapshot[
        "success"
    ] == 1

    # No earlier events exist for this employee.
    assert snapshot[
        "failed_logins_10m"
    ] == 0

    assert snapshot[
        "events_5m"
    ] == 0

    assert snapshot[
        "file_events_30m"
    ] == 0

    assert snapshot[
        "network_events_5m"
    ] == 0

    assert snapshot[
        "unique_destinations_5m"
    ] == 0

    assert snapshot[
        "bytes_sent_30m"
    ] == 0

    assert snapshot[
        "bytes_received_30m"
    ] == 0

    # --------------------------------------------------------
    # GT and non-V1 fields must not leak into persisted features
    # --------------------------------------------------------

    forbidden_fields = {
        "is_injected_anomaly",
        "scenario_type",
        "simulation_run_id",
        "benchmark_batch_id",
        "ground_truth",
        "attack_label",

        # Observable metadata exists in the feature dataframe but
        # must not be part of the selected detector snapshot.
        "event_id",
        "event_timestamp",
        "employee_id",
        "user_id",
        "department",
        "event_type",

        # V2-only model features must not silently enter V1.
        "work_hour_deviation",
        "is_remote_context",
        "event_type_login_success",
        "event_type_login_failure",
        "event_type_logout",
        "event_type_file_access",
        "event_type_file_download",
        "event_type_file_upload",
        "event_type_database_access",
        "event_type_network_connection",
    }

    assert (
        forbidden_fields
        .isdisjoint(
            snapshot.keys()
        )
    )

    # --------------------------------------------------------
    # PostgreSQL persistence
    # --------------------------------------------------------

    persisted = db_session.scalar(
        select(
            AnomalyScore
        )
        .where(
            AnomalyScore.id
            == anomaly.id
        )
    )

    assert persisted is not None

    assert (
        persisted.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        persisted.detector_version
        == SELECTED_DETECTOR.version
    )

    # --------------------------------------------------------
    # Selected-version idempotency
    # --------------------------------------------------------

    second_result = score_event(
        db=db_session,
        event=event,
        employee=employee,
    )

    assert (
        second_result.id
        == anomaly.id
    )

    selected_score_count = (
        db_session.scalar(
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
    )

    assert selected_score_count == 1


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_incremental_scoring_builds_rolling_features_from_prior_observable_events(
    db_session: Session,
) -> None:
    """
    Incremental scoring must reconstruct rolling behavioral features from
    prior observable events belonging to the same employee.

    The current event itself must not be counted as its own history.
    """

    employee = _create_employee(
        db_session,
        user_id="ml_integration_user_002",
    )

    current_time = datetime(
        2026,
        2,
        16,
        22,
        0,
        tzinfo=timezone.utc,
    )

    # --------------------------------------------------------
    # Prior observable history
    # --------------------------------------------------------

    _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-HIST-000001",
        timestamp=(
            current_time
            - timedelta(
                minutes=5
            )
        ),
        event_type="LOGIN_FAILURE",
        source_ip="203.0.113.100",
        destination_ip="10.70.0.1",
        source_location="Remote / VPN",
        bytes_sent=100,
        bytes_received=200,
        success=False,
    )

    _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-HIST-000002",
        timestamp=(
            current_time
            - timedelta(
                minutes=2
            )
        ),
        event_type="FILE_ACCESS",
        source_ip="203.0.113.100",
        destination_ip="10.70.0.2",
        source_location="Remote / VPN",
        bytes_sent=1_000,
        bytes_received=2_000,
        success=True,
    )

    _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-HIST-000003",
        timestamp=(
            current_time
            - timedelta(
                minutes=1
            )
        ),
        event_type="NETWORK_CONNECTION",
        source_ip="203.0.113.100",
        destination_ip="10.70.0.3",
        source_location="Remote / VPN",
        bytes_sent=10_000,
        bytes_received=20_000,
        success=True,
    )

    # --------------------------------------------------------
    # Current event to score
    # --------------------------------------------------------

    current_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-HIST-000004",
        timestamp=current_time,
        event_type="NETWORK_CONNECTION",
        source_ip="203.0.113.100",
        destination_ip="10.70.0.4",
        source_location="Remote / VPN",
        bytes_sent=50_000,
        bytes_received=25_000,
        success=True,
    )

    anomaly = score_event(
        db=db_session,
        event=current_event,
        employee=employee,
    )

    snapshot = anomaly.feature_snapshot

    # --------------------------------------------------------
    # 10-minute authentication history
    # --------------------------------------------------------

    assert snapshot[
        "failed_logins_10m"
    ] == 1

    # --------------------------------------------------------
    # 5-minute activity history
    #
    # All three prior events are within the inclusive 5-minute window.
    # The current event itself must NOT be included.
    # --------------------------------------------------------

    assert snapshot[
        "events_5m"
    ] == 3

    assert snapshot[
        "network_events_5m"
    ] == 1

    assert snapshot[
        "unique_destinations_5m"
    ] == 3

    # --------------------------------------------------------
    # 30-minute file and byte history
    # --------------------------------------------------------

    assert snapshot[
        "file_events_30m"
    ] == 1

    assert snapshot[
        "bytes_sent_30m"
    ] == (
        100
        + 1_000
        + 10_000
    )

    assert snapshot[
        "bytes_received_30m"
    ] == (
        200
        + 2_000
        + 20_000
    )

    # Current event values remain separate from historical windows.
    assert snapshot[
        "bytes_sent"
    ] == 50_000

    assert snapshot[
        "bytes_received"
    ] == 25_000

    assert snapshot[
        "total_bytes"
    ] == 75_000

    # --------------------------------------------------------
    # Production schema remains the selected 17-feature V1 contract
    # --------------------------------------------------------

    detector = get_selected_model()

    assert (
        detector.feature_columns
        == V1_FEATURE_COLUMNS
    )

    assert set(
        snapshot.keys()
    ) == set(
        V1_FEATURE_COLUMNS
    )

    assert len(snapshot) == 17

    assert (
        0.0
        <= anomaly.anomaly_score
        <= 1.0
    )

    assert (
        anomaly.risk_level
        == classify_ml_risk(
            anomaly.anomaly_score
        )
    )


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_batch_scoring_scores_only_unscored_events_with_selected_detector(
    db_session: Session,
) -> None:
    """
    score_unscored_events() must score only events missing the currently
    selected detector generation and persist correct selected-model lineage.
    """

    from app.services.ml_scoring import (
        score_unscored_events,
    )

    employee = _create_employee(
        db_session,
        user_id="ml_integration_user_003",
    )

    base_time = datetime(
        2026,
        2,
        17,
        10,
        0,
        tzinfo=timezone.utc,
    )

    event_1 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-BATCH-000001",
        timestamp=base_time,
        event_type="LOGIN_SUCCESS",
        source_ip=employee.typical_ip,
        destination_ip="10.80.0.1",
        source_location=employee.typical_location,
        bytes_sent=100,
        bytes_received=200,
        success=True,
    )

    event_2 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-BATCH-000002",
        timestamp=(
            base_time
            + timedelta(
                minutes=1
            )
        ),
        event_type="FILE_ACCESS",
        source_ip=employee.typical_ip,
        destination_ip="10.80.0.2",
        source_location=employee.typical_location,
        bytes_sent=1_000,
        bytes_received=2_000,
        success=True,
    )

    event_3 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-BATCH-000003",
        timestamp=(
            base_time
            + timedelta(
                minutes=2
            )
        ),
        event_type="NETWORK_CONNECTION",
        source_ip=employee.typical_ip,
        destination_ip="10.80.0.3",
        source_location=employee.typical_location,
        bytes_sent=5_000,
        bytes_received=7_000,
        success=True,
    )

    # Pre-score one event incrementally.
    existing = score_event(
        db=db_session,
        event=event_1,
        employee=employee,
    )

    assert existing.id is not None

    summary = score_unscored_events(
        db=db_session,
    )

    assert summary.available_events == 3
    assert summary.existing_scores == 1
    assert summary.new_scores == 2

    selected_scores = list(
        db_session.scalars(
            select(
                AnomalyScore
            )
            .where(
                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,
            )
        ).all()
    )

    assert len(selected_scores) == 3

    assert {
        score.event_uuid
        for score in selected_scores
    } == {
        event_1.id,
        event_2.id,
        event_3.id,
    }

    for score in selected_scores:
        assert (
            score.detector_name
            == SELECTED_DETECTOR.name
        )

        assert (
            score.detector_version
            == SELECTED_DETECTOR.version
        )

        assert (
            score.detector_type
            == SELECTED_DETECTOR.detector_type
        )

        assert (
            0.0
            <= score.anomaly_score
            <= 1.0
        )

        assert (
            score.risk_level
            == classify_ml_risk(
                score.anomaly_score
            )
        )

        assert set(
            score.feature_snapshot.keys()
        ) == set(
            V1_FEATURE_COLUMNS
        )


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_batch_scoring_is_idempotent_for_selected_detector_generation(
    db_session: Session,
) -> None:
    """
    Running batch scoring twice must not create duplicate AnomalyScore rows
    for the same Event + selected detector generation.
    """

    from app.services.ml_scoring import (
        score_unscored_events,
    )

    employee = _create_employee(
        db_session,
        user_id="ml_integration_user_004",
    )

    base_time = datetime(
        2026,
        2,
        18,
        11,
        0,
        tzinfo=timezone.utc,
    )

    events: list[Event] = []

    for index in range(
        1,
        4,
    ):
        event = _create_event(
            db_session,
            employee=employee,
            event_id=(
                f"EVT-ML-IDEMP-{index:06d}"
            ),
            timestamp=(
                base_time
                + timedelta(
                    minutes=index
                )
            ),
            event_type=(
                "LOGIN_FAILURE"
                if index == 1
                else "FILE_ACCESS"
            ),
            source_ip=employee.typical_ip,
            destination_ip=(
                f"10.90.0.{index}"
            ),
            source_location=employee.typical_location,
            bytes_sent=(
                100 * index
            ),
            bytes_received=(
                200 * index
            ),
            success=(
                index != 1
            ),
        )

        events.append(
            event
        )

    first_summary = score_unscored_events(
        db=db_session,
    )

    assert first_summary.available_events == 3
    assert first_summary.new_scores == 3
    assert first_summary.existing_scores == 0

    first_count = db_session.scalar(
        select(
            func.count(
                AnomalyScore.id
            )
        )
        .where(
            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    assert first_count == 3

    second_summary = score_unscored_events(
        db=db_session,
    )

    assert second_summary.available_events == 3
    assert second_summary.new_scores == 0
    assert second_summary.existing_scores == 3

    second_count = db_session.scalar(
        select(
            func.count(
                AnomalyScore.id
            )
        )
        .where(
            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    assert second_count == 3

    # One and only one selected-generation score per event.
    for event in events:
        count_for_event = db_session.scalar(
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

        assert count_for_event == 1
