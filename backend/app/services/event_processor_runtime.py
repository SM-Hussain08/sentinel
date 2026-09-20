"""
Lifecycle and live-event discovery for SENTINEL's always-on processor.

This module does not perform ML scoring or incident correlation itself.

Its responsibilities are:

- establish one persistent activation boundary per detector generation;
- preserve that boundary across worker restarts;
- maintain lifecycle and heartbeat metadata;
- discover only live events received after activation;
- exclude events already scored by the selected detector;
- return work in deterministic arrival order.

Historical backfill is deliberately a separate workflow.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import (
    datetime,
    timezone,
)
import socket

from sqlalchemy import (
    exists,
    select,
)
from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Event,
    EventProcessorState,
)
from app.selected_detector import (
    SELECTED_DETECTOR,
)


PROCESSOR_NAME = "event-processor"
PROCESSOR_VERSION = "1.0"

DEFAULT_BATCH_SIZE = 100


# ============================================================
# Result models
# ============================================================

@dataclass(
    frozen=True,
)
class EventDiscoveryResult:
    """
    One deterministic live-processing batch.
    """

    events: list[Event]

    batch_size: int

    activated_at: datetime

    detector_name: str

    detector_version: str

    @property
    def event_count(
        self,
    ) -> int:
        return len(
            self.events
        )


# ============================================================
# Identity helpers
# ============================================================

def default_worker_id(
) -> str:
    """
    Return a logical worker identity without depending on Docker IDs.
    """

    return (
        f"processor-{socket.gethostname()}"
    )


# ============================================================
# Processor state
# ============================================================

def get_processor_state(
    *,
    db: Session,
) -> EventProcessorState | None:
    """
    Return the persistent state for the currently selected detector.
    """

    statement = (
        select(
            EventProcessorState
        )
        .where(
            EventProcessorState.processor_name
            == PROCESSOR_NAME,

            EventProcessorState.detector_name
            == SELECTED_DETECTOR.name,

            EventProcessorState.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    return db.scalar(
        statement
    )


def activate_processor(
    *,
    db: Session,
    worker_id: str | None = None,
    configuration: dict | None = None,
) -> EventProcessorState:
    """
    Activate or resume the selected-detector processor generation.

    First activation
    ----------------
    A new state row is created and activated_at becomes the permanent
    live-processing boundary.

    Restart
    -------
    An existing row is reused. activated_at is NEVER moved forward.

    This function flushes but does not commit.
    """

    now = datetime.now(
        timezone.utc
    )

    state = get_processor_state(
        db=db
    )

    effective_worker_id = (
        worker_id
        or default_worker_id()
    )

    if state is None:
        state = EventProcessorState(
            processor_name=PROCESSOR_NAME,

            worker_id=(
                effective_worker_id
            ),

            worker_version=(
                PROCESSOR_VERSION
            ),

            detector_name=(
                SELECTED_DETECTOR.name
            ),

            detector_version=(
                SELECTED_DETECTOR.version
            ),

            status="starting",

            activated_at=now,

            last_heartbeat_at=now,

            stopped_at=None,

            events_processed=0,

            scores_created=0,

            incidents_created=0,

            incidents_updated=0,

            last_error=None,

            configuration=(
                configuration
                or {}
            ),

            runtime_metadata={
                "activation_reason":
                    "first-live-activation",
            },
        )

        db.add(
            state
        )

    else:
        # Critical restart rule:
        # never change state.activated_at here.
        state.worker_id = (
            effective_worker_id
        )

        state.worker_version = (
            PROCESSOR_VERSION
        )

        state.status = "starting"

        state.last_heartbeat_at = now

        state.stopped_at = None

        state.last_error = None

        if configuration is not None:
            state.configuration = (
                configuration
            )

        metadata = dict(
            state.runtime_metadata
            or {}
        )

        metadata[
            "last_restart_at"
        ] = now.isoformat()

        state.runtime_metadata = (
            metadata
        )

    db.flush()

    return state


def mark_processor_running(
    *,
    db: Session,
    state: EventProcessorState,
) -> None:
    """
    Mark a successfully initialized processor as running.
    """

    now = datetime.now(
        timezone.utc
    )

    state.status = "running"
    state.last_heartbeat_at = now
    state.last_error = None

    db.flush()


def heartbeat_processor(
    *,
    db: Session,
    state: EventProcessorState,
    runtime_metadata: dict | None = None,
) -> None:
    """
    Refresh processor health without changing the activation boundary.
    """

    now = datetime.now(
        timezone.utc
    )

    state.last_heartbeat_at = now

    if runtime_metadata:
        merged = dict(
            state.runtime_metadata
            or {}
        )

        merged.update(
            runtime_metadata
        )

        state.runtime_metadata = (
            merged
        )

    db.flush()


def mark_processor_stopped(
    *,
    db: Session,
    state: EventProcessorState,
) -> None:
    """
    Record a clean worker shutdown.
    """

    now = datetime.now(
        timezone.utc
    )

    state.status = "stopped"
    state.stopped_at = now
    state.last_heartbeat_at = now

    db.flush()


def mark_processor_failed(
    *,
    db: Session,
    state: EventProcessorState,
    error: Exception | str,
) -> None:
    """
    Record processor failure diagnostics.
    """

    now = datetime.now(
        timezone.utc
    )

    state.status = "failed"
    state.stopped_at = now
    state.last_heartbeat_at = now
    state.last_error = str(
        error
    )

    db.flush()


# ============================================================
# Live work discovery
# ============================================================

def discover_live_events(
    *,
    db: Session,
    state: EventProcessorState,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> EventDiscoveryResult:
    """
    Discover events eligible for automatic live processing.

    Eligibility:

    1. The event ARRIVED at SENTINEL on or after this processor
       generation's activation boundary.

    2. The event does not already have a score from the selected
       detector version.

    Events are ordered deterministically by arrival time and UUID.

    Security-event timestamp is intentionally not used for the live
    boundary because late-arriving logs may describe older activity.
    """

    if batch_size < 1:
        raise ValueError(
            "batch_size must be >= 1."
        )

    already_scored = exists(
        select(
            AnomalyScore.id
        )
        .where(
            AnomalyScore.event_uuid
            == Event.id,

            AnomalyScore.detector_name
            == state.detector_name,

            AnomalyScore.detector_version
            == state.detector_version,
        )
    )

    statement = (
        select(
            Event
        )
        .where(
            Event.created_at
            >= state.activated_at,

            ~already_scored,
        )
        .order_by(
            Event.created_at.asc(),
            Event.id.asc(),
        )
        .limit(
            batch_size
        )
    )

    events = list(
        db.scalars(
            statement
        ).all()
    )

    return EventDiscoveryResult(
        events=events,

        batch_size=batch_size,

        activated_at=(
            state.activated_at
        ),

        detector_name=(
            state.detector_name
        ),

        detector_version=(
            state.detector_version
        ),
    )
