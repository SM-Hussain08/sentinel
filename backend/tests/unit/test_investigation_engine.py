"""
Unit tests for SENTINEL's deterministic investigation engine.

No database, simulator ground truth, or generative AI is required.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timezone,
)

import pytest

from app.models import Incident
from app.services.investigation_engine import (
    InvestigationEngine,
)


def make_incident(
    *,
    incident_type: str,
    severity: str = "HIGH",
    max_anomaly_score: float = 0.995,
    signals: dict | None = None,
) -> Incident:
    now = datetime(
        2026,
        1,
        15,
        12,
        0,
        tzinfo=timezone.utc,
    )

    return Incident(
        incident_id="INC-UNIT-001",
        title="Unit Test Incident",
        incident_type=incident_type,
        severity=severity,
        status="OPEN",
        detector_name="isolation-forest",
        detector_version="1.2",
        correlation_engine=(
            "behavioral-correlation"
        ),
        correlation_version="1.0",
        first_seen=now,
        last_seen=now,
        event_count=1,
        anomaly_count=1,
        max_anomaly_score=(
            max_anomaly_score
        ),
        summary="Unit test incident.",
        correlation_reason=(
            "Deterministic test."
        ),
        indicators=[],
        evidence={
            "signals": signals or {},
        },
        investigation_steps=[],
    )


@pytest.mark.unit
def test_account_compromise_severity_rationale() -> None:
    incident = make_incident(
        incident_type=(
            "POTENTIAL_ACCOUNT_COMPROMISE"
        )
    )

    result = InvestigationEngine().analyze(
        incident
    )

    assert (
        "repeated authentication failures"
        in result.severity_rationale
    )

    assert (
        "successful access"
        in result.severity_rationale
    )


@pytest.mark.unit
def test_network_reconnaissance_severity_rationale() -> None:
    incident = make_incident(
        incident_type=(
            "NETWORK_RECONNAISSANCE"
        )
    )

    result = InvestigationEngine().analyze(
        incident
    )

    assert (
        "many destinations"
        in result.severity_rationale
    )


@pytest.mark.unit
def test_generic_incident_uses_medium_rationale() -> None:
    incident = make_incident(
        incident_type=(
            "UNCLASSIFIED_BEHAVIORAL_ANOMALY"
        ),
        severity="MEDIUM",
    )

    result = InvestigationEngine().analyze(
        incident
    )

    assert (
        result.severity_rationale.startswith(
            "Medium severity"
        )
    )


@pytest.mark.unit
def test_login_failures_create_authentication_finding() -> None:
    incident = make_incident(
        incident_type="AUTHENTICATION_ATTACK",
        signals={
            "login_failures": 6,
        },
    )

    result = InvestigationEngine().analyze(
        incident
    )

    findings = {
        item["finding"]: item
        for item
        in result.key_findings
    }

    assert (
        "Failed authentication attempts"
        in findings
    )

    assert (
        findings[
            "Failed authentication attempts"
        ]["value"]
        == 6
    )


@pytest.mark.unit
def test_success_after_failures_creates_finding() -> None:
    incident = make_incident(
        incident_type=(
            "POTENTIAL_ACCOUNT_COMPROMISE"
        ),
        signals={
            "login_failures": 3,
            "login_successes": 1,
        },
    )

    result = InvestigationEngine().analyze(
        incident
    )

    finding_names = {
        item["finding"]
        for item
        in result.key_findings
    }

    assert (
        "Successful authentication followed "
        "repeated failures"
        in finding_names
    )


@pytest.mark.unit
def test_large_transfer_creates_high_finding() -> None:
    incident = make_incident(
        incident_type=(
            "SUSPICIOUS_DATA_TRANSFER"
        ),
        signals={
            "total_bytes_sent":
                500_000_000,
        },
    )

    result = InvestigationEngine().analyze(
        incident
    )

    finding = next(
        item
        for item
        in result.key_findings
        if (
            item["finding"]
            == "Large outbound data volume"
        )
    )

    assert finding["confidence"] == "HIGH"


@pytest.mark.unit
def test_gigabyte_transfer_creates_critical_finding() -> None:
    incident = make_incident(
        incident_type=(
            "SUSPICIOUS_DATA_TRANSFER"
        ),
        signals={
            "total_bytes_sent":
                1_000_000_000,
        },
    )

    result = InvestigationEngine().analyze(
        incident
    )

    finding = next(
        item
        for item
        in result.key_findings
        if (
            item["finding"]
            == "Large outbound data volume"
        )
    )

    assert (
        finding["confidence"]
        == "CRITICAL"
    )


@pytest.mark.unit
def test_network_fanout_threshold_creates_finding() -> None:
    incident = make_incident(
        incident_type=(
            "NETWORK_RECONNAISSANCE"
        ),
        signals={
            "max_unique_destinations_5m": 5,
        },
    )

    result = InvestigationEngine().analyze(
        incident
    )

    finding_names = {
        item["finding"]
        for item
        in result.key_findings
    }

    assert (
        "Rapid destination fan-out"
        in finding_names
    )


@pytest.mark.unit
def test_machine_learning_finding_is_always_present() -> None:
    incident = make_incident(
        incident_type=(
            "UNCLASSIFIED_BEHAVIORAL_ANOMALY"
        ),
        max_anomaly_score=0.987654,
    )

    result = InvestigationEngine().analyze(
        incident
    )

    ml_finding = next(
        item
        for item
        in result.key_findings
        if (
            item["category"]
            == "machine_learning"
        )
    )

    assert (
        ml_finding["finding"]
        == "Maximum anomaly percentile"
    )

    assert (
        ml_finding["value"]
        == 0.9877
    )


@pytest.mark.unit
def test_account_compromise_gets_immediate_containment() -> None:
    incident = make_incident(
        incident_type=(
            "POTENTIAL_ACCOUNT_COMPROMISE"
        )
    )

    result = InvestigationEngine().analyze(
        incident
    )

    assert any(
        item["urgency"] == "IMMEDIATE"
        for item
        in result.containment_actions
    )

    assert any(
        "resetting credentials"
        in item["action"]
        for item
        in result.containment_actions
    )


@pytest.mark.unit
def test_generic_incident_gets_monitoring_containment() -> None:
    incident = make_incident(
        incident_type=(
            "UNCLASSIFIED_BEHAVIORAL_ANOMALY"
        )
    )

    result = InvestigationEngine().analyze(
        incident
    )

    assert result.containment_actions == [
        {
            "urgency": "REVIEW",
            "action": (
                "Continue enhanced monitoring"
            ),
            "condition": (
                "Escalate containment if additional "
                "high-risk behavior appears."
            ),
        }
    ]


@pytest.mark.unit
def test_investigation_always_preserves_evidence_step() -> None:
    incident = make_incident(
        incident_type=(
            "UNCLASSIFIED_BEHAVIORAL_ANOMALY"
        )
    )

    result = InvestigationEngine().analyze(
        incident
    )

    actions = [
        item["action"]
        for item
        in result.investigation_steps
    ]

    assert (
        "Preserve supporting event evidence"
        in actions
    )

    assert (
        "Search for related activity"
        in actions
    )


@pytest.mark.unit
@pytest.mark.safety
def test_investigation_result_contains_no_ground_truth_keys() -> None:
    incident = make_incident(
        incident_type=(
            "POTENTIAL_ACCOUNT_COMPROMISE"
        ),
        signals={
            "login_failures": 5,
            "login_successes": 1,
            "off_hours_events": 1,
        },
    )

    result = InvestigationEngine().analyze(
        incident
    )

    serialized = repr(
        {
            "severity_rationale":
                result.severity_rationale,
            "key_findings":
                result.key_findings,
            "investigation_steps":
                result.investigation_steps,
            "analyst_questions":
                result.analyst_questions,
            "containment_actions":
                result.containment_actions,
        }
    ).casefold()

    forbidden = (
        "is_injected",
        "scenario_type",
        "attack_stage",
        "simulation_ground_truth",
    )

    for field in forbidden:
        assert field not in serialized