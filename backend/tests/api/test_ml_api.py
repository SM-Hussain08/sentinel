"""
FastAPI contract tests for SENTINEL's machine-learning API.

These tests verify:

- selected-model manifest exposure;
- controlled behavior when the manifest is unavailable;
- selected-detector-only aggregate statistics;
- selected-detector-only anomaly listing;
- event-scoped ML analysis;
- exclusion of alternate detector generations;
- public query validation.
"""

from __future__ import annotations

import json
from datetime import (
    datetime,
    timedelta,
    timezone,
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import app.api.ml as ml_api

from app.models import (
    AnomalyScore,
    Employee,
    Event,
)

from app.selected_detector import (
    SELECTED_DETECTOR,
)


# ============================================================
# Helpers
# ============================================================


def _create_employee(
    db_session: Session,
    *,
    user_id: str = "ml_api_user_001",
) -> Employee:
    employee = Employee(
        user_id=user_id,
        name="Aisha Khan",
        department="Security",
        job_role="SOC Analyst",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.80.1.25",
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
    timestamp: datetime,
    event_type: str = "LOGIN_FAILURE",
) -> Event:
    event = Event(
        event_id=event_id,
        timestamp=timestamp,
        employee_id=employee.id,
        session_id="pytest-ml-api-session",
        event_type=event_type,
        source_ip="203.0.113.50",
        destination_ip="10.80.5.20",
        source_location="Remote",
        resource_type="authentication",
        resource_name="corporate-sso",
        bytes_sent=500,
        bytes_received=1_000,
        success=(
            event_type
            != "LOGIN_FAILURE"
        ),
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


def _create_score(
    db_session: Session,
    *,
    event: Event,
    anomaly_score: float,
    risk_level: str,
    detector_name: str | None = None,
    detector_version: str | None = None,
) -> AnomalyScore:
    score = AnomalyScore(
        event_uuid=event.id,

        detector_name=(
            detector_name
            or SELECTED_DETECTOR.name
        ),

        detector_version=(
            detector_version
            or SELECTED_DETECTOR.version
        ),

        detector_type=(
            SELECTED_DETECTOR.detector_type
        ),

        raw_score=(
            -anomaly_score
        ),

        anomaly_score=(
            anomaly_score
        ),

        risk_level=(
            risk_level
        ),

        feature_snapshot={
            "failed_logins_10m":
                3,
        },

        explanation={
            "score_interpretation": (
                "Historical anomaly percentile; "
                "not probability of attack."
            ),

            "alert_threshold_reached": (
                risk_level
                == "CRITICAL"
            ),
        },
    )

    db_session.add(
        score
    )

    db_session.flush()

    return score


# ============================================================
# Model manifest
# ============================================================


@pytest.mark.api
def test_ml_model_info_reads_selected_manifest(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    manifest_path = (
        tmp_path
        / "selected_model_manifest.json"
    )

    manifest_path.write_text(
        json.dumps({
            "model_name":
                "isolation-forest",

            "model_version":
                "pytest-version",

            "algorithm":
                "IsolationForest",

            "feature_count":
                17,

            "training_rows":
                12_000,

            "evaluation_rows":
                3_000,

            "threshold_percentile":
                0.99,

            "metrics": {
                "precision":
                    0.91,

                "recall":
                    0.88,

                "f1_score":
                    0.895,

                "false_positive_rate":
                    0.012,
            },
        }),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        ml_api,
        "SELECTED_MODEL_MANIFEST_PATH",
        manifest_path,
    )

    response = client.get(
        "/api/v1/ml/model"
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["model_name"]
        == "isolation-forest"
    )

    assert (
        payload["model_version"]
        == "pytest-version"
    )

    assert (
        payload["algorithm"]
        == "IsolationForest"
    )

    assert (
        payload["feature_count"]
        == 17
    )

    assert (
        payload["training_rows"]
        == 12_000
    )

    assert (
        payload["evaluation_rows"]
        == 3_000
    )

    assert (
        payload["threshold_percentile"]
        == pytest.approx(
            0.99
        )
    )

    assert (
        payload["precision"]
        == pytest.approx(
            0.91
        )
    )

    assert (
        payload["recall"]
        == pytest.approx(
            0.88
        )
    )

    assert (
        payload["f1_score"]
        == pytest.approx(
            0.895
        )
    )

    assert (
        payload["false_positive_rate"]
        == pytest.approx(
            0.012
        )
    )


@pytest.mark.api
def test_ml_model_info_returns_503_when_manifest_missing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    missing_path = (
        tmp_path
        / "missing-manifest.json"
    )

    monkeypatch.setattr(
        ml_api,
        "SELECTED_MODEL_MANIFEST_PATH",
        missing_path,
    )

    response = client.get(
        "/api/v1/ml/model"
    )

    assert response.status_code == 503

    assert response.json() == {
        "detail": (
            "Selected ML model manifest "
            "is not available."
        )
    }


# ============================================================
# Summary
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
def test_ml_summary_is_zero_when_no_selected_scores_exist(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/ml/summary"
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["detector_name"]
        == SELECTED_DETECTOR.name
    )

    assert (
        payload["detector_version"]
        == SELECTED_DETECTOR.version
    )

    assert (
        payload["events_scored"]
        == 0
    )

    assert (
        payload["alert_count"]
        == 0
    )

    assert (
        payload["average_score"]
        == 0.0
    )

    assert (
        payload["highest_score"]
        == 0.0
    )

    assert payload[
        "risk_distribution"
    ] == {
        "normal": 0,
        "low": 0,
        "medium": 0,
        "high": 0,
        "critical": 0,
    }


@pytest.mark.api
@pytest.mark.postgres
def test_ml_summary_uses_only_selected_detector_generation(
    db_session: Session,
    client: TestClient,
) -> None:
    employee = _create_employee(
        db_session
    )

    base_time = datetime(
        2026,
        9,
        22,
        12,
        0,
        tzinfo=timezone.utc,
    )

    selected_data = [
        (
            "EVT-ML-SUM-001",
            0.10,
            "NORMAL",
        ),
        (
            "EVT-ML-SUM-002",
            0.30,
            "LOW",
        ),
        (
            "EVT-ML-SUM-003",
            0.50,
            "MEDIUM",
        ),
        (
            "EVT-ML-SUM-004",
            0.80,
            "HIGH",
        ),
        (
            "EVT-ML-SUM-005",
            0.95,
            "CRITICAL",
        ),
    ]

    for (
        index,
        (
            event_id,
            anomaly_score,
            risk_level,
        ),
    ) in enumerate(
        selected_data
    ):
        event = _create_event(
            db_session,
            employee=employee,
            event_id=event_id,
            timestamp=(
                base_time
                + timedelta(
                    minutes=index
                )
            ),
        )

        _create_score(
            db_session,
            event=event,
            anomaly_score=(
                anomaly_score
            ),
            risk_level=risk_level,
        )

    # Different detector generation.
    # This must not affect the selected-detector summary.
    alternate_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-SUM-ALT",
        timestamp=(
            base_time
            + timedelta(
                minutes=20
            )
        ),
    )

    _create_score(
        db_session,
        event=alternate_event,
        anomaly_score=0.999,
        risk_level="CRITICAL",
        detector_name=(
            "alternate-detector"
        ),
        detector_version="99.0",
    )

    response = client.get(
        "/api/v1/ml/summary"
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["events_scored"]
        == 5
    )

    assert (
        payload["alert_count"]
        == 1
    )

    assert (
        payload["average_score"]
        == pytest.approx(
            0.53
        )
    )

    assert (
        payload["highest_score"]
        == pytest.approx(
            0.95
        )
    )

    assert payload[
        "risk_distribution"
    ] == {
        "normal": 1,
        "low": 1,
        "medium": 1,
        "high": 1,
        "critical": 1,
    }


# ============================================================
# Anomaly listing
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
def test_ml_anomalies_returns_only_selected_non_normal_scores_in_score_order(
    db_session: Session,
    client: TestClient,
) -> None:
    employee = _create_employee(
        db_session,
        user_id="ml_anomaly_user",
    )

    base_time = datetime(
        2026,
        9,
        22,
        13,
        0,
        tzinfo=timezone.utc,
    )

    normal_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-NORMAL",
        timestamp=base_time,
    )

    _create_score(
        db_session,
        event=normal_event,
        anomaly_score=0.15,
        risk_level="NORMAL",
    )

    high_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-HIGH",
        timestamp=(
            base_time
            + timedelta(
                minutes=1
            )
        ),
    )

    _create_score(
        db_session,
        event=high_event,
        anomaly_score=0.82,
        risk_level="HIGH",
    )

    critical_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-CRITICAL",
        timestamp=(
            base_time
            + timedelta(
                minutes=2
            )
        ),
    )

    critical_score = _create_score(
        db_session,
        event=critical_event,
        anomaly_score=0.98,
        risk_level="CRITICAL",
    )

    alternate_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-ALT",
        timestamp=(
            base_time
            + timedelta(
                minutes=3
            )
        ),
    )

    _create_score(
        db_session,
        event=alternate_event,
        anomaly_score=0.999,
        risk_level="CRITICAL",
        detector_name=(
            "alternate-detector"
        ),
        detector_version="99.0",
    )

    response = client.get(
        "/api/v1/ml/anomalies"
    )

    assert response.status_code == 200

    payload = response.json()

    assert [
        item[
            "event_id"
        ]
        for item in payload
    ] == [
        "EVT-ML-CRITICAL",
        "EVT-ML-HIGH",
    ]

    assert (
        payload[0][
            "employee_user_id"
        ]
        == "ml_anomaly_user"
    )

    assert (
        payload[0][
            "anomaly_score"
        ]
        == pytest.approx(
            0.98
        )
    )

    assert (
        payload[0][
            "risk_level"
        ]
        == "CRITICAL"
    )

    assert (
        payload[0][
            "alert_threshold_reached"
        ]
        is True
    )

    assert (
        payload[0][
            "score_id"
        ]
        == str(
            critical_score.id
        )
    )

    assert (
        "feature_snapshot"
        in payload[0]
    )

    assert (
        "explanation"
        in payload[0]
    )


@pytest.mark.api
@pytest.mark.postgres
def test_ml_anomalies_respects_limit(
    db_session: Session,
    client: TestClient,
) -> None:
    employee = _create_employee(
        db_session,
        user_id="ml_limit_user",
    )

    base_time = datetime(
        2026,
        9,
        22,
        14,
        0,
        tzinfo=timezone.utc,
    )

    for (
        index,
        anomaly_score,
    ) in [
        (1, 0.81),
        (2, 0.91),
        (3, 0.99),
    ]:
        event = _create_event(
            db_session,
            employee=employee,
            event_id=(
                f"EVT-ML-LIMIT-{index}"
            ),
            timestamp=(
                base_time
                + timedelta(
                    minutes=index
                )
            ),
        )

        _create_score(
            db_session,
            event=event,
            anomaly_score=(
                anomaly_score
            ),
            risk_level=(
                "CRITICAL"
                if anomaly_score >= 0.95
                else "HIGH"
            ),
        )

    response = client.get(
        "/api/v1/ml/anomalies?limit=2"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(
        payload
    ) == 2

    assert [
        item[
            "anomaly_score"
        ]
        for item in payload
    ] == pytest.approx(
        [
            0.99,
            0.91,
        ]
    )


@pytest.mark.api
@pytest.mark.parametrize(
    "limit",
    [
        0,
        501,
    ],
)
def test_ml_anomalies_rejects_invalid_limit(
    client: TestClient,
    limit: int,
) -> None:
    response = client.get(
        (
            "/api/v1/ml/anomalies"
            f"?limit={limit}"
        )
    )

    assert (
        response.status_code
        == 422
    )


# ============================================================
# Event analysis
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
def test_event_ml_analysis_uses_selected_detector_generation(
    db_session: Session,
    client: TestClient,
) -> None:
    employee = _create_employee(
        db_session,
        user_id="ml_analysis_user",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-ANALYSIS",
        timestamp=datetime(
            2026,
            9,
            22,
            15,
            0,
            tzinfo=timezone.utc,
        ),
    )

    selected_score = _create_score(
        db_session,
        event=event,
        anomaly_score=0.93,
        risk_level="HIGH",
    )

    # Same event, different detector generation.
    _create_score(
        db_session,
        event=event,
        anomaly_score=0.999,
        risk_level="CRITICAL",
        detector_name=(
            "alternate-detector"
        ),
        detector_version="99.0",
    )

    response = client.get(
        (
            "/api/v1/ml/events/"
            "EVT-ML-ANALYSIS"
        )
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["event_id"]
        == "EVT-ML-ANALYSIS"
    )

    assert (
        payload[
            "employee_user_id"
        ]
        == "ml_analysis_user"
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
            selected_score
            .anomaly_score
        )
    )

    assert (
        payload[
            "risk_level"
        ]
        == "HIGH"
    )

    assert (
        payload[
            "alert_threshold_reached"
        ]
        is False
    )

    assert (
        "feature_snapshot"
        in payload
    )

    assert (
        "explanation"
        in payload
    )


@pytest.mark.api
@pytest.mark.postgres
def test_event_ml_analysis_returns_404_when_selected_analysis_missing(
    db_session: Session,
    client: TestClient,
) -> None:
    employee = _create_employee(
        db_session,
        user_id="ml_missing_user",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-ML-ONLY-ALT",
        timestamp=datetime(
            2026,
            9,
            22,
            16,
            0,
            tzinfo=timezone.utc,
        ),
    )

    # Event exists, but only an alternate detector scored it.
    _create_score(
        db_session,
        event=event,
        anomaly_score=0.999,
        risk_level="CRITICAL",
        detector_name=(
            "alternate-detector"
        ),
        detector_version="99.0",
    )

    response = client.get(
        (
            "/api/v1/ml/events/"
            "EVT-ML-ONLY-ALT"
        )
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": (
            "ML analysis was not found "
            "for this event."
        )
    }
