"""
FastAPI contract tests for selected-detector anomaly endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
@pytest.mark.postgres
def test_anomaly_list_uses_selected_detector_and_orders_by_score(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/anomalies"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 2

    assert (
        payload[0]["event_id"]
        == "EVT-API-000001"
    )

    assert payload[0]["anomaly_score"] == 0.997
    assert payload[0]["risk_level"] == "CRITICAL"

    assert (
        payload[1]["event_id"]
        == "EVT-API-000002"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_anomaly_response_describes_percentile_not_probability(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/anomalies"
    )

    payload = response.json()

    interpretation = (
        payload[0]["explanation"][
            "score_interpretation"
        ]
        .casefold()
    )

    assert "percentile" in interpretation

    assert (
        "not probability"
        in interpretation
    )


@pytest.mark.api
@pytest.mark.postgres
def test_paginated_anomaly_feed_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/ml/anomalies/paged"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total"] == 2
    assert payload["limit"] == 50
    assert payload["offset"] == 0

    assert payload["has_previous"] is False
    assert payload["has_next"] is False

    assert len(payload["items"]) == 2

    assert (
        payload["items"][0]["event_id"]
        == "EVT-API-000001"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_paginated_anomaly_feed_filters_by_risk(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/ml/anomalies/paged"
        "?risk_level=high"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total"] == 1

    assert (
        payload["items"][0]["risk_level"]
        == "HIGH"
    )

    assert (
        payload["items"][0]["event_id"]
        == "EVT-API-000002"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_paginated_anomaly_feed_searches_event_and_employee(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/ml/anomalies/paged"
        "?search=api_user_001"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total"] == 2


@pytest.mark.api
@pytest.mark.postgres
def test_paginated_anomaly_feed_supports_pagination(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    first_page = client.get(
        "/api/v1/ml/anomalies/paged"
        "?limit=1&offset=0"
    )

    second_page = client.get(
        "/api/v1/ml/anomalies/paged"
        "?limit=1&offset=1"
    )

    assert first_page.status_code == 200
    assert second_page.status_code == 200

    first_payload = first_page.json()
    second_payload = second_page.json()

    assert first_payload["has_next"] is True
    assert first_payload["has_previous"] is False

    assert second_payload["has_next"] is False
    assert second_payload["has_previous"] is True

# ============================================================
# Incremental event analysis
# ============================================================

from datetime import (
    datetime,
    timezone,
)

from sqlalchemy.orm import Session

import app.api.anomalies as anomalies_api

from app.models import (
    AnomalyScore,
    Employee,
    Event,
)

from app.selected_detector import (
    SELECTED_DETECTOR,
)


def _create_analyze_employee(
    db_session: Session,
) -> Employee:
    employee = Employee(
        user_id="analyze_api_user",
        name="Analyze Test User",
        department="Security",
        job_role="SOC Analyst",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.90.1.25",
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


def _create_analyze_event(
    db_session: Session,
    *,
    employee: Employee,
    event_id: str,
) -> Event:
    event = Event(
        event_id=event_id,
        timestamp=datetime(
            2026,
            9,
            22,
            17,
            0,
            tzinfo=timezone.utc,
        ),
        employee_id=employee.id,
        session_id="pytest-analyze-api-session",
        event_type="LOGIN_FAILURE",
        source_ip="203.0.113.90",
        destination_ip="10.90.5.10",
        source_location="Remote",
        resource_type="authentication",
        resource_name="corporate-sso",
        bytes_sent=500,
        bytes_received=1_000,
        success=False,
        event_metadata={
            "source":
                "pytest",
        },
    )

    db_session.add(
        event
    )

    db_session.flush()

    return event


@pytest.mark.api
@pytest.mark.postgres
def test_analyze_event_returns_404_for_missing_event(
    client: TestClient,
) -> None:
    response = client.post(
        (
            "/api/v1/anomalies/analyze/"
            "EVT-DOES-NOT-EXIST"
        )
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": (
            "Event 'EVT-DOES-NOT-EXIST' "
            "was not found."
        )
    }


@pytest.mark.api
@pytest.mark.postgres
def test_analyze_event_returns_selected_detector_result(
    db_session: Session,
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee = _create_analyze_employee(
        db_session
    )

    event = _create_analyze_event(
        db_session,
        employee=employee,
        event_id="EVT-ANALYZE-001",
    )

    fake_anomaly = AnomalyScore(
        event_uuid=event.id,

        detector_name=(
            SELECTED_DETECTOR.name
        ),

        detector_version=(
            SELECTED_DETECTOR.version
        ),

        detector_type=(
            SELECTED_DETECTOR.detector_type
        ),

        raw_score=-0.42,

        anomaly_score=0.97,

        risk_level="CRITICAL",

        feature_snapshot={
            "failed_logins_10m":
                4,
        },

        explanation={
            "score_interpretation": (
                "Historical anomaly percentile; "
                "not probability of attack."
            ),

            "alert_threshold_reached":
                True,
        },
    )

    db_session.add(
        fake_anomaly
    )

    db_session.flush()

    recorded = {}

    def fake_score_event(
        *,
        db,
        event,
        employee,
    ):
        recorded[
            "db"
        ] = db

        recorded[
            "event"
        ] = event

        recorded[
            "employee"
        ] = employee

        return fake_anomaly

    monkeypatch.setattr(
        anomalies_api,
        "score_event",
        fake_score_event,
    )

    response = client.post(
        (
            "/api/v1/anomalies/analyze/"
            "EVT-ANALYZE-001"
        )
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        recorded[
            "event"
        ].id
        == event.id
    )

    assert (
        recorded[
            "employee"
        ].id
        == employee.id
    )

    assert (
        payload[
            "event_id"
        ]
        == "EVT-ANALYZE-001"
    )

    assert (
        payload[
            "employee_user_id"
        ]
        == "analyze_api_user"
    )

    assert (
        payload[
            "detector_name"
        ]
        == SELECTED_DETECTOR.name
    )

    assert (
        payload[
            "detector_version"
        ]
        == SELECTED_DETECTOR.version
    )

    assert (
        payload[
            "anomaly_score"
        ]
        == pytest.approx(
            0.97
        )
    )

    assert (
        payload[
            "risk_level"
        ]
        == "CRITICAL"
    )

    assert (
        payload[
            "explanation"
        ][
            "alert_threshold_reached"
        ]
        is True
    )


@pytest.mark.api
@pytest.mark.postgres
def test_analyze_event_rolls_back_when_scoring_fails(
    db_session: Session,
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee = _create_analyze_employee(
        db_session
    )

    _create_analyze_event(
        db_session,
        employee=employee,
        event_id="EVT-ANALYZE-FAIL",
    )

    class ExpectedScoringError(
        RuntimeError
    ):
        pass

    def failing_score_event(
        *,
        db,
        event,
        employee,
    ):
        raise ExpectedScoringError(
            "synthetic scoring failure"
        )

    rollback_calls = []

    original_rollback = (
        db_session.rollback
    )

    def recording_rollback():
        rollback_calls.append(
            True
        )

        return original_rollback()

    monkeypatch.setattr(
        anomalies_api,
        "score_event",
        failing_score_event,
    )

    monkeypatch.setattr(
        db_session,
        "rollback",
        recording_rollback,
    )

    with pytest.raises(
        ExpectedScoringError,
        match="synthetic scoring failure",
    ):
        anomalies_api.analyze_event_endpoint(
            event_id="EVT-ANALYZE-FAIL",
            db=db_session,
        )

    assert rollback_calls == [
        True
    ]
