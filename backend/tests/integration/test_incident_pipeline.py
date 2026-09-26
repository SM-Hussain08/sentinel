"""
Integration tests for SENTINEL incident correlation and persistence.

These tests exercise the real PostgreSQL-backed deterministic incident
pipeline:

    Employee / Event / AnomalyScore
        -> IncidentCorrelationEngine
        -> IncidentPersistenceService
        -> Incident / IncidentEvent
        -> deterministic investigation

The tests deliberately do not use simulator ground truth and do not invoke
the optional Ollama / generative-AI layer.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)

import pytest
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

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
from app.services.incident_correlation import (
    IncidentCandidate,
    IncidentCorrelationEngine,
)
from app.services.incident_persistence import (
    IncidentPersistenceService,
)


# ============================================================
# Test data helpers
# ============================================================


def _create_employee(
    db_session: Session,
    *,
    user_id: str,
) -> Employee:
    """
    Create one realistic test employee.

    The employee exists only inside pytest's rollback-controlled
    sentinel_test transaction.
    """

    employee = Employee(
        user_id=user_id,
        name="Sara Ahmed",
        department="Engineering",
        job_role="Platform Engineer",
        normal_start_hour=9,
        normal_end_hour=17,
        typical_ip="10.40.1.25",
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
    event_type: str,
    success: bool,
    bytes_sent: int = 0,
    bytes_received: int = 0,
    source_ip: str = "203.0.113.80",
    destination_ip: str | None = "10.40.5.20",
    source_location: str = "Unknown External Network",
    resource_type: str | None = None,
    resource_name: str | None = None,
    event_metadata: dict | None = None,
) -> Event:
    """
    Persist one observable security Event.

    No simulator/evaluation ground-truth fields are used.
    """

    event = Event(
        event_id=event_id,
        timestamp=timestamp,
        employee_id=employee.id,
        session_id="pytest-account-compromise-session",
        event_type=event_type,
        source_ip=source_ip,
        destination_ip=destination_ip,
        source_location=source_location,
        resource_type=resource_type,
        resource_name=resource_name,
        bytes_sent=bytes_sent,
        bytes_received=bytes_received,
        success=success,
        event_metadata=(
            event_metadata
            if event_metadata is not None
            else {
                "source": "pytest",
            }
        ),
    )

    db_session.add(
        event
    )

    db_session.flush()

    return event


def _create_anomaly(
    db_session: Session,
    *,
    event: Event,
    anomaly_score: float,
    risk_level: str,
    failed_logins_10m: int = 0,
    outside_work_hours: int = 1,
    source_ip_is_baseline: int = 0,
    unique_destinations_5m: int = 0,
    network_events_5m: int = 0,
    file_events_30m: int = 0,
    data_volume_ratio: float = 0.0,
) -> AnomalyScore:
    """
    Persist one score from SENTINEL's currently selected detector.

    The normalized anomaly score represents historical behavioral
    unusualness; it is not a probability that the event is malicious.
    """

    anomaly = AnomalyScore(
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
        raw_score=-0.20,
        anomaly_score=anomaly_score,
        risk_level=risk_level,
        feature_snapshot={
            "outside_work_hours":
                outside_work_hours,

            "source_ip_is_baseline":
                source_ip_is_baseline,

            "failed_logins_10m":
                failed_logins_10m,

            "unique_destinations_5m":
                unique_destinations_5m,

            "network_events_5m":
                network_events_5m,

            "file_events_30m":
                file_events_30m,

            "data_volume_ratio":
                data_volume_ratio,
        },
        explanation={
            "score_interpretation": (
                "Historical anomaly percentile; "
                "not probability of attack."
            ),
            "alert_threshold_reached": (
                risk_level == "CRITICAL"
            ),
        },
    )

    db_session.add(
        anomaly
    )

    db_session.flush()

    return anomaly


def _seed_account_compromise(
    db_session: Session,
) -> dict[str, object]:
    """
    Create an observable account-compromise-shaped sequence.

    The sequence deliberately contains lower-risk contextual evidence
    followed by two CRITICAL seed events.

    Correlation should recover the complete nearby timeline.
    """

    base_time = datetime(
        2026,
        2,
        10,
        22,
        0,
        tzinfo=timezone.utc,
    )

    employee = _create_employee(
        db_session,
        user_id="integration_user_001",
    )

    # --------------------------------------------------------
    # Supporting evidence before the detector reaches CRITICAL
    # --------------------------------------------------------

    login_failure_1 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-ACCT-001",
        timestamp=base_time,
        event_type="LOGIN_FAILURE",
        success=False,
        resource_type="authentication",
        resource_name="corporate-sso",
    )

    anomaly_failure_1 = _create_anomaly(
        db_session,
        event=login_failure_1,
        anomaly_score=0.970,
        risk_level="HIGH",
        failed_logins_10m=1,
    )

    login_success = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-ACCT-002",
        timestamp=(
            base_time
            + timedelta(
                minutes=1
            )
        ),
        event_type="LOGIN_SUCCESS",
        success=True,
        resource_type="authentication",
        resource_name="corporate-sso",
    )

    anomaly_login_success = _create_anomaly(
        db_session,
        event=login_success,
        anomaly_score=0.965,
        risk_level="HIGH",
        failed_logins_10m=2,
    )

    file_access = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-ACCT-003",
        timestamp=(
            base_time
            + timedelta(
                minutes=2
            )
        ),
        event_type="FILE_ACCESS",
        success=True,
        bytes_sent=10_000,
        bytes_received=25_000,
        resource_type="file",
        resource_name="engineering-roadmap.xlsx",
        event_metadata={
            "source": "pytest",
            "classification": "CONFIDENTIAL",
        },
    )

    anomaly_file_access = _create_anomaly(
        db_session,
        event=file_access,
        anomaly_score=0.955,
        risk_level="HIGH",
        failed_logins_10m=2,
        file_events_30m=1,
    )

    # --------------------------------------------------------
    # Two nearby CRITICAL events form an actionable seed cluster.
    # --------------------------------------------------------

    login_failure_2 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-ACCT-004",
        timestamp=(
            base_time
            + timedelta(
                minutes=3
            )
        ),
        event_type="LOGIN_FAILURE",
        success=False,
        resource_type="authentication",
        resource_name="corporate-sso",
    )

    anomaly_failure_2 = _create_anomaly(
        db_session,
        event=login_failure_2,
        anomaly_score=0.992,
        risk_level="CRITICAL",
        failed_logins_10m=3,
    )

    login_failure_3 = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-ACCT-005",
        timestamp=(
            base_time
            + timedelta(
                minutes=4
            )
        ),
        event_type="LOGIN_FAILURE",
        success=False,
        resource_type="authentication",
        resource_name="corporate-sso",
    )

    anomaly_failure_3 = _create_anomaly(
        db_session,
        event=login_failure_3,
        anomaly_score=0.997,
        risk_level="CRITICAL",
        failed_logins_10m=4,
    )

    return {
        "base_time":
            base_time,

        "employee":
            employee,

        "events": [
            login_failure_1,
            login_success,
            file_access,
            login_failure_2,
            login_failure_3,
        ],

        "anomalies": [
            anomaly_failure_1,
            anomaly_login_success,
            anomaly_file_access,
            anomaly_failure_2,
            anomaly_failure_3,
        ],

        "trigger_event":
            login_failure_3,

        "trigger_anomaly":
            anomaly_failure_3,
    }


def _correlate_one(
    db_session: Session,
    *,
    event: Event,
    anomaly: AnomalyScore,
    employee: Employee,
) -> list[IncidentCandidate]:
    """
    Invoke SENTINEL's real incremental correlation engine.
    """

    engine = IncidentCorrelationEngine(
        db=db_session
    )

    return engine.correlate_event(
        event=event,
        anomaly=anomaly,
        employee=employee,
    )


def _persist_one(
    db_session: Session,
    *,
    candidate: IncidentCandidate,
):
    """
    Invoke SENTINEL's real incident persistence service.
    """

    service = IncidentPersistenceService(
        db=db_session
    )

    return service.persist_candidate(
        candidate=candidate
    )


# ============================================================
# Integration tests
# ============================================================


@pytest.mark.integration
@pytest.mark.postgres
def test_account_compromise_correlation_persists_incident_links_and_investigation(
    db_session: Session,
) -> None:
    """
    A real observable account-compromise sequence should produce one
    persisted CRITICAL incident with complete evidence and deterministic
    investigation intelligence.
    """

    scenario = _seed_account_compromise(
        db_session
    )

    employee = scenario["employee"]
    trigger_event = scenario[
        "trigger_event"
    ]
    trigger_anomaly = scenario[
        "trigger_anomaly"
    ]

    assert isinstance(
        employee,
        Employee,
    )

    assert isinstance(
        trigger_event,
        Event,
    )

    assert isinstance(
        trigger_anomaly,
        AnomalyScore,
    )

    # --------------------------------------------------------
    # Real incremental correlation
    # --------------------------------------------------------

    candidates = _correlate_one(
        db_session,
        event=trigger_event,
        anomaly=trigger_anomaly,
        employee=employee,
    )

    assert len(candidates) == 1

    candidate = candidates[0]

    assert (
        candidate.incident_type
        == "POTENTIAL_ACCOUNT_COMPROMISE"
    )

    assert (
        candidate.title
        == "Potential Account Compromise"
    )

    assert candidate.severity == "CRITICAL"

    # Evidence expansion should recover all five nearby events,
    # including the lower-risk events that preceded the CRITICAL
    # detector seeds.
    assert len(candidate.events) == 5

    assert [
        item.event.event_id
        for item in candidate.events
    ] == [
        "EVT-INT-ACCT-001",
        "EVT-INT-ACCT-002",
        "EVT-INT-ACCT-003",
        "EVT-INT-ACCT-004",
        "EVT-INT-ACCT-005",
    ]

    assert (
        candidate.evidence[
            "detector_name"
        ]
        == SELECTED_DETECTOR.name
    )

    assert (
        candidate.evidence[
            "detector_version"
        ]
        == SELECTED_DETECTOR.version
    )

    assert (
        candidate.evidence[
            "correlation_engine"
        ]
        == "multi-signal-rules"
    )

    assert (
        candidate.evidence[
            "correlation_version"
        ]
        == "1.0"
    )

    signals = candidate.evidence[
        "signals"
    ]

    assert signals[
        "login_failures"
    ] == 3

    assert signals[
        "login_successes"
    ] == 1

    assert signals[
        "file_events"
    ] == 1

    assert signals[
        "critical_events"
    ] == 2

    assert signals[
        "anomalous_events"
    ] == 5

    # --------------------------------------------------------
    # Real PostgreSQL persistence
    # --------------------------------------------------------

    persistence_result = _persist_one(
        db_session,
        candidate=candidate,
    )

    assert (
        persistence_result.action
        == "CREATED"
    )

    assert persistence_result.links_written == 5

    incident = persistence_result.incident

    assert incident.id is not None
    assert incident.incident_id.startswith(
        "INC-"
    )

    assert (
        incident.primary_employee_id
        == employee.id
    )

    assert (
        incident.incident_type
        == "POTENTIAL_ACCOUNT_COMPROMISE"
    )

    assert incident.severity == "CRITICAL"
    assert incident.status == "OPEN"

    assert (
        incident.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        incident.detector_version
        == SELECTED_DETECTOR.version
    )

    assert (
        incident.correlation_engine
        == "multi-signal-rules"
    )

    assert (
        incident.correlation_version
        == "1.0"
    )

    assert incident.event_count == 5
    assert incident.anomaly_count == 5

    assert (
        incident.max_anomaly_score
        == pytest.approx(
            0.997
        )
    )

    # --------------------------------------------------------
    # Persisted event links
    # --------------------------------------------------------

    links = list(
        db_session.scalars(
            select(
                IncidentEvent
            )
            .where(
                IncidentEvent.incident_uuid
                == incident.id
            )
            .order_by(
                IncidentEvent.sequence_number
            )
        ).all()
    )

    assert len(links) == 5

    assert [
        link.sequence_number
        for link in links
    ] == [
        1,
        2,
        3,
        4,
        5,
    ]

    assert len(
        {
            link.event_uuid
            for link in links
        }
    ) == 5

    linked_event_ids = list(
        db_session.scalars(
            select(
                Event.event_id
            )
            .join(
                IncidentEvent,
                IncidentEvent.event_uuid
                == Event.id,
            )
            .where(
                IncidentEvent.incident_uuid
                == incident.id
            )
            .order_by(
                IncidentEvent.sequence_number
            )
        ).all()
    )

    assert linked_event_ids == [
        "EVT-INT-ACCT-001",
        "EVT-INT-ACCT-002",
        "EVT-INT-ACCT-003",
        "EVT-INT-ACCT-004",
        "EVT-INT-ACCT-005",
    ]

    # --------------------------------------------------------
    # Deterministic investigation persistence
    # --------------------------------------------------------

    investigation = incident.evidence.get(
        "investigation"
    )

    assert investigation is not None

    assert (
        investigation["engine"]
        == "structured-investigation"
    )

    assert (
        investigation["version"]
        == "1.0"
    )

    assert (
        "Critical severity"
        in investigation[
            "severity_rationale"
        ]
    )

    assert investigation[
        "key_findings"
    ]

    assert investigation[
        "analyst_questions"
    ]

    assert investigation[
        "containment_actions"
    ]

    assert incident.investigation_steps

    assert (
        incident.investigation_steps[0][
            "action"
        ]
        == "Validate the affected user's activity"
    )


@pytest.mark.integration
@pytest.mark.postgres
def test_related_later_event_updates_same_incident_without_duplicate_links(
    db_session: Session,
) -> None:
    """
    Additional related evidence should evolve the existing OPEN incident
    rather than creating a duplicate campaign.

    Event links must remain unique and deterministically ordered.
    """

    scenario = _seed_account_compromise(
        db_session
    )

    employee = scenario["employee"]
    base_time = scenario["base_time"]
    trigger_event = scenario[
        "trigger_event"
    ]
    trigger_anomaly = scenario[
        "trigger_anomaly"
    ]

    assert isinstance(
        employee,
        Employee,
    )

    assert isinstance(
        base_time,
        datetime,
    )

    assert isinstance(
        trigger_event,
        Event,
    )

    assert isinstance(
        trigger_anomaly,
        AnomalyScore,
    )

    # --------------------------------------------------------
    # Create the initial incident.
    # --------------------------------------------------------

    initial_candidates = _correlate_one(
        db_session,
        event=trigger_event,
        anomaly=trigger_anomaly,
        employee=employee,
    )

    assert len(initial_candidates) == 1

    initial_result = _persist_one(
        db_session,
        candidate=initial_candidates[0],
    )

    assert initial_result.action == "CREATED"

    incident = initial_result.incident

    original_incident_uuid = incident.id
    original_incident_id = (
        incident.incident_id
    )
    original_last_seen = incident.last_seen

    assert incident.event_count == 5
    assert (
        incident.max_anomaly_score
        == pytest.approx(
            0.997
        )
    )

    # --------------------------------------------------------
    # New later CRITICAL evidence arrives for the same campaign.
    # --------------------------------------------------------

    later_event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-ACCT-006",
        timestamp=(
            base_time
            + timedelta(
                minutes=5
            )
        ),
        event_type="FILE_ACCESS",
        success=True,
        bytes_sent=20_000,
        bytes_received=15_000,
        resource_type="file",
        resource_name="customer-export.csv",
        event_metadata={
            "source": "pytest",
            "classification": "RESTRICTED",
        },
    )

    later_anomaly = _create_anomaly(
        db_session,
        event=later_event,
        anomaly_score=0.9995,
        risk_level="CRITICAL",
        failed_logins_10m=4,
        file_events_30m=2,
    )

    updated_candidates = _correlate_one(
        db_session,
        event=later_event,
        anomaly=later_anomaly,
        employee=employee,
    )

    assert len(updated_candidates) == 1

    updated_candidate = (
        updated_candidates[0]
    )

    assert len(
        updated_candidate.events
    ) == 6

    updated_result = _persist_one(
        db_session,
        candidate=updated_candidate,
    )

    # --------------------------------------------------------
    # The same incident must evolve.
    # --------------------------------------------------------

    assert updated_result.action == "UPDATED"

    updated_incident = (
        updated_result.incident
    )

    assert (
        updated_incident.id
        == original_incident_uuid
    )

    assert (
        updated_incident.incident_id
        == original_incident_id
    )

    incident_count = db_session.scalar(
        select(
            func.count(
                Incident.id
            )
        )
    )

    assert incident_count == 1

    assert updated_incident.event_count == 6
    assert updated_incident.anomaly_count == 6

    assert (
        updated_incident.last_seen
        > original_last_seen
    )

    assert (
        updated_incident.last_seen
        == later_event.timestamp
    )

    assert (
        updated_incident.max_anomaly_score
        == pytest.approx(
            0.9995
        )
    )

    # --------------------------------------------------------
    # Authoritative link replacement must not duplicate evidence.
    # --------------------------------------------------------

    links = list(
        db_session.scalars(
            select(
                IncidentEvent
            )
            .where(
                IncidentEvent.incident_uuid
                == updated_incident.id
            )
            .order_by(
                IncidentEvent.sequence_number
            )
        ).all()
    )

    assert len(links) == 6

    assert [
        link.sequence_number
        for link in links
    ] == [
        1,
        2,
        3,
        4,
        5,
        6,
    ]

    event_uuids = [
        link.event_uuid
        for link in links
    ]

    assert len(
        event_uuids
    ) == len(
        set(
            event_uuids
        )
    )

    linked_event_ids = list(
        db_session.scalars(
            select(
                Event.event_id
            )
            .join(
                IncidentEvent,
                IncidentEvent.event_uuid
                == Event.id,
            )
            .where(
                IncidentEvent.incident_uuid
                == updated_incident.id
            )
            .order_by(
                IncidentEvent.sequence_number
            )
        ).all()
    )

    assert linked_event_ids == [
        "EVT-INT-ACCT-001",
        "EVT-INT-ACCT-002",
        "EVT-INT-ACCT-003",
        "EVT-INT-ACCT-004",
        "EVT-INT-ACCT-005",
        "EVT-INT-ACCT-006",
    ]

    # --------------------------------------------------------
    # Investigation is regenerated from the evolved evidence.
    # --------------------------------------------------------

    investigation = (
        updated_incident
        .evidence
        .get(
            "investigation"
        )
    )

    assert investigation is not None

    assert (
        investigation["engine"]
        == "structured-investigation"
    )

    assert investigation[
        "key_findings"
    ]

    assert updated_incident.investigation_steps


@pytest.mark.integration
@pytest.mark.postgres
def test_isolated_borderline_critical_event_does_not_create_incident(
    db_session: Session,
) -> None:
    """
    One isolated CRITICAL anomaly without a strong behavioral signal
    must not automatically become an incident.

    This verifies the architectural separation between anomaly detection
    and incident correlation.
    """

    base_time = datetime(
        2026,
        2,
        11,
        14,
        0,
        tzinfo=timezone.utc,
    )

    employee = _create_employee(
        db_session,
        user_id="integration_user_002",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-BORDERLINE-001",
        timestamp=base_time,
        event_type="LOGIN_FAILURE",
        success=False,
        bytes_sent=100,
        bytes_received=100,
        source_ip=employee.typical_ip,
        source_location=employee.typical_location,
        resource_type="authentication",
        resource_name="corporate-sso",
    )

    anomaly = _create_anomaly(
        db_session,
        event=event,
        anomaly_score=0.991,
        risk_level="CRITICAL",

        # Deliberately below every strong-single-event threshold.
        failed_logins_10m=1,
        outside_work_hours=0,
        source_ip_is_baseline=1,
        unique_destinations_5m=0,
        network_events_5m=0,
        file_events_30m=0,
        data_volume_ratio=0.10,
    )

    candidates = _correlate_one(
        db_session,
        event=event,
        anomaly=anomaly,
        employee=employee,
    )

    assert candidates == []

    incident_count = db_session.scalar(
        select(
            func.count(
                Incident.id
            )
        )
    )

    link_count = db_session.scalar(
        select(
            func.count(
                IncidentEvent.id
            )
        )
    )

    assert incident_count == 0
    assert link_count == 0


@pytest.mark.integration
@pytest.mark.postgres
def test_large_outbound_file_transfer_creates_suspicious_data_transfer_incident(
    db_session: Session,
) -> None:
    """
    One independently strong CRITICAL file-transfer event should create
    a SUSPICIOUS_DATA_TRANSFER incident when outbound volume exceeds
    the production correlation threshold.
    """

    base_time = datetime(
        2026,
        2,
        12,
        23,
        15,
        tzinfo=timezone.utc,
    )

    employee = _create_employee(
        db_session,
        user_id="integration_user_003",
    )

    event = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-XFER-001",
        timestamp=base_time,
        event_type="FILE_UPLOAD",
        success=True,
        bytes_sent=1_250_000_000,
        bytes_received=10_000,
        resource_type="file",
        resource_name="customer-database-export.zip",
        event_metadata={
            "source": "pytest",
            "classification": "CONFIDENTIAL",
            "destination_type": "EXTERNAL",
        },
    )

    anomaly = _create_anomaly(
        db_session,
        event=event,
        anomaly_score=0.999,
        risk_level="CRITICAL",
        failed_logins_10m=0,
        outside_work_hours=1,
        source_ip_is_baseline=0,
        unique_destinations_5m=1,
        network_events_5m=0,
        file_events_30m=1,
        data_volume_ratio=25.0,
    )

    # --------------------------------------------------------
    # Real correlation
    # --------------------------------------------------------

    candidates = _correlate_one(
        db_session,
        event=event,
        anomaly=anomaly,
        employee=employee,
    )

    assert len(candidates) == 1

    candidate = candidates[0]

    assert (
        candidate.incident_type
        == "SUSPICIOUS_DATA_TRANSFER"
    )

    assert (
        candidate.title
        == "Suspicious Data Transfer"
    )

    assert candidate.severity == "CRITICAL"

    assert len(candidate.events) == 1

    signals = candidate.evidence[
        "signals"
    ]

    assert signals[
        "file_events"
    ] == 1

    assert (
        signals[
            "total_bytes_sent"
        ]
        == 1_250_000_000
    )

    assert (
        signals[
            "external_transfer_events"
        ]
        == 1
    )

    assert (
        signals[
            "restricted_resource_events"
        ]
        == 1
    )

    assert (
        signals[
            "critical_events"
        ]
        == 1
    )

    # --------------------------------------------------------
    # Real persistence
    # --------------------------------------------------------

    result = _persist_one(
        db_session,
        candidate=candidate,
    )

    assert result.action == "CREATED"
    assert result.links_written == 1

    incident = result.incident

    assert (
        incident.incident_type
        == "SUSPICIOUS_DATA_TRANSFER"
    )

    assert incident.severity == "CRITICAL"
    assert incident.event_count == 1
    assert incident.anomaly_count == 1

    assert (
        incident.max_anomaly_score
        == pytest.approx(
            0.999
        )
    )

    assert (
        incident.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        incident.detector_version
        == SELECTED_DETECTOR.version
    )

    assert (
        incident.correlation_engine
        == "multi-signal-rules"
    )

    assert (
        incident.correlation_version
        == "1.0"
    )

    # --------------------------------------------------------
    # Deterministic investigation
    # --------------------------------------------------------

    investigation = (
        incident.evidence.get(
            "investigation"
        )
    )

    assert investigation is not None

    assert (
        "Critical severity"
        in investigation[
            "severity_rationale"
        ]
    )

    findings = investigation[
        "key_findings"
    ]

    assert any(
        finding[
            "category"
        ]
        == "data_transfer"
        for finding in findings
    )

    assert incident.investigation_steps

    assert any(
        step[
            "action"
        ]
        == (
            "Review transfer destinations "
            "and volumes"
        )
        for step
        in incident.investigation_steps
    )


@pytest.mark.integration
@pytest.mark.postgres
def test_network_fanout_correlates_into_network_reconnaissance_incident(
    db_session: Session,
) -> None:
    """
    Eight nearby network events with high destination fan-out should
    correlate into one NETWORK_RECONNAISSANCE incident.

    Only two events need to be CRITICAL seeds; the remaining HIGH-risk
    activity should be recovered through evidence expansion.
    """

    base_time = datetime(
        2026,
        2,
        13,
        1,
        0,
        tzinfo=timezone.utc,
    )

    employee = _create_employee(
        db_session,
        user_id="integration_user_004",
    )

    events: list[Event] = []
    anomalies: list[AnomalyScore] = []

    # --------------------------------------------------------
    # Build eight observable network connections.
    #
    # Events 1 and 8 are CRITICAL and form the seed cluster.
    # Events 2-7 are HIGH supporting evidence.
    # --------------------------------------------------------

    for index in range(
        1,
        9,
    ):
        event = _create_event(
            db_session,
            employee=employee,
            event_id=(
                f"EVT-INT-NET-{index:03d}"
            ),
            timestamp=(
                base_time
                + timedelta(
                    minutes=index - 1
                )
            ),
            event_type="NETWORK_CONNECTION",
            success=True,
            bytes_sent=5_000,
            bytes_received=2_000,
            destination_ip=(
                f"10.90.0.{index}"
            ),
            resource_type="network",
            resource_name=(
                f"internal-host-{index}"
            ),
            event_metadata={
                "source": "pytest",
                "destination_type": "INTERNAL",
            },
        )

        risk_level = (
            "CRITICAL"
            if index in {
                1,
                8,
            }
            else "HIGH"
        )

        anomaly_score = (
            0.998
            if index == 8
            else (
                0.995
                if index == 1
                else 0.960
            )
        )

        anomaly = _create_anomaly(
            db_session,
            event=event,
            anomaly_score=anomaly_score,
            risk_level=risk_level,
            outside_work_hours=1,
            source_ip_is_baseline=0,
            unique_destinations_5m=10,
            network_events_5m=8,
            file_events_30m=0,
            data_volume_ratio=0.10,
        )

        events.append(
            event
        )

        anomalies.append(
            anomaly
        )

    trigger_event = events[-1]
    trigger_anomaly = anomalies[-1]

    # --------------------------------------------------------
    # Real correlation
    # --------------------------------------------------------

    candidates = _correlate_one(
        db_session,
        event=trigger_event,
        anomaly=trigger_anomaly,
        employee=employee,
    )

    assert len(candidates) == 1

    candidate = candidates[0]

    assert (
        candidate.incident_type
        == "NETWORK_RECONNAISSANCE"
    )

    assert (
        candidate.title
        == "Potential Network Reconnaissance"
    )

    assert candidate.severity == "HIGH"

    # Evidence expansion should recover all eight network events,
    # not merely the two CRITICAL detector seeds.
    assert len(candidate.events) == 8

    assert [
        item.event.event_id
        for item in candidate.events
    ] == [
        "EVT-INT-NET-001",
        "EVT-INT-NET-002",
        "EVT-INT-NET-003",
        "EVT-INT-NET-004",
        "EVT-INT-NET-005",
        "EVT-INT-NET-006",
        "EVT-INT-NET-007",
        "EVT-INT-NET-008",
    ]

    signals = candidate.evidence[
        "signals"
    ]

    assert (
        signals[
            "network_events"
        ]
        == 8
    )

    assert (
        signals[
            "max_unique_destinations_5m"
        ]
        == 10
    )

    assert (
        signals[
            "max_network_events_5m"
        ]
        == 8
    )

    assert (
        signals[
            "critical_events"
        ]
        == 2
    )

    assert (
        signals[
            "anomalous_events"
        ]
        == 8
    )

    # --------------------------------------------------------
    # Real persistence
    # --------------------------------------------------------

    result = _persist_one(
        db_session,
        candidate=candidate,
    )

    assert result.action == "CREATED"
    assert result.links_written == 8

    incident = result.incident

    assert (
        incident.incident_type
        == "NETWORK_RECONNAISSANCE"
    )

    assert incident.severity == "HIGH"
    assert incident.event_count == 8
    assert incident.anomaly_count == 8

    assert (
        incident.max_anomaly_score
        == pytest.approx(
            0.998
        )
    )

    # --------------------------------------------------------
    # Persisted timeline ordering
    # --------------------------------------------------------

    links = list(
        db_session.scalars(
            select(
                IncidentEvent
            )
            .where(
                IncidentEvent.incident_uuid
                == incident.id
            )
            .order_by(
                IncidentEvent.sequence_number
            )
        ).all()
    )

    assert len(links) == 8

    assert [
        link.sequence_number
        for link in links
    ] == [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
    ]

    assert len(
        {
            link.event_uuid
            for link in links
        }
    ) == 8

    # --------------------------------------------------------
    # Deterministic investigation
    # --------------------------------------------------------

    investigation = (
        incident.evidence.get(
            "investigation"
        )
    )

    assert investigation is not None

    assert (
        "many destinations"
        in investigation[
            "severity_rationale"
        ]
    )

    findings = investigation[
        "key_findings"
    ]

    assert any(
        finding[
            "category"
        ]
        == "network"
        for finding in findings
    )

    assert any(
        step[
            "action"
        ]
        == "Review destination systems contacted"
        for step
        in incident.investigation_steps
    )


@pytest.mark.integration
@pytest.mark.postgres
def test_existing_authentication_incident_reclassifies_when_stronger_evidence_arrives(
    db_session: Session,
) -> None:
    """
    An existing authentication attack may legitimately evolve into a
    potential account compromise as stronger observable evidence arrives.

    The persisted incident identity and detector/correlation lineage must
    remain unchanged throughout the evolution.
    """

    base_time = datetime(
        2026,
        2,
        14,
        22,
        0,
        tzinfo=timezone.utc,
    )

    employee = _create_employee(
        db_session,
        user_id="integration_user_005",
    )

    failure_events: list[Event] = []
    failure_anomalies: list[AnomalyScore] = []

    # --------------------------------------------------------
    # Five authentication failures.
    #
    # Two are CRITICAL seeds.
    # Three are HIGH supporting evidence.
    #
    # This should initially classify as AUTHENTICATION_ATTACK.
    # --------------------------------------------------------

    for index in range(
        1,
        6,
    ):
        event = _create_event(
            db_session,
            employee=employee,
            event_id=(
                f"EVT-INT-EVOLVE-{index:03d}"
            ),
            timestamp=(
                base_time
                + timedelta(
                    minutes=index - 1
                )
            ),
            event_type="LOGIN_FAILURE",
            success=False,
            resource_type="authentication",
            resource_name="corporate-sso",
        )

        risk_level = (
            "CRITICAL"
            if index in {
                4,
                5,
            }
            else "HIGH"
        )

        anomaly = _create_anomaly(
            db_session,
            event=event,
            anomaly_score=(
                0.997
                if index == 5
                else (
                    0.994
                    if index == 4
                    else 0.960
                )
            ),
            risk_level=risk_level,
            failed_logins_10m=index,
            outside_work_hours=1,
            source_ip_is_baseline=0,
        )

        failure_events.append(
            event
        )

        failure_anomalies.append(
            anomaly
        )

    # --------------------------------------------------------
    # Initial correlation + persistence
    # --------------------------------------------------------

    initial_candidates = _correlate_one(
        db_session,
        event=failure_events[-1],
        anomaly=failure_anomalies[-1],
        employee=employee,
    )

    assert len(initial_candidates) == 1

    initial_candidate = (
        initial_candidates[0]
    )

    assert (
        initial_candidate.incident_type
        == "AUTHENTICATION_ATTACK"
    )

    assert (
        initial_candidate.title
        == "Repeated Authentication Attack"
    )

    assert initial_candidate.severity == "HIGH"

    initial_result = _persist_one(
        db_session,
        candidate=initial_candidate,
    )

    assert initial_result.action == "CREATED"

    incident = initial_result.incident

    original_uuid = incident.id
    original_incident_id = incident.incident_id

    original_lineage = (
        incident.detector_name,
        incident.detector_version,
        incident.correlation_engine,
        incident.correlation_version,
    )

    assert incident.event_count == 5

    # --------------------------------------------------------
    # A successful login now appears.
    #
    # This extends the same campaign, but without resource access
    # it should not yet become POTENTIAL_ACCOUNT_COMPROMISE.
    # --------------------------------------------------------

    login_success = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-EVOLVE-006",
        timestamp=(
            base_time
            + timedelta(
                minutes=5
            )
        ),
        event_type="LOGIN_SUCCESS",
        success=True,
        resource_type="authentication",
        resource_name="corporate-sso",
    )

    login_success_anomaly = _create_anomaly(
        db_session,
        event=login_success,
        anomaly_score=0.970,
        risk_level="HIGH",
        failed_logins_10m=5,
        outside_work_hours=1,
        source_ip_is_baseline=0,
    )

    success_candidates = _correlate_one(
        db_session,
        event=login_success,
        anomaly=login_success_anomaly,
        employee=employee,
    )

    assert len(success_candidates) == 1

    success_candidate = (
        success_candidates[0]
    )

    assert (
        success_candidate.incident_type
        == "AUTHENTICATION_ATTACK"
    )

    success_result = _persist_one(
        db_session,
        candidate=success_candidate,
    )

    assert success_result.action == "UPDATED"

    incident_after_success = (
        success_result.incident
    )

    assert (
        incident_after_success.id
        == original_uuid
    )

    assert (
        incident_after_success.incident_id
        == original_incident_id
    )

    assert (
        incident_after_success.event_count
        == 6
    )

    # --------------------------------------------------------
    # Sensitive resource access appears next.
    #
    # We now have:
    #   >= 3 login failures
    #   >= 1 login success
    #   >= 1 file event
    #
    # Production classification should therefore strengthen into
    # POTENTIAL_ACCOUNT_COMPROMISE.
    # --------------------------------------------------------

    file_access = _create_event(
        db_session,
        employee=employee,
        event_id="EVT-INT-EVOLVE-007",
        timestamp=(
            base_time
            + timedelta(
                minutes=6
            )
        ),
        event_type="FILE_ACCESS",
        success=True,
        bytes_sent=25_000,
        bytes_received=50_000,
        resource_type="file",
        resource_name="finance-forecast.xlsx",
        event_metadata={
            "source": "pytest",
            "classification": "RESTRICTED",
        },
    )

    file_anomaly = _create_anomaly(
        db_session,
        event=file_access,
        anomaly_score=0.985,
        risk_level="HIGH",
        failed_logins_10m=5,
        outside_work_hours=1,
        source_ip_is_baseline=0,
        file_events_30m=1,
    )

    compromise_candidates = _correlate_one(
        db_session,
        event=file_access,
        anomaly=file_anomaly,
        employee=employee,
    )

    assert len(
        compromise_candidates
    ) == 1

    compromise_candidate = (
        compromise_candidates[0]
    )

    assert (
        compromise_candidate.incident_type
        == "POTENTIAL_ACCOUNT_COMPROMISE"
    )

    assert (
        compromise_candidate.title
        == "Potential Account Compromise"
    )

    assert (
        compromise_candidate.severity
        == "CRITICAL"
    )

    compromise_result = _persist_one(
        db_session,
        candidate=compromise_candidate,
    )

    assert (
        compromise_result.action
        == "UPDATED"
    )

    evolved_incident = (
        compromise_result.incident
    )

    # --------------------------------------------------------
    # Same durable incident identity
    # --------------------------------------------------------

    assert (
        evolved_incident.id
        == original_uuid
    )

    assert (
        evolved_incident.incident_id
        == original_incident_id
    )

    incident_count = db_session.scalar(
        select(
            func.count(
                Incident.id
            )
        )
    )

    assert incident_count == 1

    # --------------------------------------------------------
    # Classification legitimately evolved
    # --------------------------------------------------------

    assert (
        evolved_incident.incident_type
        == "POTENTIAL_ACCOUNT_COMPROMISE"
    )

    assert (
        evolved_incident.title
        == "Potential Account Compromise"
    )

    assert (
        evolved_incident.severity
        == "CRITICAL"
    )

    assert evolved_incident.event_count == 7
    assert evolved_incident.anomaly_count == 7

    assert (
        evolved_incident.last_seen
        == file_access.timestamp
    )

    # --------------------------------------------------------
    # Provenance must remain immutable
    # --------------------------------------------------------

    evolved_lineage = (
        evolved_incident.detector_name,
        evolved_incident.detector_version,
        evolved_incident.correlation_engine,
        evolved_incident.correlation_version,
    )

    assert (
        evolved_lineage
        == original_lineage
    )

    assert (
        evolved_incident.detector_name
        == SELECTED_DETECTOR.name
    )

    assert (
        evolved_incident.detector_version
        == SELECTED_DETECTOR.version
    )

    assert (
        evolved_incident.correlation_engine
        == "multi-signal-rules"
    )

    assert (
        evolved_incident.correlation_version
        == "1.0"
    )

    # --------------------------------------------------------
    # Latest authoritative evidence links
    # --------------------------------------------------------

    links = list(
        db_session.scalars(
            select(
                IncidentEvent
            )
            .where(
                IncidentEvent.incident_uuid
                == evolved_incident.id
            )
            .order_by(
                IncidentEvent.sequence_number
            )
        ).all()
    )

    assert len(links) == 7

    assert [
        link.sequence_number
        for link in links
    ] == [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
    ]

    assert len(
        {
            link.event_uuid
            for link in links
        }
    ) == 7

    # --------------------------------------------------------
    # Investigation must reflect the stronger classification
    # --------------------------------------------------------

    investigation = (
        evolved_incident
        .evidence
        .get(
            "investigation"
        )
    )

    assert investigation is not None

    assert (
        "Critical severity"
        in investigation[
            "severity_rationale"
        ]
    )

    assert (
        "successful access"
        in investigation[
            "severity_rationale"
        ]
    )

    findings = investigation[
        "key_findings"
    ]

    assert any(
        finding[
            "finding"
        ]
        == (
            "Successful authentication "
            "followed repeated failures"
        )
        for finding in findings
    )

    assert any(
        finding[
            "category"
        ]
        == "resource"
        for finding in findings
    )


# ============================================================
# AI evidence safety integration
# ============================================================

from dataclasses import asdict

from app.services.ai_evidence import (
    AIEvidenceBuilder,
    FORBIDDEN_GROUND_TRUTH_KEYS,
)


@pytest.mark.integration
@pytest.mark.postgres
@pytest.mark.safety
def test_ai_evidence_builder_exposes_only_whitelisted_operational_evidence(
    db_session: Session,
) -> None:
    """
    Real PostgreSQL-backed proof that SENTINEL's AI evidence layer
    exposes only whitelisted operational evidence.

    The test intentionally places simulator/evaluation-looking fields
    inside raw Event.event_metadata. Those values must never reach the
    AI evidence package because event_metadata is not part of the
    whitelist.
    """

    # --------------------------------------------------------
    # Seed the real deterministic incident pipeline.
    # --------------------------------------------------------

    scenario = _seed_account_compromise(
        db_session
    )

    employee = scenario[
        "employee"
    ]

    events = scenario[
        "events"
    ]

    trigger_event = scenario[
        "trigger_event"
    ]

    trigger_anomaly = scenario[
        "trigger_anomaly"
    ]

    assert isinstance(
        employee,
        Employee,
    )

    assert isinstance(
        trigger_event,
        Event,
    )

    assert isinstance(
        trigger_anomaly,
        AnomalyScore,
    )

    # --------------------------------------------------------
    # Put deliberately private-looking information into raw
    # operational event metadata.
    #
    # AIEvidenceBuilder must not copy Event.event_metadata.
    # --------------------------------------------------------

    private_metadata_event = events[2]

    assert isinstance(
        private_metadata_event,
        Event,
    )

    private_metadata_event.event_metadata = {
        "source":
            "pytest",

        "classification":
            "TOP-SECRET-TEST-VALUE",

        "scenario_type":
            "PRIVATE_SIMULATOR_SCENARIO",

        "simulation_batch":
            "PRIVATE-BATCH-001",

        "is_injected_anomaly":
            True,
    }

    db_session.flush()

    # --------------------------------------------------------
    # Add another detector generation for one correlated event.
    #
    # The AI timeline must continue using only the detector
    # lineage selected by the persisted incident.
    # --------------------------------------------------------

    alternate_anomaly = AnomalyScore(
        event_uuid=(
            private_metadata_event.id
        ),

        detector_name=(
            "alternate-pytest-detector"
        ),

        detector_version="99.0",

        detector_type="pytest",

        raw_score=-9.99,

        anomaly_score=0.123456,

        risk_level="LOW",

        feature_snapshot={
            "pytest":
                True,
        },

        explanation={
            "source":
                "alternate detector"
        },
    )

    db_session.add(
        alternate_anomaly
    )

    db_session.flush()

    # --------------------------------------------------------
    # Real correlation + persistence + deterministic
    # investigation.
    # --------------------------------------------------------

    candidates = _correlate_one(
        db_session,
        event=trigger_event,
        anomaly=trigger_anomaly,
        employee=employee,
    )

    assert len(
        candidates
    ) == 1

    persistence_result = _persist_one(
        db_session,
        candidate=candidates[0],
    )

    assert (
        persistence_result.action
        == "CREATED"
    )

    assert (
        persistence_result.links_written
        == 5
    )

    incident = (
        persistence_result.incident
    )

    # --------------------------------------------------------
    # Build real AI-safe evidence.
    # --------------------------------------------------------

    builder = AIEvidenceBuilder(
        db_session
    )

    package = builder.build(
        incident.incident_id
    )

    package_dict = asdict(
        package
    )

    # build_dict() must expose the same safe contract.
    direct_dict = builder.build_dict(
        incident.incident_id
    )

    assert (
        direct_dict
        == package_dict
    )

    # --------------------------------------------------------
    # Top-level evidence contract
    # --------------------------------------------------------

    assert set(
        package_dict.keys()
    ) == {
        "evidence_version",
        "incident",
        "identity_context",
        "correlation",
        "deterministic_investigation",
        "timeline",
    }

    assert (
        package_dict[
            "evidence_version"
        ]
        == "1.0"
    )

    # --------------------------------------------------------
    # Identity allowlist
    #
    # Internal user_id is useful for investigation.
    # Employee display name must not be sent to the LLM.
    # --------------------------------------------------------

    identity = package_dict[
        "identity_context"
    ]

    assert (
        identity[
            "user_id"
        ]
        == "integration_user_001"
    )

    assert (
        identity[
            "department"
        ]
        == "Engineering"
    )

    assert (
        identity[
            "job_role"
        ]
        == "Platform Engineer"
    )

    assert (
        "name"
        not in identity
    )

    # --------------------------------------------------------
    # Correlation lineage
    # --------------------------------------------------------

    correlation = package_dict[
        "correlation"
    ]

    assert (
        correlation[
            "detector_name"
        ]
        == SELECTED_DETECTOR.name
    )

    assert (
        correlation[
            "detector_version"
        ]
        == SELECTED_DETECTOR.version
    )

    assert (
        correlation[
            "engine"
        ]
        == "multi-signal-rules"
    )

    assert (
        correlation[
            "version"
        ]
        == "1.0"
    )

    # --------------------------------------------------------
    # Deterministic investigation survives into AI evidence.
    # --------------------------------------------------------

    deterministic = package_dict[
        "deterministic_investigation"
    ]

    assert deterministic[
        "engine"
    ]

    assert deterministic[
        "version"
    ]

    assert (
        deterministic[
            "severity_rationale"
        ]
    )

    assert (
        len(
            deterministic[
                "key_findings"
            ]
        )
        > 0
    )

    assert (
        len(
            deterministic[
                "investigation_steps"
            ]
        )
        > 0
    )

    # --------------------------------------------------------
    # Timeline order and selected-detector lineage
    # --------------------------------------------------------

    timeline = package_dict[
        "timeline"
    ]

    assert len(
        timeline
    ) == 5

    assert [
        item[
            "sequence_number"
        ]
        for item in timeline
    ] == [
        1,
        2,
        3,
        4,
        5,
    ]

    assert [
        item[
            "event_id"
        ]
        for item in timeline
    ] == [
        "EVT-INT-ACCT-001",
        "EVT-INT-ACCT-002",
        "EVT-INT-ACCT-003",
        "EVT-INT-ACCT-004",
        "EVT-INT-ACCT-005",
    ]

    # The FILE_ACCESS event's selected-detector score is 0.955.
    #
    # The alternate detector score above is 0.123456 and must
    # not replace the selected detector lineage.
    file_event_evidence = timeline[2]

    assert (
        file_event_evidence[
            "event_id"
        ]
        == "EVT-INT-ACCT-003"
    )

    assert (
        file_event_evidence[
            "anomaly_percentile"
        ]
        == pytest.approx(
            0.955
        )
    )

    # --------------------------------------------------------
    # Explicit whitelist: raw Event.event_metadata is absent.
    # --------------------------------------------------------

    for item in timeline:
        assert (
            "event_metadata"
            not in item
        )

        assert (
            "classification"
            not in item
        )

    # --------------------------------------------------------
    # Final structural ground-truth safety check.
    # --------------------------------------------------------

    def collect_keys(
        value,
    ) -> set[str]:
        keys: set[str] = set()

        if isinstance(
            value,
            dict,
        ):
            for (
                key,
                nested_value,
            ) in value.items():
                keys.add(
                    str(
                        key
                    )
                    .strip()
                    .lower()
                )

                keys.update(
                    collect_keys(
                        nested_value
                    )
                )

        elif isinstance(
            value,
            list,
        ):
            for item in value:
                keys.update(
                    collect_keys(
                        item
                    )
                )

        return keys

    evidence_keys = collect_keys(
        package_dict
    )

    assert (
        evidence_keys
        .isdisjoint(
            FORBIDDEN_GROUND_TRUTH_KEYS
        )
    )

    # --------------------------------------------------------
    # Strong regression guard:
    # private raw metadata values must not appear anywhere in
    # the final package either.
    # --------------------------------------------------------

    serialized_evidence = repr(
        package_dict
    )

    assert (
        "TOP-SECRET-TEST-VALUE"
        not in serialized_evidence
    )

    assert (
        "PRIVATE_SIMULATOR_SCENARIO"
        not in serialized_evidence
    )

    assert (
        "PRIVATE-BATCH-001"
        not in serialized_evidence
    )

    assert (
        "Sara Ahmed"
        not in serialized_evidence
    )

    assert (
        "alternate-pytest-detector"
        not in serialized_evidence
    )

    assert (
        "99.0"
        not in serialized_evidence
    )
