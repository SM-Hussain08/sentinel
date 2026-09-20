"""
Atomic operational processing for one SENTINEL Event.

Shared pipeline:

    Event
      -> selected-detector anomaly scoring
      -> incremental incident correlation
      -> incident create/update persistence
      -> deterministic investigation refresh

Two entry points are intentionally supported:

1. Live processing
   - respects the processor activation boundary;
   - requires a RUNNING processor generation;
   - updates live processor counters and heartbeat.

2. Explicit maintenance/backfill
   - may process historical Events from any arrival time;
   - does not require a running processor;
   - does not modify processor activation state or live counters.

Both paths:
- use the same selected detector;
- use the same correlation engine;
- use the same incident persistence service;
- use the same PostgreSQL advisory transaction lock;
- never consult simulator ground truth;
- never invoke Ollama / generative AI.

This service deliberately does NOT commit.
The caller owns the transaction.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import (
    select,
    text,
)
from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Employee,
    Event,
    EventProcessorState,
)

from app.selected_detector import (
    SELECTED_DETECTOR,
)

from app.services.event_processor_runtime import (
    PROCESSOR_NAME,
    heartbeat_processor,
)

from app.services.incident_correlation import (
    IncidentCorrelationEngine,
)

from app.services.incident_persistence import (
    IncidentPersistenceService,
)

from app.services.ml_scoring import (
    score_event,
)


# ============================================================
# Transaction serialization
# ============================================================

# The live processor and explicit backfill utility share this lock.
#
# That means a maintenance backfill cannot race a live processor and create
# duplicate selected-version scores or duplicate incident mutations.
#
# PostgreSQL automatically releases pg_advisory_xact_lock at
# COMMIT / ROLLBACK.
PROCESSOR_TRANSACTION_LOCK_KEY = 91212026


# ============================================================
# Result
# ============================================================

@dataclass(
    frozen=True,
)
class EventProcessingResult:
    """
    Observable result for one processing attempt.
    """

    status: str

    event_id: str

    anomaly_score_id: UUID | None

    risk_level: str | None

    anomaly_score: float | None

    candidates_evaluated: int

    incidents_created: int

    incidents_updated: int

    incident_ids: tuple[str, ...]


# ============================================================
# Service
# ============================================================

class EventProcessingService:
    """
    Execute SENTINEL's complete operational pipeline for one Event.
    """

    def __init__(
        self,
        *,
        db: Session,
    ) -> None:
        self.db = db

    # ========================================================
    # Live processing
    # ========================================================

    def process_event(
        self,
        *,
        event_id: UUID,
        processor_state_id: UUID,
    ) -> EventProcessingResult:
        """
        Process one newly arrived Event for the always-on processor.

        Possible statuses:

            PROCESSED

            SKIPPED_ALREADY_PROCESSED

            SKIPPED_BEFORE_ACTIVATION

        Live processor state is updated only when a new score is
        successfully produced.
        """

        self._acquire_processor_lock()

        state = self.db.get(
            EventProcessorState,
            processor_state_id,
        )

        if state is None:
            raise LookupError(
                (
                    "Event processor state "
                    f"{processor_state_id} was not found."
                )
            )

        self._validate_processor_state(
            state
        )

        event = self._load_event(
            event_id
        )

        # ----------------------------------------------------
        # Live generation boundary
        # ----------------------------------------------------

        if (
            event.created_at
            < state.activated_at
        ):
            return self._skipped_before_activation(
                event
            )

        # ----------------------------------------------------
        # Selected-version idempotency
        # ----------------------------------------------------

        existing_score = (
            self._existing_selected_score(
                event_id=event.id
            )
        )

        if existing_score is not None:
            return self._skipped_existing(
                event=event,
                score=existing_score,
            )

        # ----------------------------------------------------
        # Shared operational pipeline
        # ----------------------------------------------------

        result = (
            self._process_unscored_event(
                event=event
            )
        )

        # ----------------------------------------------------
        # Live processor accounting only
        # ----------------------------------------------------

        state.events_processed += 1
        state.scores_created += 1

        state.incidents_created += (
            result.incidents_created
        )

        state.incidents_updated += (
            result.incidents_updated
        )

        heartbeat_processor(
            db=self.db,
            state=state,
            runtime_metadata={
                "last_event_id":
                    result.event_id,

                "last_event_uuid":
                    str(
                        event.id
                    ),

                "last_risk_level":
                    result.risk_level,

                "last_anomaly_score":
                    result.anomaly_score,
            },
        )

        self.db.flush()

        return result

    # ========================================================
    # Maintenance / historical backfill
    # ========================================================

    def process_event_backfill(
        self,
        *,
        event_id: UUID,
    ) -> EventProcessingResult:
        """
        Process one historical/unprocessed Event.

        Backfill deliberately ignores the live processor activation
        boundary.

        It also deliberately does NOT:
        - require processor state;
        - require the processor to be running;
        - increment live processor counters;
        - change activated_at;
        - update processor heartbeat.

        The same scoring, correlation, incident persistence and
        deterministic investigation pipeline is still used.
        """

        self._acquire_processor_lock()

        event = self._load_event(
            event_id
        )

        existing_score = (
            self._existing_selected_score(
                event_id=event.id
            )
        )

        if existing_score is not None:
            return self._skipped_existing(
                event=event,
                score=existing_score,
            )

        return self._process_unscored_event(
            event=event
        )

    # ========================================================
    # Shared operational pipeline
    # ========================================================

    def _process_unscored_event(
        self,
        *,
        event: Event,
    ) -> EventProcessingResult:
        """
        Score, correlate and persist downstream operational effects.

        This method is intentionally shared by both live processing
        and historical backfill.
        """

        employee = self.db.get(
            Employee,
            event.employee_id,
        )

        if employee is None:
            raise RuntimeError(
                (
                    "Employee could not be resolved "
                    f"for Event {event.event_id}."
                )
            )

        # ----------------------------------------------------
        # ML scoring
        # ----------------------------------------------------

        anomaly = score_event(
            db=self.db,
            event=event,
            employee=employee,
        )

        # ----------------------------------------------------
        # Incremental correlation
        # ----------------------------------------------------

        correlation_engine = (
            IncidentCorrelationEngine(
                db=self.db
            )
        )

        candidates = (
            correlation_engine
            .correlate_event(
                event=event,
                anomaly=anomaly,
                employee=employee,
            )
        )

        # ----------------------------------------------------
        # Incident create / evolve
        # ----------------------------------------------------

        persistence_service = (
            IncidentPersistenceService(
                db=self.db
            )
        )

        incidents_created = 0
        incidents_updated = 0

        incident_ids: list[str] = []

        for candidate in candidates:
            persistence_result = (
                persistence_service
                .persist_candidate(
                    candidate=candidate
                )
            )

            if (
                persistence_result.action
                == "CREATED"
            ):
                incidents_created += 1

            elif (
                persistence_result.action
                == "UPDATED"
            ):
                incidents_updated += 1

            else:
                raise RuntimeError(
                    (
                        "Unexpected incident "
                        "persistence action: "
                        f"{persistence_result.action}"
                    )
                )

            incident_ids.append(
                persistence_result
                .incident
                .incident_id
            )

        self.db.flush()

        return EventProcessingResult(
            status="PROCESSED",

            event_id=event.event_id,

            anomaly_score_id=(
                anomaly.id
            ),

            risk_level=(
                anomaly.risk_level
            ),

            anomaly_score=float(
                anomaly.anomaly_score
            ),

            candidates_evaluated=len(
                candidates
            ),

            incidents_created=(
                incidents_created
            ),

            incidents_updated=(
                incidents_updated
            ),

            incident_ids=tuple(
                incident_ids
            ),
        )

    # ========================================================
    # Loading
    # ========================================================

    def _load_event(
        self,
        event_id: UUID,
    ) -> Event:
        event = self.db.get(
            Event,
            event_id,
        )

        if event is None:
            raise LookupError(
                (
                    "Event "
                    f"{event_id} was not found."
                )
            )

        return event

    # ========================================================
    # Locking
    # ========================================================

    def _acquire_processor_lock(
        self,
    ) -> None:
        """
        Serialize live and maintenance Event-processing transactions.
        """

        self.db.execute(
            text(
                "SELECT pg_advisory_xact_lock(:lock_key)"
            ),
            {
                "lock_key":
                    PROCESSOR_TRANSACTION_LOCK_KEY,
            },
        )

    # ========================================================
    # Live state validation
    # ========================================================

    @staticmethod
    def _validate_processor_state(
        state: EventProcessorState,
    ) -> None:
        if (
            state.processor_name
            != PROCESSOR_NAME
        ):
            raise ValueError(
                (
                    "Unexpected processor identity: "
                    f"{state.processor_name}."
                )
            )

        if (
            state.detector_name
            != SELECTED_DETECTOR.name
            or state.detector_version
            != SELECTED_DETECTOR.version
        ):
            raise ValueError(
                (
                    "Processor detector generation "
                    "does not match the selected detector. "
                    f"Processor={state.detector_name} "
                    f"v{state.detector_version}; "
                    f"selected={SELECTED_DETECTOR.name} "
                    f"v{SELECTED_DETECTOR.version}."
                )
            )

        if state.status != "running":
            raise RuntimeError(
                (
                    "Event processor must be RUNNING "
                    "before live processing Events. "
                    f"Current status={state.status!r}."
                )
            )

    # ========================================================
    # Score idempotency
    # ========================================================

    def _existing_selected_score(
        self,
        *,
        event_id: UUID,
    ) -> AnomalyScore | None:
        return self.db.scalar(
            select(
                AnomalyScore
            )
            .where(
                AnomalyScore.event_uuid
                == event_id,

                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,
            )
        )

    # ========================================================
    # Skip results
    # ========================================================

    @staticmethod
    def _skipped_before_activation(
        event: Event,
    ) -> EventProcessingResult:
        return EventProcessingResult(
            status=(
                "SKIPPED_BEFORE_ACTIVATION"
            ),

            event_id=event.event_id,

            anomaly_score_id=None,

            risk_level=None,

            anomaly_score=None,

            candidates_evaluated=0,

            incidents_created=0,

            incidents_updated=0,

            incident_ids=(),
        )

    @staticmethod
    def _skipped_existing(
        *,
        event: Event,
        score: AnomalyScore,
    ) -> EventProcessingResult:
        return EventProcessingResult(
            status=(
                "SKIPPED_ALREADY_PROCESSED"
            ),

            event_id=event.event_id,

            anomaly_score_id=(
                score.id
            ),

            risk_level=(
                score.risk_level
            ),

            anomaly_score=float(
                score.anomaly_score
            ),

            candidates_evaluated=0,

            incidents_created=0,

            incidents_updated=0,

            incident_ids=(),
        )