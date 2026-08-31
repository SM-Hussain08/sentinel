"""
Score all SENTINEL events using the selected Isolation Forest model.

Pipeline
--------
PostgreSQL events
    -> behavioral feature engineering
    -> selected Isolation Forest V1.1
    -> anomaly percentile
    -> risk classification
    -> anomaly_scores table

The simulator's hidden attack labels are NEVER provided to the model.
"""

from pathlib import Path
import sys

import numpy as np
from sqlalchemy import select


PROJECT_ROOT = (
    Path(__file__).resolve().parents[1]
)

BACKEND_ROOT = (
    PROJECT_ROOT / "backend"
)


for path in (
    PROJECT_ROOT,
    BACKEND_ROOT,
):
    path_string = str(path)

    if path_string not in sys.path:
        sys.path.insert(
            0,
            path_string,
        )


from app.database.session import SessionLocal  # noqa: E402

from app.models import (  # noqa: E402
    AnomalyScore,
    Event,
)

from ml_engine.evaluation import (  # noqa: E402
    classify_ml_risk,
)

from ml_engine.features import (  # noqa: E402
    EventFeatureBuilder,
)

from ml_engine.models import (  # noqa: E402
    SentinelIsolationForest,
)

from app.selected_detector import (  # noqa: E402
    SELECTED_DETECTOR,
    SELECTED_MODEL_PATH,
)

MODEL_PATH = (
    SELECTED_MODEL_PATH
)


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


def score_events() -> None:
    if not MODEL_PATH.exists():
        raise RuntimeError(
            "Selected model artifact was not found. "
            "Run train_selected_model.py first."
        )

    db = SessionLocal()

    try:
        detector = (
            SentinelIsolationForest.load(
                MODEL_PATH
            )
        )

        print()
        print(
            "Loaded SENTINEL selected model:"
        )

        print(
            f"  {detector.model_name} "
            f"v{detector.model_version}"
        )

        print(
            f"  Features: "
            f"{len(detector.feature_columns)}"
        )

        # -------------------------------------------------
        # Build features
        # -------------------------------------------------

        builder = EventFeatureBuilder(
            db=db,
        )

        dataframe = (
            builder.build_dataframe()
        )

        if dataframe.empty:
            raise RuntimeError(
                "No events were available "
                "for ML scoring."
            )

        # -------------------------------------------------
        # Score all rows
        # -------------------------------------------------

        raw_scores = (
            detector.raw_anomaly_scores(
                dataframe
            )
        )

        anomaly_scores = (
            detector.normalized_scores(
                dataframe
            )
        )

        predictions = (
            detector.predict(
                dataframe
            )
        )

        # -------------------------------------------------
        # Map public event ID -> database UUID
        # -------------------------------------------------

        event_rows = db.execute(
            select(
                Event.id,
                Event.event_id,
            )
        ).all()

        event_uuid_map = {
            event_id: event_uuid
            for event_uuid, event_id
            in event_rows
        }

        # -------------------------------------------------
        # Find rows already scored by this exact model
        # -------------------------------------------------

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

        inserted = 0
        skipped = 0
        flagged = 0

        risk_counts = {
            "NORMAL": 0,
            "LOW": 0,
            "MEDIUM": 0,
            "HIGH": 0,
            "CRITICAL": 0,
        }

        pending_scores: list[
            AnomalyScore
        ] = []

        for position, (
            _,
            row,
        ) in enumerate(
            dataframe.iterrows()
        ):
            event_id = row[
                "event_id"
            ]

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

            if event_uuid is None:
                raise RuntimeError(
                    f"Database event was not found "
                    f"for {event_id}."
                )

            raw_score = float(
                raw_scores[
                    position
                ]
            )

            anomaly_score = float(
                anomaly_scores[
                    position
                ]
            )

            prediction = int(
                predictions[
                    position
                ]
            )

            risk_level = (
                classify_ml_risk(
                    anomaly_score
                )
            )

            risk_counts[
                risk_level
            ] += 1

            if prediction == 1:
                flagged += 1

            feature_snapshot = {
                feature: python_value(
                    row[
                        feature
                    ]
                )
                for feature
                in detector.feature_columns
            }

            anomaly = AnomalyScore(
                event_uuid=event_uuid,

                detector_name=(
                    SELECTED_DETECTOR.name
                ),

                detector_version=(
                    SELECTED_DETECTOR.version
                ),

                detector_type=(
                    SELECTED_DETECTOR.detector_type
                ),

                raw_score=raw_score,

                anomaly_score=(
                    anomaly_score
                ),

                risk_level=risk_level,

                feature_snapshot=(
                    feature_snapshot
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

            pending_scores.append(
                anomaly
            )

            inserted += 1

        # -------------------------------------------------
        # Persist in one transaction
        # -------------------------------------------------

        db.add_all(
            pending_scores
        )

        db.commit()

        # -------------------------------------------------
        # Read the complete persisted model-score summary
        # -------------------------------------------------

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

        stored_flagged = sum(
            1
            for score in stored_scores
            if bool(
                score.explanation.get(
                    "alert_threshold_reached",
                    False,
                )
            )
        )

        stored_risk_counts = {
            "NORMAL": 0,
            "LOW": 0,
            "MEDIUM": 0,
            "HIGH": 0,
            "CRITICAL": 0,
        }

        for score in stored_scores:
            if (
                score.risk_level
                in stored_risk_counts
            ):
                stored_risk_counts[
                    score.risk_level
                ] += 1

        print()
        print(
            "SENTINEL ML database scoring complete."
        )

        print("=" * 68)

        print(
            f"Events available       : "
            f"{len(dataframe):,}"
        )

        print(
            f"New ML scores          : "
            f"{inserted:,}"
        )

        print(
            f"Existing ML scores     : "
            f"{skipped:,}"
        )

        print(
            f"Alert threshold hits   : "
            f"{stored_flagged:,}"
        )

        print()
        print(
            "Risk Distribution"
        )

        print("-" * 68)

        for risk_level in [
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW",
            "NORMAL",
        ]:
            print(
                f"{risk_level:<16}"
                f"{stored_risk_counts[risk_level]:>8}"
            )

        print("=" * 68)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    score_events()