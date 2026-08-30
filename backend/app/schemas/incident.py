from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class IncidentListItem(BaseModel):
    incident_id: str
    title: str
    incident_type: str
    severity: str
    status: str

    primary_employee_user_id: str | None

    first_seen: datetime
    last_seen: datetime

    event_count: int
    anomaly_count: int
    max_anomaly_score: float

    summary: str


class IncidentSeverityDistribution(BaseModel):
    medium: int
    high: int
    critical: int


class IncidentSummary(BaseModel):
    total_incidents: int
    open_incidents: int

    critical_incidents: int
    high_incidents: int
    medium_incidents: int

    total_correlated_events: int

    severity_distribution: IncidentSeverityDistribution


class IncidentDetail(BaseModel):
    incident_id: str
    title: str
    incident_type: str
    severity: str
    status: str

    primary_employee_user_id: str | None

    first_seen: datetime
    last_seen: datetime

    event_count: int
    anomaly_count: int

    max_anomaly_score: float

    summary: str
    correlation_reason: str

    indicators: list[
        dict[str, Any]
    ]

    evidence: dict[
        str,
        Any,
    ]

    investigation_steps: list[
        dict[str, Any]
    ]


class IncidentTimelineEvent(BaseModel):
    sequence_number: int

    event_id: str
    timestamp: datetime
    event_type: str

    employee_user_id: str

    source_ip: str | None
    destination_ip: str | None

    anomaly_score: float
    risk_level: str

    correlation_score: float
    correlation_reason: str


class IncidentInvestigation(BaseModel):
    incident_id: str

    severity_rationale: str

    key_findings: list[
        dict[str, Any]
    ]

    investigation_steps: list[
        dict[str, Any]
    ]

    analyst_questions: list[str]

    containment_actions: list[
        dict[str, Any]
    ]