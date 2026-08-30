"""
Train and evaluate SENTINEL Isolation Forest v1.

Experiment design
-----------------
Training:
    August 24, 2026
    Historical normal activity only.

Evaluation:
    August 25-26, 2026
    Future normal activity mixed with controlled attack scenarios.

The simulator's hidden labels are NEVER provided to model.fit().
They are used only after prediction for evaluation metrics.
"""

from pathlib import Path
import sys

import numpy as np
import pandas as pd

from sklearn.metrics import (
    confusion_matrix,
    precision_score,
    recall_score,
    f1_score,
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


from ml_engine.models import (  # noqa: E402
    SentinelIsolationForest,
)

from ml_engine.preprocessing import (  # noqa: E402
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
    / "isolation_forest_v2.joblib"
)


EVALUATION_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "data"
    / "processed"
    / "isolation_forest_v2_evaluation.csv"
)


TRAIN_DATE = pd.Timestamp(
    "2026-08-24",
    tz="UTC",
)


TEST_START_DATE = pd.Timestamp(
    "2026-08-25",
    tz="UTC",
)


TEST_END_DATE = pd.Timestamp(
    "2026-08-27",
    tz="UTC",
)


def train_and_evaluate() -> None:
    if not DATASET_PATH.exists():
        raise RuntimeError(
            "ML dataset was not found. "
            "Run build_ml_dataset.py first."
        )

    dataframe = pd.read_csv(
        DATASET_PATH
    )

    dataframe = (
        parse_event_timestamps(
            dataframe
        )
    )

    # -----------------------------------------------------
    # Chronological split
    # -----------------------------------------------------

    training_mask = (
        dataframe[
            "event_timestamp"
        ].dt.normalize()
        == TRAIN_DATE
    )

    training_dataframe = (
        dataframe[
            training_mask
        ].copy()
    )

    # Extra protection:
    # training data must contain only known-normal simulator history.
    training_dataframe = (
        training_dataframe[
            training_dataframe[
                "is_injected_anomaly"
            ] == 0
        ].copy()
    )

    test_mask = (
        (
            dataframe[
                "event_timestamp"
            ]
            >= TEST_START_DATE
        )
        &
        (
            dataframe[
                "event_timestamp"
            ]
            < TEST_END_DATE
        )
    )

    test_dataframe = (
        dataframe[
            test_mask
        ].copy()
    )

    if training_dataframe.empty:
        raise RuntimeError(
            "Training dataset is empty."
        )

    if test_dataframe.empty:
        raise RuntimeError(
            "Evaluation dataset is empty."
        )

    # -----------------------------------------------------
    # Train
    # -----------------------------------------------------

    detector = (
        SentinelIsolationForest(
            n_estimators=300,
            threshold_percentile=0.99,
            random_state=42,
        )
    )

    detector.fit(
        training_dataframe
    )

    # -----------------------------------------------------
    # Score
    # -----------------------------------------------------

    raw_scores = (
        detector.raw_anomaly_scores(
            test_dataframe
        )
    )

    normalized_scores = (
        detector.normalized_scores(
            test_dataframe
        )
    )

    predictions = (
        detector.predict(
            test_dataframe
        )
    )

    y_true = (
        test_dataframe[
            "is_injected_anomaly"
        ]
        .astype(int)
        .to_numpy()
    )

    # -----------------------------------------------------
    # Metrics
    # -----------------------------------------------------

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

    normal_test_count = (
        tn + fp
    )

    false_positive_rate = (
        fp / normal_test_count
        if normal_test_count
        else 0.0
    )

    # -----------------------------------------------------
    # Save scored evaluation rows
    # -----------------------------------------------------

    evaluation = (
        test_dataframe.copy()
    )

    evaluation[
        "iforest_raw_score"
    ] = raw_scores

    evaluation[
        "iforest_anomaly_score"
    ] = normalized_scores

    evaluation[
        "iforest_prediction"
    ] = predictions

    evaluation.to_csv(
        EVALUATION_PATH,
        index=False,
    )

    detector.save(
        MODEL_PATH
    )

    # -----------------------------------------------------
    # Console report
    # -----------------------------------------------------

    print()
    print(
        "SENTINEL ISOLATION FOREST V2"
    )

    print("=" * 68)

    print()
    print("Experiment Design")
    print("-" * 68)

    print(
        f"Training rows          : "
        f"{len(training_dataframe):,}"
    )

    print(
        "Training period        : "
        "2026-08-24"
    )

    print(
        f"Evaluation rows        : "
        f"{len(test_dataframe):,}"
    )

    print(
        "Evaluation period      : "
        "2026-08-25 → 2026-08-26"
    )

    print(
        f"Injected test events   : "
        f"{int(y_true.sum()):,}"
    )

    print()
    print("Model Configuration")
    print("-" * 68)

    print(
        "Algorithm              : "
        "Isolation Forest"
    )

    print(
        "Trees                  : "
        "300"
    )

    print(
        "Training contamination : "
        "auto"
    )

    print(
        "Random state           : "
        "42"
    )

    print(
        "Alert threshold        : "
        "99th historical percentile"
    )

    print()
    print("Evaluation Metrics")
    print("-" * 68)

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

    # -----------------------------------------------------
    # Per-scenario detection
    # -----------------------------------------------------

    print()
    print(
        "Detection by Attack Scenario"
    )

    print("-" * 68)

    attack_evaluation = (
        evaluation[
            evaluation[
                "is_injected_anomaly"
            ] == 1
        ]
    )

    for (
        scenario,
        group,
    ) in attack_evaluation.groupby(
        "scenario_type"
    ):
        detected = int(
            group[
                "iforest_prediction"
            ].sum()
        )

        total = len(
            group
        )

        detection_rate = (
            detected / total
            if total
            else 0.0
        )

        print(
            f"{scenario:<24}"
            f"{detected:>3}"
            f"/"
            f"{total:<3}"
            f" "
            f"({detection_rate:>6.1%})"
        )

    # -----------------------------------------------------
    # Highest-scoring events
    # -----------------------------------------------------

    print()
    print(
        "Top Anomalous Evaluation Events"
    )

    print("-" * 68)

    top_events = (
        evaluation
        .sort_values(
            "iforest_anomaly_score",
            ascending=False,
        )
        .head(12)
    )

    for _, row in (
        top_events.iterrows()
    ):
        scenario = (
            row[
                "scenario_type"
            ]
            if pd.notna(
                row[
                    "scenario_type"
                ]
            )
            else "NORMAL"
        )

        print(
            f"{row['event_id']:<18} "
            f"{row['event_type']:<20} "
            f"score="
            f"{row['iforest_anomaly_score']:.3f} "
            f"{scenario}"
        )

    print()
    print("Artifacts")
    print("-" * 68)

    print(
        f"Model      : "
        f"{MODEL_PATH}"
    )

    print(
        f"Evaluation : "
        f"{EVALUATION_PATH}"
    )

    print("=" * 68)


if __name__ == "__main__":
    train_and_evaluate()