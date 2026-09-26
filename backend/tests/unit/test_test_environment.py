"""
Tests for the SENTINEL pytest safety environment.
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy.engine import make_url


@pytest.mark.unit
def test_application_runs_in_test_environment() -> None:
    """
    Pytest must force SENTINEL into the explicit test environment.
    """

    assert os.environ["APP_ENV"] == "test"
    assert os.environ["DEBUG"] == "false"


@pytest.mark.unit
def test_local_ai_is_disabled_for_core_tests() -> None:
    """
    Core automated tests must never require Ollama.
    """

    assert os.environ["OLLAMA_ENABLED"] == "false"


@pytest.mark.unit
@pytest.mark.safety
def test_database_has_explicit_test_identity() -> None:
    """
    Pytest must target only the dedicated SENTINEL test database.
    """

    database_url = make_url(
        os.environ["DATABASE_URL"]
    )

    assert database_url.drivername.startswith(
        "postgresql"
    )

    assert (
        database_url.database
        == "sentinel_test"
    )

    assert (
        database_url.username
        == "sentinel_test"
    )


@pytest.mark.unit
@pytest.mark.safety
def test_database_is_not_operational_database() -> None:
    """
    The configured test target must not resemble operational SENTINEL.
    """

    database_url = make_url(
        os.environ["DATABASE_URL"]
    )

    assert database_url.database != "sentinel"
    assert database_url.username != "sentinel"