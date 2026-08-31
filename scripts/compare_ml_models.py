"""
Compare SENTINEL Isolation Forest experiments.

Both V1 and V2 are evaluated against the same hidden simulator
ground truth.

The comparison output is persisted as a machine-readable evaluation
artifact. The final evaluation registry is rebuilt automatically when
all evaluation components are available.
"""

from pathlib import Path
import sys

import pandas as pd

from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
)


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)


# --------------------------------------------------------
# Ensure SENTINEL project packages are importable when
# running this file directly with:
#
#     python scripts/compare_ml_models.py
#
# The application package may live inside a backend/
# directory, while ml_engine lives at the project root.
# --------------------------------------------------------

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(
        0,
        str(PROJECT_ROOT),
    )


APP_PACKAGE = (
    PROJECT_ROOT
    / "backend"
)


if (
    APP_PACKAGE.exists()
    and
    str(APP_PACKAGE) not in sys.path
):
    sys.path.insert(
        0,
        str(APP_PACKAGE),
    )


from ml_engine.evaluation.registry import (  # noqa: E402
    MODEL_COMPARISON_RESULT_PATH,
    try_build_evaluation_registry,
    write_evaluation_component,
)

from ml_engine.features import (  # noqa: E402
    V1_FEATURE_COLUMNS,
    V2_FEATURE_COLUMNS,
)


PROCESSED_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "data"
    / "processed"
)


EXPERIMENTS = [
    {
        "name":
            "V1",

        "version":
            "1.0-experiment",

        "feature_count":
            len(
                V1_FEATURE_COLUMNS
            ),

        "path":
            (
                PROCESSED_DIRECTORY
                / "isolation_forest_v1_evaluation.csv"
            ),
    },

    {
        "name":
            "V2",

        "version":
            "2.0-experiment",

        "feature_count":
            len(
                V2_FEATURE_COLUMNS
            ),

        "path":
            (
                PROCESSED_DIRECTORY
                / "isolation_forest_v2_evaluation.csv"
            ),
    },
]


def evaluate_experiment(
    experiment: dict,
) -> dict:
    path = experiment[
        "path"
    ]

    if not path.exists():
        raise RuntimeError(
            "Experiment evaluation file was not found: "
            f"{path}"
        )

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

    precision = precision_score(
        y_true,
        y_pred,
        zero_division=0,
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

    false_positives = int(
        (
            (y_true == 0)
            &
            (y_pred == 1)
        ).sum()
    )

    true_negatives = int(
        (
            (y_true == 0)
            &
            (y_pred == 0)
        ).sum()
    )

    false_positive_rate = (
        false_positives
        / (
            false_positives
            + true_negatives
        )
        if (
            false_positives
            + true_negatives
        )
        else 0.0
    )

    alerts = int(
        y_pred.sum()
    )

    return {
        "name":
            experiment[
                "name"
            ],

        "version":
            experiment[
                "version"
            ],

        "feature_count":
            experiment[
                "feature_count"
            ],

        "precision":
            float(
                precision
            ),

        "recall":
            float(
                recall
            ),

        "f1_score":
            float(
                f1
            ),

        "false_positive_rate":
            float(
                false_positive_rate
            ),

        "false_positives":
            false_positives,

        "alerts":
            alerts,
    }


def compare_models() -> None:
    results = [
        evaluate_experiment(
            experiment
        )
        for experiment
        in EXPERIMENTS
    ]

    # --------------------------------------------------------
    # Select the strongest experiment objectively.
    #
    # Priority:
    # 1. higher F1
    # 2. higher precision
    # 3. fewer features
    # --------------------------------------------------------

    selected_result = max(
        results,
        key=lambda result: (
            result[
                "f1_score"
            ],
            result[
                "precision"
            ],
            -result[
                "feature_count"
            ],
        ),
    )


    for result in results:
        result[
            "selected"
        ] = (
            result[
                "name"
            ]
            == selected_result[
                "name"
            ]
        )


    selected_name = (
        selected_result[
            "name"
        ]
    )


    for result in results:
        if (
            result[
                "selected"
            ]
        ):
            result[
                "decision"
            ] = (
                "Selected because it achieved the strongest "
                "evaluation F1 and precision while preserving "
                "a compact feature set."
            )

        else:
            result[
                "decision"
            ] = (
                "Rejected because additional features did not "
                f"outperform {selected_name} on the selected "
                "evaluation criteria."
            )


    write_evaluation_component(
        MODEL_COMPARISON_RESULT_PATH,
        {
            "experiments":
                results,
        },
    )


    registry_updated, missing_registry_parts = (
        try_build_evaluation_registry()
    )


    print()
    print(
        "SENTINEL ML EXPERIMENT COMPARISON"
    )

    print("=" * 98)

    print(
        f"{'Model':<12}"
        f"{'Features':>10}"
        f"{'Precision':>12}"
        f"{'Recall':>12}"
        f"{'F1':>12}"
        f"{'FPR':>12}"
        f"{'Alerts':>10}"
        f"{'False +':>10}"
    )

    print("-" * 98)


    for result in results:
        model_label = (
            result[
                "name"
            ]
            + (
                " *"
                if result[
                    "selected"
                ]
                else ""
            )
        )

        print(
            f"{model_label:<12}"
            f"{result['feature_count']:>10}"
            f"{result['precision']:>12.3f}"
            f"{result['recall']:>12.3f}"
            f"{result['f1_score']:>12.3f}"
            f"{result['false_positive_rate']:>12.3%}"
            f"{result['alerts']:>10}"
            f"{result['false_positives']:>10}"
        )


    print("=" * 98)

    print(
        "* selected experiment"
    )

    print(
        "Evaluation result       : "
        f"{MODEL_COMPARISON_RESULT_PATH}"
    )


    if registry_updated:
        print(
            "Evaluation registry    : rebuilt"
        )

    else:
        print(
            "Evaluation registry    : waiting for "
            + ", ".join(
                missing_registry_parts
            )
        )


if __name__ == "__main__":
    compare_models()