"""
FastAPI system endpoint tests.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.api
def test_root_endpoint(
    client: TestClient,
) -> None:
    """
    The API root must expose the SENTINEL service contract.
    """

    response = client.get("/")

    assert response.status_code == 200

    payload = response.json()

    assert payload == {
        "service": "SENTINEL API",
        "version": "1.0.0",
        "message": "SENTINEL backend is running.",
    }


@pytest.mark.api
@pytest.mark.postgres
def test_health_endpoint_uses_isolated_postgres(
    client: TestClient,
) -> None:
    """
    /health must validate PostgreSQL connectivity without ever
    connecting to the operational SENTINEL database.
    """

    response = client.get(
        "/health"
    )

    assert response.status_code == 200

    assert response.json() == {
        "status": "healthy",
        "service": "SENTINEL",
        "database": "connected",
    }