"""
Evidence preparation for SENTINEL's local AI investigation layer.

The AI model must never receive simulator ground truth or evaluation-only
metadata.

This service builds a deliberately whitelisted evidence package from:

- correlated incident metadata
- operational correlation signals
- deterministic investigation intelligence
- employee behavioral context
- the selected model's correlated event timeline

The output is safe to pass to the local language model in later Phase 7
steps.
"""

from __future__ import annotations

from dataclasses import (
    asdict,
    dataclass,
)
from datetime import datetime
from typing import Any

from sqlalchemy import select
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


# ============================================================
# Safety policy
# ============================================================

FORBIDDEN_GROUND_TRUTH_KEYS = {
    "is_injected_anomaly",
    "scenario_type",
    "simulation_batch",
}


class GroundTruthLeakageError(
    RuntimeError
):
    """
    Raised if an AI evidence package accidentally contains a
    simulator/evaluation-only field.
    """


# ============================================================
# Evidence structures
# ============================================================

@dataclass(
    frozen=True,
)
class AIIdentityContext:
    """
    Limited employee context that is useful for behavioral analysis.

    We intentionally use the SENTINEL user ID instead of sending the
    employee's display name to the AI model.
    """

    user_id: str | None

    department: str | None
    job_role: str | None

    normal_start_hour: int | None
    normal_end_hour: int | None

    typical_location: str | None


@dataclass(
    frozen=True,
)
class AITimelineEvidence:
    """
    One operational event supplied to the AI layer.

    IMPORTANT:
    This is an explicit whitelist.

    Event.event_metadata, Event.is_injected_anomaly, and
    Event.scenario_type are intentionally excluded.
    """

    sequence_number: int

    event_id: str
    timestamp: str
    event_type: str

    employee_user_id: str

    source_ip: str
    destination_ip: str | None
    source_location: str | None

    resource_type: str | None
    resource_name: str | None

    bytes_sent: int
    bytes_received: int

    success: bool

    anomaly_percentile: float
    risk_level: str

    correlation_score: float
    correlation_reason: str


@dataclass(
    frozen=True,
)
class AIEvidencePackage:
    """
    Complete evidence contract supplied to the local language model.
    """

    evidence_version: str

    incident: dict[
        str,
        Any,
    ]

    identity_context: AIIdentityContext

    correlation: dict[
        str,
        Any,
    ]

    deterministic_investigation: dict[
        str,
        Any,
    ]

    timeline: list[
        AITimelineEvidence
    ]


# ============================================================
# Evidence builder
# ============================================================

class AIEvidenceBuilder:
    """
    Build an evidence-grounded package for one SENTINEL incident.

    Only operational information is copied into the resulting package.
    Simulator labels and evaluation-only metadata are never accessed.
    """

    EVIDENCE_VERSION = (
        "1.0"
    )


    def __init__(
        self,
        db: Session,
    ) -> None:
        self.db = db


    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def build(
        self,
        incident_id: str,
    ) -> AIEvidencePackage:
        """
        Build one complete AI-safe evidence package.

        Raises:
            LookupError:
                If the incident does not exist.

            RuntimeError:
                If deterministic investigation intelligence has not
                yet been generated.

            GroundTruthLeakageError:
                If a forbidden simulator/evaluation field appears in
                the final package.
        """

        (
            incident,
            employee,
        ) = self._load_incident(
            incident_id
        )

        timeline = (
            self._load_timeline(
                incident
            )
        )

        investigation = (
            self._load_deterministic_investigation(
                incident
            )
        )

        signals = dict(
            (
                incident.evidence
                or {}
            ).get(
                "signals",
                {},
            )
        )

        package = AIEvidencePackage(
            evidence_version=(
                self.EVIDENCE_VERSION
            ),

            incident={
                "incident_id":
                    incident.incident_id,

                "title":
                    incident.title,

                "incident_type":
                    incident.incident_type,

                "severity":
                    incident.severity,

                "status":
                    incident.status,

                "first_seen":
                    self._datetime_text(
                        incident.first_seen
                    ),

                "last_seen":
                    self._datetime_text(
                        incident.last_seen
                    ),

                "event_count":
                    int(
                        incident.event_count
                    ),

                "anomaly_count":
                    int(
                        incident.anomaly_count
                    ),

                "maximum_anomaly_percentile":
                    round(
                        float(
                            incident.max_anomaly_score
                        ),
                        6,
                    ),

                "summary":
                    incident.summary,

                "correlation_reason":
                    incident.correlation_reason,

                "indicators":
                    list(
                        incident.indicators
                        or []
                    ),
            },

            identity_context=(
                self._identity_context(
                    employee
                )
            ),

            correlation={
                "engine":
                    (
                        incident.evidence
                        or {}
                    ).get(
                        "correlation_engine"
                    ),

                "version":
                    (
                        incident.evidence
                        or {}
                    ).get(
                        "correlation_version"
                    ),

                "detector_name":
                    (
                        incident.evidence
                        or {}
                    ).get(
                        "detector_name"
                    ),

                "detector_version":
                    (
                        incident.evidence
                        or {}
                    ).get(
                        "detector_version"
                    ),

                "signals":
                    signals,
            },

            deterministic_investigation={
                "engine":
                    investigation.get(
                        "engine"
                    ),

                "version":
                    investigation.get(
                        "version"
                    ),

                "severity_rationale":
                    investigation.get(
                        "severity_rationale",
                        "",
                    ),

                "key_findings":
                    list(
                        investigation.get(
                            "key_findings",
                            [],
                        )
                    ),

                "investigation_steps":
                    list(
                        incident.investigation_steps
                        or []
                    ),

                "analyst_questions":
                    list(
                        investigation.get(
                            "analyst_questions",
                            [],
                        )
                    ),

                "containment_actions":
                    list(
                        investigation.get(
                            "containment_actions",
                            [],
                        )
                    ),
            },

            timeline=timeline,
        )

        self._assert_no_ground_truth(
            asdict(
                package
            )
        )

        return package


    def build_dict(
        self,
        incident_id: str,
    ) -> dict[str, Any]:
        """
        Convenience method for JSON/prompt construction.
        """

        package = self.build(
            incident_id
        )

        return asdict(
            package
        )


    # --------------------------------------------------------
    # Incident
    # --------------------------------------------------------

    def _load_incident(
        self,
        incident_id: str,
    ) -> tuple[
        Incident,
        Employee | None,
    ]:
        row = self.db.execute(
            select(
                Incident,
                Employee,
            )
            .outerjoin(
                Employee,
                Incident.primary_employee_id
                == Employee.id,
            )
            .where(
                Incident.incident_id
                == incident_id
            )
        ).first()

        if row is None:
            raise LookupError(
                "Incident was not found."
            )

        incident, employee = row

        return (
            incident,
            employee,
        )


    # --------------------------------------------------------
    # Deterministic investigation
    # --------------------------------------------------------

    @staticmethod
    def _load_deterministic_investigation(
        incident: Incident,
    ) -> dict[str, Any]:
        investigation = dict(
            (
                incident.evidence
                or {}
            ).get(
                "investigation",
                {},
            )
        )

        if not investigation:
            raise RuntimeError(
                "Deterministic investigation intelligence "
                "has not been generated for this incident."
            )

        return investigation


    # --------------------------------------------------------
    # Identity context
    # --------------------------------------------------------

    @staticmethod
    def _identity_context(
        employee: Employee | None,
    ) -> AIIdentityContext:
        if employee is None:
            return AIIdentityContext(
                user_id=None,
                department=None,
                job_role=None,
                normal_start_hour=None,
                normal_end_hour=None,
                typical_location=None,
            )

        return AIIdentityContext(
            user_id=(
                employee.user_id
            ),

            department=(
                employee.department
            ),

            job_role=(
                employee.job_role
            ),

            normal_start_hour=(
                employee.normal_start_hour
            ),

            normal_end_hour=(
                employee.normal_end_hour
            ),

            typical_location=(
                employee.typical_location
            ),
        )


    # --------------------------------------------------------
    # Timeline
    # --------------------------------------------------------

    def _load_timeline(
        self,
        incident: Incident,
    ) -> list[
        AITimelineEvidence
    ]:
        rows = self.db.execute(
            select(
                IncidentEvent,
                Event,
                Employee,
                AnomalyScore,
            )
            .join(
                Event,
                IncidentEvent.event_uuid
                == Event.id,
            )
            .join(
                Employee,
                Event.employee_id
                == Employee.id,
            )
            .join(
                AnomalyScore,
                AnomalyScore.event_uuid
                == Event.id,
            )
            .where(
                IncidentEvent.incident_uuid
                == incident.id,

                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,
            )
            .order_by(
                IncidentEvent.sequence_number
            )
        ).all()

        timeline: list[
            AITimelineEvidence
        ] = []

        for (
            link,
            event,
            employee,
            anomaly,
        ) in rows:
            timeline.append(
                AITimelineEvidence(
                    sequence_number=(
                        int(
                            link.sequence_number
                        )
                    ),

                    event_id=(
                        event.event_id
                    ),

                    timestamp=(
                        self._datetime_text(
                            event.timestamp
                        )
                    ),

                    event_type=(
                        event.event_type
                    ),

                    employee_user_id=(
                        employee.user_id
                    ),

                    source_ip=(
                        event.source_ip
                    ),

                    destination_ip=(
                        event.destination_ip
                    ),

                    source_location=(
                        event.source_location
                    ),

                    resource_type=(
                        event.resource_type
                    ),

                    resource_name=(
                        event.resource_name
                    ),

                    bytes_sent=(
                        int(
                            event.bytes_sent
                        )
                    ),

                    bytes_received=(
                        int(
                            event.bytes_received
                        )
                    ),

                    success=(
                        bool(
                            event.success
                        )
                    ),

                    anomaly_percentile=(
                        round(
                            float(
                                anomaly.anomaly_score
                            ),
                            6,
                        )
                    ),

                    risk_level=(
                        anomaly.risk_level
                    ),

                    correlation_score=(
                        round(
                            float(
                                link.correlation_score
                            ),
                            6,
                        )
                    ),

                    correlation_reason=(
                        link.correlation_reason
                    ),
                )
            )

        return timeline


    # --------------------------------------------------------
    # Safety validation
    # --------------------------------------------------------

    @classmethod
    def _assert_no_ground_truth(
        cls,
        value: Any,
        path: str = "root",
    ) -> None:
        """
        Recursively verify that no forbidden simulator/evaluation keys
        have entered the AI evidence package.

        This acts as a regression guard in addition to the explicit
        whitelist used above.
        """

        if isinstance(
            value,
            dict,
        ):
            for (
                key,
                nested_value,
            ) in value.items():
                normalized_key = (
                    str(
                        key
                    )
                    .strip()
                    .lower()
                )

                if (
                    normalized_key
                    in FORBIDDEN_GROUND_TRUTH_KEYS
                ):
                    raise GroundTruthLeakageError(
                        "Forbidden ground-truth field "
                        f"{key!r} detected at "
                        f"{path}."
                    )

                cls._assert_no_ground_truth(
                    nested_value,
                    (
                        f"{path}."
                        f"{key}"
                    ),
                )

            return

        if isinstance(
            value,
            list,
        ):
            for (
                index,
                nested_value,
            ) in enumerate(
                value
            ):
                cls._assert_no_ground_truth(
                    nested_value,
                    (
                        f"{path}"
                        f"[{index}]"
                    ),
                )


    # --------------------------------------------------------
    # Helpers
    # --------------------------------------------------------

    @staticmethod
    def _datetime_text(
        value: datetime,
    ) -> str:
        return value.isoformat()