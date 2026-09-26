"""
Integration tests for SENTINEL's isolated PostgreSQL test database.
"""

from __future__ import annotations

import pytest
from sqlalchemy import (
    func,
    select,
    text,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models import Employee


@pytest.mark.integration
@pytest.mark.postgres
def test_database_identity(
    test_engine: Engine,
) -> None:
    """
    The integration suite must be connected only to sentinel_test.
    """

    with test_engine.connect() as connection:
        result = connection.execute(
            text(
                """
                SELECT
                    current_database(),
                    current_user
                """
            )
        ).one()

    assert result[0] == "sentinel_test"
    assert result[1] == "sentinel_test"


@pytest.mark.integration
@pytest.mark.postgres
def test_database_is_at_expected_migration_head(
    test_engine: Engine,
) -> None:
    """
    Integration tests require the current Alembic schema.
    """

    with test_engine.connect() as connection:
        revision = connection.execute(
            text(
                """
                SELECT version_num
                FROM alembic_version
                """
            )
        ).scalar_one()

    assert revision == "e8a2b5c7d9f0"


@pytest.mark.integration
@pytest.mark.postgres
def test_transactional_session_allows_commit(
    db_session: Session,
) -> None:
    """
    Application code may call commit() during tests while the
    fixture's outer transaction still guarantees later rollback.
    """

    employee = Employee(
        user_id="pytest_user_001",
        name="Pytest Employee",
        department="Engineering",
        job_role="Test Engineer",
        typical_ip="10.250.0.1",
        typical_location="Test Environment",
    )

    db_session.add(
        employee
    )

    db_session.commit()

    persisted = db_session.scalar(
        select(Employee)
        .where(
            Employee.user_id
            == "pytest_user_001"
        )
    )

    assert persisted is not None
    assert persisted.name == "Pytest Employee"

    count = db_session.scalar(
        select(
            func.count(Employee.id)
        )
        .where(
            Employee.user_id
            == "pytest_user_001"
        )
    )

    assert count == 1

@pytest.mark.integration
@pytest.mark.postgres
def test_previous_test_data_was_rolled_back(
    db_session: Session,
) -> None:
    """
    The employee committed by the previous test must not survive
    into a new pytest transaction.
    """

    employee = db_session.scalar(
        select(Employee)
        .where(
            Employee.user_id
            == "pytest_user_001"
        )
    )

    assert employee is None
