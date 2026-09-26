"""
Integration tests for SENTINEL's ground-truth separation boundary.

Core architectural rule:

    Ground truth belongs to evaluation, never inference.

These tests prove that operational feature generation and ML scoring do not
even access the private evaluation-label function, while the explicitly
opted-in evaluation path remains capable of attaching evaluation metadata.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)

import pytest
from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Employee,
    Event,
)
from app.services.ml_scoring import (
    score_event,
    score_unscored_events,
)
from ml_engine.features import (
    EventFeatureBuilder,
)
import ml_engine.features.event_features as event_features_module


# ============================================================
# Constants
# ============================================================


GROUND_TRUTH_KEYS = {
    "is_injected_anomaly",
    "scenario_type",
    "scenario_instance_id",
    "sequence_number",
    "simulation_run_id",
    "benchmark_batch_id",
    "ground_truth",
    "ground_truth_metadata",
    "simulation_ground_truth",
    "attack_label",
}


# ============================================================
# Test helpers
# ============================================================


def _create_employee(
    db_session: Session,
    *,
    user_id: str,
) -> Employee:
    employee = Employee(
        user_id=user_id,
        name="Zain Ali",
        department="Engineering",
        job_role="Security Engineer",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.100.1.25",
        typical_location="Karachi Office",
        typical_login_frequency=2,
        typical_files_accessed=20,
        typical_data_transfer_bytes=50_000_000,
        behavior_profile={
            "remote_work_probability": 0.15,
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
    event_type: str = "LOGIN_SUCCESS",
) -> Event:
    event = Event(
        event_id=event_id,
        timestamp=timestamp,
        employee_id=employee.id,
        session_id="pytest-gt-boundary",
        event_type=event_type,
        source_ip=employee.typical_ip,
        destination_ip="10.100.5.10",
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

    db_session.add(
        event
    )

    db_session.flush()

    return event


def _raise_if_ground_truth_is_accessed(
    **kwargs,
):
    """
    Sentinel used by operational tests.

    If an operational code path reaches the private evaluation accessor,
    the test must fail immediately.
    """

    raise AssertionError(
        "Operational inference attempted to access "
        "private simulator ground truth."
    )


# ============================================================
# Schema separation
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_operational_event_and_anomaly_tables_have_no_ground_truth_columns(
    db_session: Session,
) -> None:
    """
    Observable Event rows and detector-output AnomalyScore rows must not
    contain simulator/evaluation ground-truth columns in their schemas.
    """

    # db_session is intentionally required so this remains part of the
    # PostgreSQL integration contract rather than a disconnected model test.
    assert db_session is not None

    event_columns = {
        column.name
        for column
        in Event.__table__.columns
    }

    anomaly_columns = {
        column.name
        for column
        in AnomalyScore.__table__.columns
    }

    assert (
        GROUND_TRUTH_KEYS
        .isdisjoint(
            event_columns
        )
    )

    assert (
        GROUND_TRUTH_KEYS
        .isdisjoint(
            anomaly_columns
        )
    )


# ============================================================
# Incremental feature path
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_live_feature_generation_never_reads_ground_truth_by_default(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    The live/incremental feature path defaults to evaluation metadata OFF.

    Replacing the private truth accessor with a function that always raises
    proves this code path does not merely ignore GT after reading it; it never
    requests GT at all.
    """

    monkeypatch.setattr(
        event_features_module,
        "get_event_evaluation_label",
        _raise_if_ground_truth_is_accessed,
    )

    employee = _create_employee(
        db_session,
        user_id="gt_boundary_user_001",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-BOUNDARY-000001",
        timestamp=datetime(
            2026,
            2,
            19,
            10,
            0,
            tzinfo=timezone.utc,
        ),
    )

    builder = EventFeatureBuilder(
        db=db_session
    )

    # Deliberately rely on the live method's production-safe default.
    row = builder.build_event_row(
        event=event,
        employee=employee,
    )

    assert (
        GROUND_TRUTH_KEYS
        .isdisjoint(
            row.keys()
        )
    )

    assert (
        row["event_id"]
        == event.event_id
    )


# ============================================================
# Incremental ML scoring path
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_incremental_ml_scoring_never_reads_private_ground_truth(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Real production score_event() must succeed even when any attempt to read
    private simulator truth raises immediately.
    """

    monkeypatch.setattr(
        event_features_module,
        "get_event_evaluation_label",
        _raise_if_ground_truth_is_accessed,
    )

    employee = _create_employee(
        db_session,
        user_id="gt_boundary_user_002",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-BOUNDARY-000002",
        timestamp=datetime(
            2026,
            2,
            19,
            22,
            0,
            tzinfo=timezone.utc,
        ),
        event_type="LOGIN_FAILURE",
    )

    anomaly = score_event(
        db=db_session,
        event=event,
        employee=employee,
    )

    assert anomaly.id is not None

    assert (
        GROUND_TRUTH_KEYS
        .isdisjoint(
            anomaly.feature_snapshot.keys()
        )
    )

    assert (
        GROUND_TRUTH_KEYS
        .isdisjoint(
            anomaly.explanation.keys()
        )
    )


# ============================================================
# Batch / backfill ML scoring path
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.ml
def test_batch_ml_scoring_never_reads_private_ground_truth(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Real score_unscored_events() must explicitly disable evaluation metadata.

    This protects the historical/backfill operational path as well as the
    live incremental path.
    """

    monkeypatch.setattr(
        event_features_module,
        "get_event_evaluation_label",
        _raise_if_ground_truth_is_accessed,
    )

    employee = _create_employee(
        db_session,
        user_id="gt_boundary_user_003",
    )

    base_time = datetime(
        2026,
        2,
        20,
        9,
        0,
        tzinfo=timezone.utc,
    )

    _create_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-BATCH-000001",
        timestamp=base_time,
    )

    _create_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-BATCH-000002",
        timestamp=(
            base_time
            + timedelta(
                minutes=1
            )
        ),
        event_type="FILE_ACCESS",
    )

    summary = score_unscored_events(
        db=db_session,
    )

    assert summary.available_events == 2
    assert summary.new_scores == 2
    assert summary.existing_scores == 0


# ============================================================
# Explicit evaluation opt-in
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_evaluation_feature_path_can_explicitly_attach_private_labels(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Evaluation metadata is still available when a benchmark caller explicitly
    opts in.

    This verifies separation rather than accidental deletion of evaluation
    capability.
    """

    calls: list[object] = []

    def fake_evaluation_label(
        *,
        db: Session,
        event_uuid,
    ) -> tuple[int, str]:
        calls.append(
            event_uuid
        )

        assert db is db_session

        return (
            1,
            "pytest-controlled-scenario",
        )

    monkeypatch.setattr(
        event_features_module,
        "get_event_evaluation_label",
        fake_evaluation_label,
    )

    employee = _create_employee(
        db_session,
        user_id="gt_boundary_user_004",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-GT-EVAL-000001",
        timestamp=datetime(
            2026,
            2,
            21,
            13,
            0,
            tzinfo=timezone.utc,
        ),
        event_type="FILE_ACCESS",
    )

    builder = EventFeatureBuilder(
        db=db_session
    )

    row = builder.build_event_row(
        event=event,
        employee=employee,
        include_evaluation_metadata=True,
    )

    assert calls == [
        event.id
    ]

    assert (
        row[
            "is_injected_anomaly"
        ]
        == 1
    )

    assert (
        row[
            "scenario_type"
        ]
        == "pytest-controlled-scenario"
    )

    # Evaluation labels are attached as metadata only. They are not part of
    # the observable Event database model.
    assert (
        "is_injected_anomaly"
        not in {
            column.name
            for column
            in Event.__table__.columns
        }
    )

    assert (
        "scenario_type"
        not in {
            column.name
            for column
            in Event.__table__.columns
        }
    )
