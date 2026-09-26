"""
FastAPI contract tests for SENTINEL event endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
@pytest.mark.postgres
def test_list_events_returns_newest_first(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/events"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 2

    assert (
        payload[0]["event_id"]
        == "EVT-API-000002"
    )

    assert (
        payload[1]["event_id"]
        == "EVT-API-000001"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_list_events_respects_limit(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/events?limit=1"
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(payload) == 1

    assert (
        payload[0]["event_id"]
        == "EVT-API-000002"
    )


@pytest.mark.api
@pytest.mark.postgres
def test_event_detail_contract(
    client: TestClient,
    api_seed: dict[str, object],
) -> None:
    response = client.get(
        "/api/v1/events/EVT-API-000001"
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["event_id"]
        == "EVT-API-000001"
    )

    assert payload["event_type"] == "LOGIN_FAILURE"
    assert payload["source_ip"] == "203.0.113.50"
    assert payload["success"] is False

    assert payload["event_metadata"] == {
        "source": "pytest",
    }


@pytest.mark.api
def test_missing_event_returns_404(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/events/EVT-MISSING"
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": (
            "Event 'EVT-MISSING' "
            "was not found."
        )
    }


@pytest.mark.api
@pytest.mark.parametrize(
    "limit",
    [
        0,
        501,
    ],
)
def test_event_limit_validation(
    client: TestClient,
    limit: int,
) -> None:
    response = client.get(
        f"/api/v1/events?limit={limit}"
    )

    assert response.status_code == 422