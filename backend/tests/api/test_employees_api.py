"""
FastAPI contract tests for SENTINEL employee intelligence endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
@pytest.mark.postgres
def test_employee_list_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/employees"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 1

    employee = payload[0]

    assert employee["user_id"] == "api_user_001"
    assert employee["name"] == "Aisha Khan"
    assert employee["department"] == "Engineering"
    assert employee["job_role"] == "Software Engineer"
    assert employee["is_active"] is True


@pytest.mark.api
@pytest.mark.postgres
def test_employee_summary_reflects_seeded_security_posture(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/employees/summary"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total_employees"] == 1
    assert payload["active_employees"] == 1

    assert (
        payload["critical_risk_employees"]
        == 1
    )

    assert (
        payload["employees_with_open_incidents"]
        == 1
    )

    assert payload["scored_employees"] == 1

    assert (
        payload["elevated_anomaly_count"]
        == 2
    )


@pytest.mark.api
@pytest.mark.postgres
def test_employee_directory_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/employees/directory"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total"] == 1
    assert payload["limit"] == 50
    assert payload["offset"] == 0

    assert (
        payload["departments"]
        == ["Engineering"]
    )

    assert len(payload["items"]) == 1

    item = payload["items"][0]

    assert item["user_id"] == "api_user_001"
    assert item["name"] == "Aisha Khan"
    assert item["department"] == "Engineering"

    security = item["security"]

    assert security["total_events"] == 2
    assert security["scored_event_count"] == 2
    assert security["anomaly_count"] == 2
    assert security["critical_anomaly_count"] == 1
    assert security["incident_count"] == 1
    assert security["open_incident_count"] == 1

    assert (
        security["highest_risk_level"]
        == "CRITICAL"
    )

    assert (
        security["highest_anomaly_score"]
        == 0.997
    )


@pytest.mark.api
@pytest.mark.postgres
def test_employee_directory_search_and_department_filters(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    search_response = client.get(
        "/api/v1/employees/directory"
        "?search=Aisha"
    )

    assert search_response.status_code == 200
    assert search_response.json()["total"] == 1

    department_response = client.get(
        "/api/v1/employees/directory"
        "?department=Engineering"
    )

    assert department_response.status_code == 200
    assert department_response.json()["total"] == 1

    missing_department = client.get(
        "/api/v1/employees/directory"
        "?department=Finance"
    )

    assert missing_department.status_code == 200
    assert missing_department.json()["total"] == 0


@pytest.mark.api
@pytest.mark.postgres
def test_employee_directory_status_filter(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    active = client.get(
        "/api/v1/employees/directory"
        "?status=active"
    )

    inactive = client.get(
        "/api/v1/employees/directory"
        "?status=inactive"
    )

    assert active.status_code == 200
    assert inactive.status_code == 200

    assert active.json()["total"] == 1
    assert inactive.json()["total"] == 0


@pytest.mark.api
@pytest.mark.postgres
def test_employee_detail_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/employees/api_user_001"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["user_id"] == "api_user_001"
    assert payload["name"] == "Aisha Khan"
    assert payload["department"] == "Engineering"
    assert payload["job_role"] == "Software Engineer"

    assert payload["baseline"] == {
        "normal_start_hour": 9,
        "normal_end_hour": 17,
        "typical_ip": "10.20.1.25",
        "typical_location": "Karachi Office",
        "typical_login_frequency": 2,
        "typical_files_accessed": 20,
        "typical_data_transfer_bytes": 50_000_000,
    }

    security = payload["security"]

    assert security["total_events"] == 2
    assert security["scored_event_count"] == 2
    assert security["anomaly_count"] == 2

    assert (
        security["highest_risk_level"]
        == "CRITICAL"
    )

    assert len(payload["recent_anomalies"]) == 2
    assert len(payload["incidents"]) == 1

    assert (
        payload["incidents"][0]["incident_id"]
        == "INC-API-000001"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_employee_activity_is_newest_first_and_links_incident(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/employees/"
        "api_user_001/activity"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["user_id"] == "api_user_001"
    assert payload["total"] == 2

    items = payload["items"]

    assert len(items) == 2

    assert (
        items[0]["event_id"]
        == "EVT-API-000002"
    )

    assert (
        items[1]["event_id"]
        == "EVT-API-000001"
    )

    assert (
        items[0]["linked_incident_ids"]
        == ["INC-API-000001"]
    )

    assert (
        items[1]["linked_incident_ids"]
        == ["INC-API-000001"]
    )

    assert (
        "event_metadata"
        not in items[0]
    )


@pytest.mark.api
@pytest.mark.postgres
def test_employee_activity_pagination(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/employees/"
        "api_user_001/activity"
        "?limit=1&offset=1"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["total"] == 2
    assert payload["limit"] == 1
    assert payload["offset"] == 1

    assert len(payload["items"]) == 1

    assert (
        payload["items"][0]["event_id"]
        == "EVT-API-000001"
    )


@pytest.mark.api
def test_missing_employee_returns_404(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/employees/missing_user"
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": (
            "Employee 'missing_user' "
            "was not found."
        )
    }