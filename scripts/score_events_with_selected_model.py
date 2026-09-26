"""
Batch/offline scoring entry point for SENTINEL event backfill and controlled
benchmarking.

This is a thin command-line wrapper around the canonical scoring service:

    app.services.ml_scoring.score_unscored_events

It scores persisted Events using the selected Isolation Forest detector,
performs behavioral feature engineering, computes anomaly percentiles and
risk classifications, and writes AnomalyScore rows.

The shared scoring service ensures that batch/backfill and future live
simulation workflows use the same operational ML implementation.

This script is NOT the normal live processing path.

Normal operational Events are processed automatically by the always-on
event processor:

    Event
        -> feature engineering
        -> selected Isolation Forest detector
        -> AnomalyScore
        -> incremental incident correlation
        -> deterministic investigation

For controlled benchmarks, the benchmark harness uses this entry point to
score persisted Events reproducibly while keeping benchmark scoring isolated
from the operational processing path.

Simulator/benchmark ground-truth labels are never supplied to operational
ML scoring.
"""

from __future__ import annotations

from pathlib import Path
import sys


# ------------------------------------------------------------
# Repository import bootstrap
# ------------------------------------------------------------
#
# Support direct execution:
#
#     python scripts/score_events_with_selected_model.py
#
# When Python executes a file inside scripts/, only that directory is
# automatically placed on sys.path. Add the repository root first so the
# shared scripts package and backend application can be imported reliably.
# ------------------------------------------------------------

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

project_root_string = str(
    PROJECT_ROOT
)

if (
    project_root_string
    not in sys.path
):
    sys.path.insert(
        0,
        project_root_string,
    )


import scripts._bootstrap  # noqa: E402,F401

from ml_engine.models import SentinelIsolationForest  # noqa: E402

from app.database.session import SessionLocal  # noqa: E402

from app.services.ml_scoring import (  # noqa: E402
    get_selected_model,
    score_unscored_events,
)


def score_events(
    *,
    detector: SentinelIsolationForest | None = None,
) -> None:
    """
    Score all Events that do not yet have a score for the supplied detector.

    When no detector is supplied, load SENTINEL's canonical promoted
    production detector. Controlled benchmarks may explicitly provide
    an isolated candidate detector without changing operational scoring.
    """

    db = SessionLocal()

    try:
        if detector is None:
            detector = (
                get_selected_model()
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

        summary = (
            score_unscored_events(
                db=db,
                detector=detector,
            )
        )

        db.commit()

        print()
        print(
            "SENTINEL ML database scoring complete."
        )

        print(
            "=" * 68
        )

        print(
            f"Events available       : "
            f"{summary.available_events:,}"
        )

        print(
            f"New ML scores          : "
            f"{summary.new_scores:,}"
        )

        print(
            f"Existing ML scores     : "
            f"{summary.existing_scores:,}"
        )

        print(
            f"Alert threshold hits   : "
            f"{summary.threshold_hits:,}"
        )

        print()

        print(
            "Risk Distribution"
        )

        print(
            "-" * 68
        )

        for risk_level in [
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW",
            "NORMAL",
        ]:
            print(
                f"{risk_level:<16}"
                f"{summary.risk_counts[risk_level]:>8}"
            )

        print(
            "=" * 68
        )

        print(
            "Detector               : "
            f"{detector.model_name} "
            f"v{detector.model_version}"
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    score_events()