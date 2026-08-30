"""
Compare SENTINEL Isolation Forest experiments.

This script evaluates V1 and V2 against the same hidden simulator
ground truth so feature-engineering improvements can be measured
objectively.
"""

from pathlib import Path

import pandas as pd

from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
)


PROJECT_ROOT = (
    Path(__file__).resolve().parents[1]
)


PROCESSED_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "data"
    / "processed"
)


EXPERIMENTS = {
    "Isolation Forest V1": (
        PROCESSED_DIRECTORY
        / "isolation_forest_v1_evaluation.csv"
    ),

    "Isolation Forest V2": (
        PROCESSED_DIRECTORY
        / "isolation_forest_v2_evaluation.csv"
    ),
}


def compare_models() -> None:
    print()
    print(
        "SENTINEL ML EXPERIMENT COMPARISON"
    )

    print("=" * 82)

    print(
        f"{'Model':<24}"
        f"{'Precision':>12}"
        f"{'Recall':>12}"
        f"{'F1':>12}"
        f"{'Alerts':>12}"
        f"{'False +':>10}"
    )

    print("-" * 82)

    for (
        model_name,
        path,
    ) in EXPERIMENTS.items():

        if not path.exists():
            print(
                f"{model_name:<24}"
                "evaluation file missing"
            )

            continue

        dataframe = pd.read_csv(
            path
        )

        y_true = (
            dataframe[
                "is_injected_anomaly"
            ]
            .astype(int)
        )

        y_pred = (
            dataframe[
                "iforest_prediction"
            ]
            .astype(int)
        )

        precision = (
            precision_score(
                y_true,
                y_pred,
                zero_division=0,
            )
        )

        recall = recall_score(
            y_true,
            y_pred,
            zero_division=0,
        )

        f1 = f1_score(
            y_true,
            y_pred,
            zero_division=0,
        )

        alerts = int(
            y_pred.sum()
        )

        false_positives = int(
            (
                (y_true == 0)
                &
                (y_pred == 1)
            ).sum()
        )

        print(
            f"{model_name:<24}"
            f"{precision:>12.3f}"
            f"{recall:>12.3f}"
            f"{f1:>12.3f}"
            f"{alerts:>12}"
            f"{false_positives:>10}"
        )

    print("=" * 82)


if __name__ == "__main__":
    compare_models()