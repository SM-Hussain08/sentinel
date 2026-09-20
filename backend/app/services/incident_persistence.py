"""
Persistence layer for correlated SENTINEL incidents.

This service converts an IncidentCandidate produced by the deterministic
correlation engine into a durable Incident record.

It supports both:

    CREATE
        for a newly actionable campaign

    UPDATE
        when additional evidence extends an already-created campaign

Important boundaries
--------------------
- No simulator ground truth is queried.
- No Ollama / generative AI is called.
- Incident detector lineage is explicit and immutable per generation.
- Deterministic investigation intelligence is refreshed automatically.
- The caller owns the database transaction.
"""

from __future__ import annotations

from dataclasses import dataclass

from datetime import (
    datetime,
    timezone,
)
import re

from sqlalchemy import (
    delete,
    select,
)
from sqlalchemy.orm import Session

from app.models import (
    Incident,
    IncidentEvent,
)

from app.services.incident_correlation import (
    IncidentCandidate,
)

from app.services.investigation_engine import (
    InvestigationEngine,
)


CORRELATION_REASON = (
    "Identity, temporal proximity, and behavioral "
    "risk correlation."
)

INVESTIGATION_ENGINE_NAME = (
    "structured-investigation"
)

INVESTIGATION_ENGINE_VERSION = "1.0"


@dataclass(
    frozen=True,
)
class IncidentPersistenceResult:
    """
    Result of persisting one incident candidate.
    """

    action: str

    incident: Incident

    links_written: int


class IncidentPersistenceService:
    """
    Create or evolve persisted incidents from correlation candidates.
    """

    def __init__(
        self,
        *,
        db: Session,
    ) -> None:
        self.db = db

        self.investigation_engine = (
            InvestigationEngine()
        )

    # ========================================================
    # Public API
    # ========================================================

    def persist_candidate(
        self,
        *,
        candidate: IncidentCandidate,
    ) -> IncidentPersistenceResult:
        """
        Create or update one incident from a correlation candidate.

        This method flushes but does not commit.
        """

        provenance = (
            self._candidate_provenance(
                candidate
            )
        )

        incident = (
            self._find_existing_incident(
                candidate=candidate,
                detector_name=(
                    provenance[
                        "detector_name"
                    ]
                ),
                detector_version=(
                    provenance[
                        "detector_version"
                    ]
                ),
                correlation_engine=(
                    provenance[
                        "correlation_engine"
                    ]
                ),
                correlation_version=(
                    provenance[
                        "correlation_version"
                    ]
                ),
            )
        )

        if incident is None:
            incident = (
                self._create_incident(
                    candidate=candidate,
                    provenance=provenance,
                )
            )

            action = "CREATED"

        else:
            self._update_incident(
                incident=incident,
                candidate=candidate,
                provenance=provenance,
            )

            action = "UPDATED"

        links_written = (
            self._replace_event_links(
                incident=incident,
                candidate=candidate,
            )
        )

        self._refresh_investigation(
            incident
        )

        self.db.flush()

        return (
            IncidentPersistenceResult(
                action=action,
                incident=incident,
                links_written=(
                    links_written
                ),
            )
        )

    # ========================================================
    # Candidate provenance
    # ========================================================

    @staticmethod
    def _candidate_provenance(
        candidate: IncidentCandidate,
    ) -> dict[str, str]:
        """
        Read and validate detector/correlation provenance from candidate.
        """

        evidence = (
            candidate.evidence
            or {}
        )

        required = {
            "detector_name":
                evidence.get(
                    "detector_name"
                ),

            "detector_version":
                evidence.get(
                    "detector_version"
                ),

            "correlation_engine":
                evidence.get(
                    "correlation_engine"
                ),

            "correlation_version":
                evidence.get(
                    "correlation_version"
                ),
        }

        missing = [
            key
            for (
                key,
                value,
            )
            in required.items()
            if not value
        ]

        if missing:
            raise ValueError(
                (
                    "Incident candidate is missing "
                    "required provenance: "
                    + ", ".join(
                        missing
                    )
                )
            )

        return {
            key: str(
                value
            )
            for (
                key,
                value,
            )
            in required.items()
        }

    # ========================================================
    # Existing incident matching
    # ========================================================

    def _find_existing_incident(
        self,
        *,
        candidate: IncidentCandidate,
        detector_name: str,
        detector_version: str,
        correlation_engine: str,
        correlation_version: str,
    ) -> Incident | None:
        """
        Find the already-persisted live incident for this campaign.

        Matching is intentionally lineage-aware.

        Primary matching rule:
            same employee
            + same detector generation
            + same correlation engine
            + OPEN incident
            + at least one shared evidence Event

        Shared evidence is stronger than matching only on incident type
        because a developing campaign may be reclassified as stronger
        evidence arrives.
        """

        candidate_event_ids = [
            item.event.id
            for item
            in candidate.events
        ]

        if not candidate_event_ids:
            return None

        statement = (
            select(
                Incident
            )
            .join(
                IncidentEvent,
                IncidentEvent.incident_uuid
                == Incident.id,
            )
            .where(
                Incident.primary_employee_id
                == candidate.primary_employee.id,

                Incident.detector_name
                == detector_name,

                Incident.detector_version
                == detector_version,

                Incident.correlation_engine
                == correlation_engine,

                Incident.correlation_version
                == correlation_version,

                Incident.status
                == "OPEN",

                IncidentEvent.event_uuid.in_(
                    candidate_event_ids
                ),
            )
            .order_by(
                Incident.first_seen.asc()
            )
            .limit(
                1
            )
        )

        return self.db.scalar(
            statement
        )

    # ========================================================
    # Create
    # ========================================================

    def _create_incident(
        self,
        *,
        candidate: IncidentCandidate,
        provenance: dict[str, str],
    ) -> Incident:
        incident = Incident(
            incident_id=(
                self._next_incident_id()
            ),

            title=candidate.title,

            incident_type=(
                candidate.incident_type
            ),

            severity=(
                candidate.severity
            ),

            status="OPEN",

            detector_name=(
                provenance[
                    "detector_name"
                ]
            ),

            detector_version=(
                provenance[
                    "detector_version"
                ]
            ),

            correlation_engine=(
                provenance[
                    "correlation_engine"
                ]
            ),

            correlation_version=(
                provenance[
                    "correlation_version"
                ]
            ),

            primary_employee_id=(
                candidate
                .primary_employee
                .id
            ),

            first_seen=(
                candidate.first_seen
            ),

            last_seen=(
                candidate.last_seen
            ),

            event_count=len(
                candidate.events
            ),

            anomaly_count=(
                candidate.anomaly_count
            ),

            max_anomaly_score=(
                candidate.max_anomaly_score
            ),

            summary=(
                candidate.summary
            ),

            correlation_reason=(
                candidate
                .correlation_reason
            ),

            indicators=list(
                candidate.indicators
            ),

            evidence=dict(
                candidate.evidence
            ),

            investigation_steps=[],
        )

        self.db.add(
            incident
        )

        # We need the Incident UUID before event links are created.
        self.db.flush()

        return incident

    # ========================================================
    # Update
    # ========================================================

    @staticmethod
    def _update_incident(
        *,
        incident: Incident,
        candidate: IncidentCandidate,
        provenance: dict[str, str],
    ) -> None:
        """
        Refresh one evolving incident from the latest candidate state.

        Detector/correlation lineage must not change.
        """

        existing_provenance = (
            incident.detector_name,
            incident.detector_version,
            incident.correlation_engine,
            incident.correlation_version,
        )

        candidate_provenance = (
            provenance[
                "detector_name"
            ],
            provenance[
                "detector_version"
            ],
            provenance[
                "correlation_engine"
            ],
            provenance[
                "correlation_version"
            ],
        )

        if (
            existing_provenance
            != candidate_provenance
        ):
            raise ValueError(
                (
                    "Attempted to update an incident "
                    "with different detector or "
                    "correlation provenance."
                )
            )

        # Classification may legitimately evolve as evidence grows.
        incident.title = (
            candidate.title
        )

        incident.incident_type = (
            candidate.incident_type
        )

        incident.severity = (
            candidate.severity
        )

        incident.first_seen = min(
            incident.first_seen,
            candidate.first_seen,
        )

        incident.last_seen = max(
            incident.last_seen,
            candidate.last_seen,
        )

        incident.event_count = len(
            candidate.events
        )

        incident.anomaly_count = (
            candidate.anomaly_count
        )

        incident.max_anomaly_score = (
            candidate.max_anomaly_score
        )

        incident.summary = (
            candidate.summary
        )

        incident.correlation_reason = (
            candidate.correlation_reason
        )

        incident.indicators = list(
            candidate.indicators
        )

        incident.evidence = dict(
            candidate.evidence
        )

    # ========================================================
    # Event links
    # ========================================================

    def _replace_event_links(
        self,
        *,
        incident: Incident,
        candidate: IncidentCandidate,
    ) -> int:
        """
        Rebuild event links from the authoritative latest candidate.

        Replacing instead of incrementally appending guarantees:

        - no duplicate event links;
        - deterministic sequence numbers;
        - removed evidence does not remain stale;
        - correlation scores stay synchronized.
        """

        self.db.execute(
            delete(
                IncidentEvent
            )
            .where(
                IncidentEvent.incident_uuid
                == incident.id
            )
        )

        for (
            sequence_number,
            item,
        ) in enumerate(
            candidate.events,
            start=1,
        ):
            self.db.add(
                IncidentEvent(
                    incident_uuid=(
                        incident.id
                    ),

                    event_uuid=(
                        item.event.id
                    ),

                    sequence_number=(
                        sequence_number
                    ),

                    correlation_score=float(
                        item.anomaly
                        .anomaly_score
                    ),

                    correlation_reason=(
                        CORRELATION_REASON
                    ),
                )
            )

        return len(
            candidate.events
        )

    # ========================================================
    # Deterministic investigation
    # ========================================================

    def _refresh_investigation(
        self,
        incident: Incident,
    ) -> None:
        """
        Rebuild deterministic analyst guidance from current evidence.

        No LLM is called.
        """

        result = (
            self.investigation_engine
            .analyze(
                incident
            )
        )

        incident.investigation_steps = (
            result.investigation_steps
        )

        evidence = dict(
            incident.evidence
            or {}
        )

        evidence[
            "investigation"
        ] = {
            "engine":
                INVESTIGATION_ENGINE_NAME,

            "version":
                INVESTIGATION_ENGINE_VERSION,

            "severity_rationale":
                result.severity_rationale,

            "key_findings":
                result.key_findings,

            "analyst_questions":
                result.analyst_questions,

            "containment_actions":
                result.containment_actions,
        }

        incident.evidence = (
            evidence
        )

    # ========================================================
    # Incident IDs
    # ========================================================

    def _next_incident_id(
        self,
    ) -> str:
        """
        Generate the next human-readable incident identifier.

        Concurrency protection will be strengthened in Phase 9.12H when
        the score/correlation/persistence transaction is wired together.
        """

        incident_ids = list(
            self.db.scalars(
                select(
                    Incident.incident_id
                )
            ).all()
        )

        highest = 0

        pattern = re.compile(
            r"^INC-(\d{4})-(\d+)$"
        )

        for incident_id in incident_ids:
            match = pattern.match(
                incident_id
            )

            if match is None:
                continue

            sequence = int(
                match.group(
                    2
                )
            )

            highest = max(
                highest,
                sequence,
            )

        year = datetime.now(
            timezone.utc
        ).year

        return (
            f"INC-{year}-"
            f"{highest + 1:04d}"
        )
