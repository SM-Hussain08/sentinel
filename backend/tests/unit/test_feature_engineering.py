"""
Unit tests for SENTINEL's deterministic feature engineering.

These tests exercise only observable operational data and employee
behavioral baselines. Simulator ground truth is intentionally absent.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timezone,
)

import pytest

from app.models import (
    Employee,
    Event,
)
from app.services.feature_engineering import (
    extract_behavioral_features,
)


def make_employee(
    *,
    start_hour: int = 9,
    end_hour: int = 17,
    typical_ip: str = "10.0.0.10",
    typical_bytes: int = 1_000,
) -> Employee:
    return Employee(
        user_id="unit_user_001",
        name="Unit Test User",
        department="Engineering",
        job_role="Engineer",
        normal_start_hour=start_hour,
        normal_end_hour=end_hour,
        typical_ip=typical_ip,
        typical_location="Test Office",
        typical_data_transfer_bytes=(
            typical_bytes
        ),
    )


def make_event(
    *,
    hour: int = 12,
    source_ip: str = "10.0.0.10",
    bytes_sent: int = 100,
    bytes_received: int = 50,
    success: bool = True,
    event_type: str = "network",
) -> Event:
    return Event(
        event_id="unit_event_001",
        timestamp=datetime(
            2026,
            1,
            15,
            hour,
            0,
            tzinfo=timezone.utc,
        ),
        source_ip=source_ip,
        bytes_sent=bytes_sent,
        bytes_received=bytes_received,
        success=success,
        event_type=event_type,
        event_metadata={},
    )


@pytest.mark.unit
def test_feature_engineering_inside_work_hours() -> None:
    employee = make_employee()
    event = make_event(
        hour=12
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["outside_work_hours"]
        is False
    )


@pytest.mark.unit
def test_feature_engineering_before_work_hours() -> None:
    employee = make_employee()
    event = make_event(
        hour=8
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["outside_work_hours"]
        is True
    )


@pytest.mark.unit
def test_feature_engineering_end_hour_is_outside() -> None:
    """
    The normal end hour is exclusive.

    For a 09:00-17:00 baseline, 17:00 is outside work hours.
    """

    employee = make_employee()
    event = make_event(
        hour=17
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["outside_work_hours"]
        is True
    )


@pytest.mark.unit
def test_feature_engineering_detects_unusual_ip() -> None:
    employee = make_employee(
        typical_ip="10.0.0.10"
    )

    event = make_event(
        source_ip="203.0.113.50"
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["unusual_source_ip"]
        is True
    )


@pytest.mark.unit
def test_feature_engineering_accepts_baseline_ip() -> None:
    employee = make_employee(
        typical_ip="10.0.0.10"
    )

    event = make_event(
        source_ip="10.0.0.10"
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["unusual_source_ip"]
        is False
    )


@pytest.mark.unit
def test_feature_engineering_calculates_transfer_volume() -> None:
    employee = make_employee(
        typical_bytes=1_000
    )

    event = make_event(
        bytes_sent=300,
        bytes_received=200,
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert features["total_bytes"] == 500
    assert features["typical_daily_bytes"] == 1_000

    assert (
        features["data_volume_ratio"]
        == 0.5
    )


@pytest.mark.unit
def test_feature_engineering_protects_against_zero_baseline() -> None:
    """
    A zero baseline must not cause division-by-zero.
    """

    employee = make_employee(
        typical_bytes=0
    )

    event = make_event(
        bytes_sent=2,
        bytes_received=3,
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["typical_daily_bytes"]
        == 1
    )

    assert (
        features["data_volume_ratio"]
        == 5.0
    )


@pytest.mark.unit
def test_feature_engineering_marks_failed_operation() -> None:
    employee = make_employee()

    event = make_event(
        success=False
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["failed_operation"]
        is True
    )


@pytest.mark.unit
def test_feature_engineering_preserves_event_type() -> None:
    employee = make_employee()

    event = make_event(
        event_type="file_access"
    )

    features = extract_behavioral_features(
        event,
        employee,
    )

    assert (
        features["event_type"]
        == "file_access"
    )


@pytest.mark.unit
@pytest.mark.safety
def test_feature_engineering_output_contains_no_ground_truth_fields() -> None:
    """
    Operational feature output must contain no simulator truth labels.
    """

    employee = make_employee()
    event = make_event()

    features = extract_behavioral_features(
        event,
        employee,
    )

    forbidden = {
        "is_injected",
        "scenario_type",
        "attack_stage",
        "ground_truth",
        "simulation_ground_truth",
    }

    assert (
        forbidden.intersection(
            features.keys()
        )
        == set()
    )