"""
FastAPI contract tests for SENTINEL incident intelligence endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
@pytest.mark.postgres
def test_incident_list_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 1

    incident = payload[0]

    assert (
        incident["incident_id"]
        == "INC-API-000001"
    )

    assert (
        incident["incident_type"]
        == "POTENTIAL_ACCOUNT_COMPROMISE"
    )

    assert incident["severity"] == "CRITICAL"
    assert incident["status"] == "OPEN"

    assert (
        incident["primary_employee_user_id"]
        == "api_user_001"
    )

    assert incident["event_count"] == 2
    assert incident["anomaly_count"] == 2
    assert incident["max_anomaly_score"] == 0.997


@pytest.mark.api
@pytest.mark.postgres
def test_incident_filters_are_case_insensitive(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents"
        "?severity=critical"
        "&status=open"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 1

    assert (
        payload[0]["incident_id"]
        == "INC-API-000001"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_incident_filter_can_return_empty_result(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents"
        "?severity=medium"
    )

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.api
@pytest.mark.postgres
def test_incident_summary_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents/summary"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total_incidents"] == 1
    assert payload["open_incidents"] == 1
    assert payload["critical_incidents"] == 1
    assert payload["high_incidents"] == 0
    assert payload["medium_incidents"] == 0
    assert payload["total_correlated_events"] == 2

    assert payload["severity_distribution"] == {
        "medium": 0,
        "high": 0,
        "critical": 1,
    }


@pytest.mark.api
@pytest.mark.postgres
def test_incident_detail_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents/"
        "INC-API-000001"
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["incident_id"]
        == "INC-API-000001"
    )

    assert payload["severity"] == "CRITICAL"

    assert (
        payload["detector_name"]
        == "isolation-forest"
    )

    assert payload["detector_version"] == "1.2"

    assert (
        payload["primary_employee_user_id"]
        == "api_user_001"
    )

    assert payload["event_count"] == 2
    assert payload["anomaly_count"] == 2

    assert (
        payload["evidence"]["signals"][
            "login_failures"
        ]
        == 3
    )

    assert len(payload["indicators"]) == 1


@pytest.mark.api
@pytest.mark.postgres
def test_reverse_lookup_by_event(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents/"
        "by-event/EVT-API-000001"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 1

    assert (
        payload[0]["incident_id"]
        == "INC-API-000001"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_incident_timeline_preserves_sequence(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents/"
        "INC-API-000001/timeline"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 2

    assert (
        payload[0]["sequence_number"]
        == 1
    )

    assert (
        payload[0]["event_id"]
        == "EVT-API-000001"
    )

    assert (
        payload[1]["sequence_number"]
        == 2
    )

    assert (
        payload[1]["event_id"]
        == "EVT-API-000002"
    )

    assert (
        payload[0]["risk_level"]
        == "CRITICAL"
    )

    assert (
        payload[1]["risk_level"]
        == "HIGH"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_incident_investigation_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/incidents/"
        "INC-API-000001/investigation"
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["incident_id"]
        == "INC-API-000001"
    )

    assert (
        "Critical severity"
        in payload["severity_rationale"]
    )

    assert len(payload["key_findings"]) == 1
    assert len(payload["investigation_steps"]) == 1
    assert len(payload["analyst_questions"]) == 1
    assert len(payload["containment_actions"]) == 1


@pytest.mark.api
def test_missing_incident_returns_404(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/incidents/INC-MISSING"
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": "Incident was not found."
    }


@pytest.mark.api
def test_missing_incident_timeline_returns_404(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/incidents/"
        "INC-MISSING/timeline"
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": "Incident was not found."
    }


@pytest.mark.api
def test_missing_incident_investigation_returns_404(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/incidents/"
        "INC-MISSING/investigation"
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": "Incident was not found."
    }