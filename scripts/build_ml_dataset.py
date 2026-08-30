"""
Build SENTINEL's Phase 4 machine-learning dataset.

The script reads security events from PostgreSQL, creates behavioral and
rolling-window features, validates the resulting feature matrix, and writes
a local processed CSV for ML experimentation.

Ground-truth attack labels remain evaluation metadata only.
"""

from pathlib import Path
import sys

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

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
from ml_engine.features import (
    EventFeatureBuilder,
    V2_FEATURE_COLUMNS,
)

DATASET_FEATURE_COLUMNS = (
    V2_FEATURE_COLUMNS
)


OUTPUT_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "data"
    / "processed"
)

OUTPUT_PATH = (
    OUTPUT_DIRECTORY
    / "sentinel_event_features.csv"
)


def build_ml_dataset() -> None:
    db = SessionLocal()

    try:
        builder = EventFeatureBuilder(
            db=db,
        )

        dataframe = (
            builder.build_dataframe()
        )

        if dataframe.empty:
            raise RuntimeError(
                "No events were available for feature generation."
            )

        missing_features = [
            column
            for column in DATASET_FEATURE_COLUMNS
            if column not in dataframe.columns
        ]

        if missing_features:
            raise RuntimeError(
                "Missing ML feature columns: "
                + ", ".join(
                    missing_features
                )
            )

        feature_matrix = (
            dataframe[
                DATASET_FEATURE_COLUMNS
            ]
        )

        null_values = int(
            feature_matrix
            .isnull()
            .sum()
            .sum()
        )

        if null_values:
            raise RuntimeError(
                f"Feature matrix contains "
                f"{null_values} null values."
            )

        OUTPUT_DIRECTORY.mkdir(
            parents=True,
            exist_ok=True,
        )

        dataframe.to_csv(
            OUTPUT_PATH,
            index=False,
        )

        injected_count = int(
            dataframe[
                "is_injected_anomaly"
            ].sum()
        )

        normal_count = (
            len(dataframe)
            - injected_count
        )

        print()
        print(
            "SENTINEL ML dataset built successfully."
        )

        print("=" * 66)

        print(
            f"Rows                 : "
            f"{len(dataframe):,}"
        )

        print(
            f"ML feature columns   : "
            f"{len(DATASET_FEATURE_COLUMNS)}"
        )

        print(
            f"Normal rows          : "
            f"{normal_count:,}"
        )

        print(
            f"Injected rows        : "
            f"{injected_count:,}"
        )

        print(
            f"Null feature values  : "
            f"{null_values}"
        )

        print()
        print("Feature Columns")
        print("-" * 66)

        for feature in FEATURE_COLUMNS:
            print(
                f"  - {feature}"
            )

        print()
        print(
            f"Dataset written to:"
        )

        print(
            f"  {OUTPUT_PATH}"
        )

        print("=" * 66)

    finally:
        db.close()


if __name__ == "__main__":
    build_ml_dataset()