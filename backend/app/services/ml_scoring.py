"""
Shared production ML scoring service for SENTINEL.

This module is the canonical operational boundary for the selected anomaly
detector.

It supports:

1. Incremental scoring
   Score one newly persisted event for the live pipeline.

2. Batch/backfill scoring
   Score historical events that have not yet been analyzed by the selected
   detector.

Both paths use SENTINEL's canonical selected Isolation Forest configuration.

Simulator ground-truth fields are never supplied to the operational detector.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Employee,
    Event,
)
from app.selected_detector import (
    SELECTED_DETECTOR,
    SELECTED_MODEL_PATH,
)
from ml_engine.evaluation import (
    classify_ml_risk,
)
from ml_engine.features import (
    EventFeatureBuilder,
)
from ml_engine.models import (
    SentinelIsolationForest,
)


# ============================================================
# Result models
# ============================================================

@dataclass(frozen=True)
class MLScoringSummary:
    """
    Summary returned by a batch/backfill scoring operation.
    """

    available_events: int
    new_scores: int
    existing_scores: int
    threshold_hits: int
    risk_counts: dict[
        str,
        int,
    ]


# ============================================================
# Shared helpers
# ============================================================

def python_value(
    value,
):
    """
    Convert NumPy/Pandas scalar values into JSON-safe Python values.
    """

    if isinstance(
        value,
        np.generic,
    ):
        return value.item()

    return value


@lru_cache(
    maxsize=1,
)
def get_selected_model(
) -> SentinelIsolationForest:
    """
    Load and cache SENTINEL's selected production detector.

    Long-running workers therefore load the model only once rather than
    deserializing the joblib artifact for every incoming event.
    """

    if not SELECTED_MODEL_PATH.exists():
        raise RuntimeError(
            "Selected model artifact was not found. "
            "Run SENTINEL's benchmark/model-training "
            "workflow first."
        )

    detector = (
        SentinelIsolationForest.load(
            SELECTED_MODEL_PATH
        )
    )

    if (
        detector.model_name
        != SELECTED_DETECTOR.name
        or detector.model_version
        != SELECTED_DETECTOR.version
    ):
        raise RuntimeError(
            "Loaded model identity does not match "
            "SENTINEL's selected detector configuration. "
            f"Expected "
            f"{SELECTED_DETECTOR.name} "
            f"v{SELECTED_DETECTOR.version}; "
            f"loaded "
            f"{detector.model_name} "
            f"v{detector.model_version}."
        )

    return detector


def _existing_score(
    *,
    db: Session,
    event: Event,
) -> AnomalyScore | None:
    """
    Return the existing selected-model result for an event, if present.
    """

    statement = (
        select(
            AnomalyScore
        )
        .where(
            AnomalyScore.event_uuid
            == event.id,

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    )

    return db.scalar(
        statement
    )


def _feature_snapshot(
    *,
    row: pd.Series,
    detector: SentinelIsolationForest,
) -> dict:
    """
    Persist only the exact features consumed by the selected detector.

    Evaluation labels and other metadata are therefore excluded by design.
    """

    return {
        feature:
            python_value(
                row[
                    feature
                ]
            )
        for feature
        in detector.feature_columns
    }


def _build_anomaly_score(
    *,
    event: Event,
    row: pd.Series,
    detector: SentinelIsolationForest,
    raw_score: float,
    anomaly_score: float,
    prediction: int,
) -> AnomalyScore:
    """
    Construct the persisted AnomalyScore representation.
    """

    risk_level = (
        classify_ml_risk(
            anomaly_score
        )
    )

    return AnomalyScore(
        event_uuid=event.id,

        detector_name=(
            SELECTED_DETECTOR.name
        ),

        detector_version=(
            SELECTED_DETECTOR.version
        ),

        detector_type=(
            SELECTED_DETECTOR
            .detector_type
        ),

        raw_score=float(
            raw_score
        ),

        anomaly_score=float(
            anomaly_score
        ),

        risk_level=(
            risk_level
        ),

        feature_snapshot=(
            _feature_snapshot(
                row=row,
                detector=detector,
            )
        ),

        explanation={
            "summary": (
                "Isolation Forest "
                "behavioral anomaly "
                "analysis completed."
            ),

            "score_interpretation": (
                "Historical anomaly "
                "percentile relative to "
                "the training baseline; "
                "not a probability of attack."
            ),

            "alert_threshold": (
                detector
                .threshold_percentile
            ),

            "alert_threshold_reached": (
                bool(
                    prediction
                )
            ),

            "model_name": (
                detector.model_name
            ),

            "model_version": (
                detector.model_version
            ),
        },
    )


# ============================================================
# Incremental scoring
# ============================================================

def score_event(
    *,
    db: Session,
    event: Event,
    employee: Employee | None = None,
    detector: SentinelIsolationForest | None = None,
) -> AnomalyScore:
    """
    Score one persisted event with SENTINEL's selected Isolation Forest.

    This function does NOT commit the transaction.

    The caller owns transaction boundaries so that future live processing can
    atomically perform:

        persist Event
        -> score Event
        -> correlate Incident
        -> commit

    If the event has already been scored by this detector version, the existing
    AnomalyScore is returned.
    """

    if event.id is None:
        raise RuntimeError(
            "Event must be persisted and flushed "
            "before ML scoring."
        )

    existing = (
        _existing_score(
            db=db,
            event=event,
        )
    )

    if existing is not None:
        return existing

    if employee is None:
        employee = db.get(
            Employee,
            event.employee_id,
        )

    if employee is None:
        raise RuntimeError(
            "Employee could not be resolved "
            f"for event {event.event_id}."
        )

    selected_model = (
        detector
        or get_selected_model()
    )

    builder = EventFeatureBuilder(
        db=db,
    )

    feature_row = (
        builder.build_event_row(
            event=event,
            employee=employee,

            # Critical security boundary:
            # operational scoring never receives simulator labels.
            include_evaluation_metadata=False,
        )
    )

    dataframe = pd.DataFrame(
        [
            feature_row,
        ]
    )

    raw_scores = (
        selected_model
        .raw_anomaly_scores(
            dataframe
        )
    )

    anomaly_scores = (
        selected_model
        .normalized_scores(
            dataframe
        )
    )

    predictions = (
        selected_model.predict(
            dataframe
        )
    )

    row = dataframe.iloc[
        0
    ]

    anomaly = (
        _build_anomaly_score(
            event=event,
            row=row,
            detector=selected_model,
            raw_score=float(
                raw_scores[
                    0
                ]
            ),
            anomaly_score=float(
                anomaly_scores[
                    0
                ]
            ),
            prediction=int(
                predictions[
                    0
                ]
            ),
        )
    )

    db.add(
        anomaly
    )

    # Flush instead of commit.
    #
    # This makes the score immediately available to later operations in the
    # same transaction while preserving transaction ownership for the caller.
    db.flush()

    return anomaly


# ============================================================
# Batch / backfill scoring
# ============================================================

def score_unscored_events(
    *,
    db: Session,
    detector: SentinelIsolationForest | None = None,
) -> MLScoringSummary:
    """
    Score every event that does not already have a result from SENTINEL's
    selected detector.

    The complete chronological feature dataframe is built so rolling features
    remain identical to historical benchmark behavior.

    Simulator ground-truth metadata is deliberately excluded from this
    operational scoring path.

    This function does NOT commit the transaction.
    """

    selected_model = (
        detector
        or get_selected_model()
    )

    builder = EventFeatureBuilder(
        db=db,
    )

    dataframe = (
        builder.build_dataframe(
            include_evaluation_metadata=False,
        )
    )

    if dataframe.empty:
        raise RuntimeError(
            "No events were available "
            "for ML scoring."
        )

    raw_scores = (
        selected_model
        .raw_anomaly_scores(
            dataframe
        )
    )

    anomaly_scores = (
        selected_model
        .normalized_scores(
            dataframe
        )
    )

    predictions = (
        selected_model.predict(
            dataframe
        )
    )

    event_rows = db.execute(
        select(
            Event.id,
            Event.event_id,
        )
    ).all()

    event_uuid_map = {
        event_id:
            event_uuid
        for (
            event_uuid,
            event_id,
        )
        in event_rows
    }

    event_object_map = {
        event.event_id:
            event
        for event
        in db.scalars(
            select(
                Event
            )
        ).all()
    }

    existing_event_ids = set(
        db.execute(
            select(
                Event.event_id
            )
            .join(
                AnomalyScore,
                AnomalyScore.event_uuid
                == Event.id,
            )
            .where(
                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,
            )
        ).scalars()
    )

    pending_scores: list[
        AnomalyScore
    ] = []

    skipped = 0

    for position, (
        _,
        row,
    ) in enumerate(
        dataframe.iterrows()
    ):
        event_id = str(
            row[
                "event_id"
            ]
        )

        if (
            event_id
            in existing_event_ids
        ):
            skipped += 1
            continue

        event_uuid = (
            event_uuid_map.get(
                event_id
            )
        )

        event = (
            event_object_map.get(
                event_id
            )
        )

        if (
            event_uuid is None
            or event is None
        ):
            raise RuntimeError(
                "Database event was not found "
                f"for {event_id}."
            )

        anomaly = (
            _build_anomaly_score(
                event=event,
                row=row,
                detector=selected_model,
                raw_score=float(
                    raw_scores[
                        position
                    ]
                ),
                anomaly_score=float(
                    anomaly_scores[
                        position
                    ]
                ),
                prediction=int(
                    predictions[
                        position
                    ]
                ),
            )
        )

        pending_scores.append(
            anomaly
        )

    db.add_all(
        pending_scores
    )

    db.flush()

    stored_scores = list(
        db.scalars(
            select(
                AnomalyScore
            )
            .where(
                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,
            )
        ).all()
    )

    threshold_hits = sum(
        1
        for score
        in stored_scores
        if bool(
            score.explanation.get(
                "alert_threshold_reached",
                False,
            )
        )
    )

    risk_counts = {
        "NORMAL": 0,
        "LOW": 0,
        "MEDIUM": 0,
        "HIGH": 0,
        "CRITICAL": 0,
    }

    for score in stored_scores:
        if (
            score.risk_level
            in risk_counts
        ):
            risk_counts[
                score.risk_level
            ] += 1

    return MLScoringSummary(
        available_events=len(
            dataframe
        ),

        new_scores=len(
            pending_scores
        ),

        existing_scores=(
            skipped
        ),

        threshold_hits=(
            threshold_hits
        ),

        risk_counts=(
            risk_counts
        ),
    )