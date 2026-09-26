"""
Shared pytest configuration and fixtures for SENTINEL.

Safety principles
-----------------
1. Tests never use the operational SENTINEL database.
2. PostgreSQL-backed tests target only ``sentinel_test``.
3. Local Ollama is disabled for the automated core suite.
4. Database tests run inside an outer transaction.
5. Even application code that calls ``commit()`` cannot persist
   test data beyond the current test.
"""

from __future__ import annotations

import os
from collections.abc import Generator

from datetime import (
    datetime,
    timedelta,
    timezone,
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import (
    create_engine,
    text,
)
from sqlalchemy.engine import (
    Connection,
    Engine,
    make_url,
)
from sqlalchemy.orm import (
    Session,
    sessionmaker,
)
from datetime import (
    datetime,
    timedelta,
    timezone,
)
from app.models import (
    AnomalyScore,
    Employee,
    Event,
    Incident,
    IncidentEvent,
)
from app.selected_detector import (
    SELECTED_DETECTOR,
)
from sqlalchemy.pool import NullPool


# ============================================================
# Test environment
# ============================================================

os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "false"

# SENTINEL's local generative-AI layer is optional and must not
# be required by the normal automated test suite.
os.environ["OLLAMA_ENABLED"] = "false"


# ============================================================
# Database safety boundary
# ============================================================

SAFE_DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://"
    "sentinel_test:sentinel_test"
    "@127.0.0.1:65432/"
    "sentinel_test"
)

TEST_DATABASE_URL = os.environ.get(
    "SENTINEL_TEST_DATABASE_URL",
    SAFE_DEFAULT_DATABASE_URL,
)

parsed_url = make_url(
    TEST_DATABASE_URL
)


if not parsed_url.drivername.startswith(
    "postgresql"
):
    raise RuntimeError(
        "SENTINEL tests require PostgreSQL. "
        "Refusing non-PostgreSQL test database."
    )


if parsed_url.database != "sentinel_test":
    raise RuntimeError(
        "Unsafe test database configuration: "
        "database must be named 'sentinel_test'."
    )


if parsed_url.username != "sentinel_test":
    raise RuntimeError(
        "Unsafe test database configuration: "
        "database user must be 'sentinel_test'."
    )


# Application modules imported below will now construct their
# SQLAlchemy engine against the dedicated test database.
os.environ["DATABASE_URL"] = (
    TEST_DATABASE_URL
)


# ============================================================
# Application imports
# ============================================================
#
# These imports intentionally occur only after DATABASE_URL and
# other test environment variables have been validated.
# ============================================================

from app.database.dependencies import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    AnomalyScore,
    Employee,
    Event,
    Incident,
    IncidentEvent,
)
from app.selected_detector import (  # noqa: E402
    SELECTED_DETECTOR,
)


# ============================================================
# Test PostgreSQL engine
# ============================================================

@pytest.fixture(scope="session")
def test_engine() -> Generator[
    Engine,
    None,
    None,
]:
    """
    Provide a dedicated SQLAlchemy engine for ``sentinel_test``.

    The fixture also validates the database identity and migration
    state before any DB-backed test is allowed to proceed.
    """

    engine = create_engine(
        TEST_DATABASE_URL,
        pool_pre_ping=True,
        poolclass=NullPool,
    )

    try:
        with engine.connect() as connection:
            identity = connection.execute(
                text(
                    """
                    SELECT
                        current_database(),
                        current_user
                    """
                )
            ).one()

            if identity[0] != "sentinel_test":
                raise RuntimeError(
                    "Connected database is not "
                    "'sentinel_test'."
                )

            if identity[1] != "sentinel_test":
                raise RuntimeError(
                    "Connected database user is not "
                    "'sentinel_test'."
                )

            migration_revision = (
                connection.execute(
                    text(
                        """
                        SELECT version_num
                        FROM alembic_version
                        """
                    )
                )
                .scalar_one()
            )

            if migration_revision != "e8a2b5c7d9f0":
                raise RuntimeError(
                    "Test database is not at the "
                    "expected Alembic head. "
                    f"Found: {migration_revision}"
                )

        yield engine

    finally:
        engine.dispose()


# ============================================================
# Transaction-isolated DB session
# ============================================================

@pytest.fixture
def db_connection(
    test_engine: Engine,
) -> Generator[
    Connection,
    None,
    None,
]:
    """
    Open one connection and outer transaction per test.

    Any work performed by the test is rolled back afterward.
    """

    connection = test_engine.connect()

    outer_transaction = (
        connection.begin()
    )

    try:
        yield connection

    finally:
        if outer_transaction.is_active:
            outer_transaction.rollback()

        connection.close()


@pytest.fixture
def db_session(
    db_connection: Connection,
) -> Generator[
    Session,
    None,
    None,
]:
    """
    Provide a real PostgreSQL SQLAlchemy Session.

    ``join_transaction_mode='create_savepoint'`` allows application
    code to call ``commit()`` while the fixture's outer transaction
    remains in control.

    When the test finishes, db_connection rolls back everything.
    """

    TestingSessionLocal = sessionmaker(
        bind=db_connection,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        join_transaction_mode=(
            "create_savepoint"
        ),
    )

    session = TestingSessionLocal()

    try:
        yield session

    finally:
        session.close()


# ============================================================
# FastAPI test client
# ============================================================

@pytest.fixture
def client(
    db_session: Session,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[
    TestClient,
    None,
    None,
]:
    """
    Provide a FastAPI test client fully isolated from operational
    SENTINEL infrastructure.

    Normal API database dependencies use db_session.

    The root /health endpoint is a special case because it accesses
    app.main.engine directly rather than Depends(get_db). Therefore
    that module-level engine is explicitly redirected to the isolated
    PostgreSQL test engine for the lifetime of this test.
    """

    def override_get_db() -> Generator[
        Session,
        None,
        None,
    ]:
        yield db_session

    app.dependency_overrides[
        get_db
    ] = override_get_db

    # --------------------------------------------------------
    # /health isolation
    # --------------------------------------------------------
    #
    # app.main.health_check() uses the module-level `engine`
    # directly, so FastAPI dependency overrides cannot affect it.
    #
    # Patch only the test process. Production code is untouched.
    # --------------------------------------------------------

    import app.main as app_main

    monkeypatch.setattr(
        app_main,
        "engine",
        test_engine,
    )

    try:
        with TestClient(
            app
        ) as test_client:
            yield test_client

    finally:
        app.dependency_overrides.clear()


# ============================================================
# Reusable seeded API scenario
# ============================================================

@pytest.fixture
def api_seed(
    db_session: Session,
) -> dict[str, object]:
    """
    Seed a compact but realistic SENTINEL API dataset.

    Everything is created inside pytest's outer transaction and
    therefore disappears automatically after the test.
    """

    base_time = datetime(
        2026,
        1,
        15,
        22,
        0,
        tzinfo=timezone.utc,
    )

    # --------------------------------------------------------
    # Employee
    # --------------------------------------------------------

    employee = Employee(
        user_id="api_user_001",
        name="Aisha Khan",
        department="Engineering",
        job_role="Software Engineer",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.20.1.25",
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

    # --------------------------------------------------------
    # Events
    # --------------------------------------------------------

    event_1 = Event(
        event_id="EVT-API-000001",
        timestamp=base_time,
        employee_id=employee.id,
        session_id="session-api-001",
        event_type="LOGIN_FAILURE",
        source_ip="203.0.113.50",
        destination_ip="10.20.5.10",
        source_location="Remote",
        resource_type="authentication",
        resource_name="corporate-sso",
        bytes_sent=500,
        bytes_received=200,
        success=False,
        event_metadata={
            "source": "pytest",
        },
    )

    event_2 = Event(
        event_id="EVT-API-000002",
        timestamp=(
            base_time
            + timedelta(
                minutes=5
            )
        ),
        employee_id=employee.id,
        session_id="session-api-001",
        event_type="FILE_ACCESS",
        source_ip="203.0.113.50",
        destination_ip="10.20.8.20",
        source_location="Remote",
        resource_type="file",
        resource_name="engineering-roadmap.xlsx",
        bytes_sent=150_000_000,
        bytes_received=5_000,
        success=True,
        event_metadata={
            "source": "pytest",
        },
    )

    db_session.add_all(
        [
            event_1,
            event_2,
        ]
    )

    db_session.flush()

    # --------------------------------------------------------
    # Selected-detector anomaly scores
    # --------------------------------------------------------

    anomaly_1 = AnomalyScore(
        event_uuid=event_1.id,
        detector_name=(
            SELECTED_DETECTOR.name
        ),
        detector_version=(
            SELECTED_DETECTOR.version
        ),
        detector_type=(
            SELECTED_DETECTOR.detector_type
        ),
        raw_score=-0.21,
        anomaly_score=0.997,
        risk_level="CRITICAL",
        feature_snapshot={
            "outside_work_hours": 1,
            "source_ip_is_baseline": 0,
        },
        explanation={
            "score_interpretation": (
                "Historical anomaly percentile; "
                "not probability of attack."
            ),
            "alert_threshold_reached": True,
        },
    )

    anomaly_2 = AnomalyScore(
        event_uuid=event_2.id,
        detector_name=(
            SELECTED_DETECTOR.name
        ),
        detector_version=(
            SELECTED_DETECTOR.version
        ),
        detector_type=(
            SELECTED_DETECTOR.detector_type
        ),
        raw_score=-0.18,
        anomaly_score=0.962,
        risk_level="HIGH",
        feature_snapshot={
            "outside_work_hours": 1,
            "source_ip_is_baseline": 0,
        },
        explanation={
            "score_interpretation": (
                "Historical anomaly percentile; "
                "not probability of attack."
            ),
            "alert_threshold_reached": True,
        },
    )

    db_session.add_all(
        [
            anomaly_1,
            anomaly_2,
        ]
    )

    db_session.flush()

    # --------------------------------------------------------
    # Incident
    # --------------------------------------------------------

    incident = Incident(
        incident_id="INC-API-000001",
        title="Potential Account Compromise",
        incident_type=(
            "POTENTIAL_ACCOUNT_COMPROMISE"
        ),
        severity="CRITICAL",
        status="OPEN",
        detector_name=(
            SELECTED_DETECTOR.name
        ),
        detector_version=(
            SELECTED_DETECTOR.version
        ),
        correlation_engine=(
            "behavioral-correlation"
        ),
        correlation_version="1.0",
        primary_employee_id=employee.id,
        first_seen=event_1.timestamp,
        last_seen=event_2.timestamp,
        event_count=2,
        anomaly_count=2,
        max_anomaly_score=0.997,
        summary=(
            "Repeated suspicious authentication "
            "and follow-on resource activity."
        ),
        correlation_reason=(
            "Critical anomalous activity was "
            "correlated within one identity."
        ),
        indicators=[
            {
                "type": "source_ip",
                "value": "203.0.113.50",
                "severity": "HIGH",
            },
        ],
        evidence={
            "signals": {
                "login_failures": 3,
                "login_successes": 1,
                "off_hours_events": 2,
                "non_baseline_source_events": 2,
                "total_bytes_sent": 150_000_500,
            },
            "investigation": {
                "severity_rationale": (
                    "Critical severity because repeated "
                    "authentication failures were followed "
                    "by successful access."
                ),
                "key_findings": [
                    {
                        "category": "authentication",
                        "finding": (
                            "Repeated authentication failures"
                        ),
                        "value": 3,
                        "confidence": "HIGH",
                    },
                ],
                "analyst_questions": [
                    (
                        "Does the affected user "
                        "recognize the activity?"
                    ),
                ],
                "containment_actions": [
                    {
                        "urgency": "IMMEDIATE",
                        "action": (
                            "Consider disabling active sessions"
                        ),
                        "condition": (
                            "Use if activity is not legitimate."
                        ),
                    },
                ],
            },
        },
        investigation_steps=[
            {
                "priority": 1,
                "action": (
                    "Validate the affected user's activity"
                ),
                "reason": (
                    "Confirm whether the identity owner "
                    "recognizes the activity."
                ),
            },
        ],
    )

    db_session.add(
        incident
    )

    db_session.flush()

    # --------------------------------------------------------
    # Incident-event links
    # --------------------------------------------------------

    link_1 = IncidentEvent(
        incident_uuid=incident.id,
        event_uuid=event_1.id,
        sequence_number=1,
        correlation_score=1.0,
        correlation_reason=(
            "Critical authentication anomaly"
        ),
    )

    link_2 = IncidentEvent(
        incident_uuid=incident.id,
        event_uuid=event_2.id,
        sequence_number=2,
        correlation_score=0.95,
        correlation_reason=(
            "Follow-on resource activity"
        ),
    )

    db_session.add_all(
        [
            link_1,
            link_2,
        ]
    )

    db_session.flush()

    return {
        "employee": employee,
        "event_1": event_1,
        "event_2": event_2,
        "anomaly_1": anomaly_1,
        "anomaly_2": anomaly_2,
        "incident": incident,
        "link_1": link_1,
        "link_2": link_2,
    }