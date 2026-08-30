"""
Train SENTINEL's selected production anomaly detector.

Selected model:
    Isolation Forest V1.1

V1.1 intentionally preserves the successful V1 behavioral feature set
and preprocessing while adding explicit model schema/version metadata.

Training:
    2026-08-24 normal activity

Evaluation:
    2026-08-25 through 2026-08-26
"""

import json
from datetime import datetime, timezone
from pathlib import Path
import sys

import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


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


from ml_engine.features import (  # noqa: E402
    V1_FEATURE_COLUMNS,
)

from ml_engine.models import (  # noqa: E402
    SentinelIsolationForest,
)

from ml_engine.preprocessing import (  # noqa: E402
    V1_LOG_TRANSFORM_COLUMNS,
    parse_event_timestamps,
)


DATASET_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "data"
    / "processed"
    / "sentinel_event_features.csv"
)


MODEL_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "models"
    / "artifacts"
    / "sentinel_iforest_v1_1.joblib"
)


MANIFEST_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "models"
    / "artifacts"
    / "sentinel_iforest_v1_1_manifest.json"
)


EVALUATION_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "data"
    / "processed"
    / "sentinel_iforest_v1_1_evaluation.csv"
)


TRAIN_DATE = pd.Timestamp(
    "2026-08-24",
    tz="UTC",
)


TEST_START = pd.Timestamp(
    "2026-08-25",
    tz="UTC",
)


TEST_END = pd.Timestamp(
    "2026-08-27",
    tz="UTC",
)


def train_selected_model() -> None:
    dataframe = pd.read_csv(
        DATASET_PATH
    )

    dataframe = (
        parse_event_timestamps(
            dataframe
        )
    )

    training_dataframe = dataframe[
        (
            dataframe[
                "event_timestamp"
            ].dt.normalize()
            == TRAIN_DATE
        )
        &
        (
            dataframe[
                "is_injected_anomaly"
            ] == 0
        )
    ].copy()

    evaluation_dataframe = dataframe[
        (
            dataframe[
                "event_timestamp"
            ]
            >= TEST_START
        )
        &
        (
            dataframe[
                "event_timestamp"
            ]
            < TEST_END
        )
    ].copy()

    detector = SentinelIsolationForest(
        model_version="1.1",
        feature_columns=(
            V1_FEATURE_COLUMNS
        ),
        log_transform_columns=(
            V1_LOG_TRANSFORM_COLUMNS
        ),
        n_estimators=300,
        threshold_percentile=0.99,
        random_state=42,
    )

    detector.fit(
        training_dataframe
    )

    raw_scores = (
        detector.raw_anomaly_scores(
            evaluation_dataframe
        )
    )

    anomaly_scores = (
        detector.normalized_scores(
            evaluation_dataframe
        )
    )

    predictions = (
        detector.predict(
            evaluation_dataframe
        )
    )

    y_true = (
        evaluation_dataframe[
            "is_injected_anomaly"
        ]
        .astype(int)
        .to_numpy()
    )

    tn, fp, fn, tp = (
        confusion_matrix(
            y_true,
            predictions,
            labels=[
                0,
                1,
            ],
        ).ravel()
    )

    precision = precision_score(
        y_true,
        predictions,
        zero_division=0,
    )

    recall = recall_score(
        y_true,
        predictions,
        zero_division=0,
    )

    f1 = f1_score(
        y_true,
        predictions,
        zero_division=0,
    )

    false_positive_rate = (
        fp / (fp + tn)
        if (fp + tn)
        else 0.0
    )

    evaluation_output = (
        evaluation_dataframe.copy()
    )

    evaluation_output[
        "iforest_raw_score"
    ] = raw_scores

    evaluation_output[
        "iforest_anomaly_score"
    ] = anomaly_scores

    evaluation_output[
        "iforest_prediction"
    ] = predictions

    evaluation_output.to_csv(
        EVALUATION_PATH,
        index=False,
    )

    detector.save(
        MODEL_PATH
    )

    manifest = {
        "model_name": (
            detector.model_name
        ),

        "model_version": (
            detector.model_version
        ),

        "algorithm": (
            "IsolationForest"
        ),

        "feature_count": len(
            detector.feature_columns
        ),

        "feature_columns": (
            detector.feature_columns
        ),

        "log_transform_columns": (
            detector.log_transform_columns
        ),

        "training_period": (
            "2026-08-24"
        ),

        "evaluation_period": (
            "2026-08-25 through "
            "2026-08-26"
        ),

        "training_rows": len(
            training_dataframe
        ),

        "evaluation_rows": len(
            evaluation_dataframe
        ),

        "n_estimators": (
            detector.n_estimators
        ),

        "threshold_percentile": (
            detector.threshold_percentile
        ),

        "random_state": (
            detector.random_state
        ),

        "metrics": {
            "true_positives": int(tp),
            "false_positives": int(fp),
            "true_negatives": int(tn),
            "false_negatives": int(fn),

            "precision": float(
                precision
            ),

            "recall": float(
                recall
            ),

            "f1_score": float(
                f1
            ),

            "false_positive_rate": float(
                false_positive_rate
            ),
        },

        "created_at": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),
    }

    MANIFEST_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    MANIFEST_PATH.write_text(
        json.dumps(
            manifest,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(
        "SENTINEL SELECTED MODEL"
    )

    print("=" * 68)

    print(
        "Model                  : "
        "Isolation Forest"
    )

    print(
        "Version                : "
        "1.1"
    )

    print(
        f"Features               : "
        f"{len(V1_FEATURE_COLUMNS)}"
    )

    print(
        f"Training rows          : "
        f"{len(training_dataframe):,}"
    )

    print(
        f"Evaluation rows        : "
        f"{len(evaluation_dataframe):,}"
    )

    print()

    print(
        f"True Positives         : "
        f"{tp}"
    )

    print(
        f"False Positives        : "
        f"{fp}"
    )

    print(
        f"True Negatives         : "
        f"{tn}"
    )

    print(
        f"False Negatives        : "
        f"{fn}"
    )

    print()

    print(
        f"Precision              : "
        f"{precision:.3f}"
    )

    print(
        f"Recall                 : "
        f"{recall:.3f}"
    )

    print(
        f"F1 Score               : "
        f"{f1:.3f}"
    )

    print(
        f"False Positive Rate    : "
        f"{false_positive_rate:.3%}"
    )

    print()

    print(
        f"Model artifact         : "
        f"{MODEL_PATH}"
    )

    print(
        f"Model manifest         : "
        f"{MANIFEST_PATH}"
    )

    print("=" * 68)


if __name__ == "__main__":
    train_selected_model()