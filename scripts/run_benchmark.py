"""
SENTINEL reproducible benchmark orchestrator.

This script coordinates the complete controlled evaluation workflow:

1. reset the isolated benchmark database
2. generate deterministic employee population
3. generate deterministic normal activity
4. inject deterministic attack scenarios
5. validate the synthetic dataset
6. build the ML feature dataset
7. train/evaluate Isolation Forest V1
8. train/evaluate Isolation Forest V2
9. compare experiments objectively
10. train the selected production-compatible model
11. score events with the selected model
12. generate correlated incidents
13. evaluate incident recovery
14. build the canonical evaluation registry
15. verify canonical benchmark results
16. write benchmark_report.json

SAFETY
------
The benchmark must never run against SENTINEL's normal operational database.

Set:

    SENTINEL_BENCHMARK_MODE=true

and provide a dedicated benchmark DATABASE_URL whose database name contains
the word "benchmark".

Example:

    postgresql+psycopg://sentinel:password@localhost:5433/sentinel_benchmark
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import sys
import time
from urllib.parse import urlparse

from sqlalchemy import (
    create_engine,
    func,
    inspect,
    select,
    text,
)


# ============================================================
# Import bootstrap
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

BACKEND_ROOT = (
    PROJECT_ROOT
    / "backend"
)

for path in (
    PROJECT_ROOT,
    BACKEND_ROOT,
):
    path_string = str(
        path
    )

    if (
        path_string
        not in sys.path
    ):
        sys.path.insert(
            0,
            path_string,
        )


# ============================================================
# SENTINEL imports
# ============================================================

from app.config import settings  # noqa: E402

from app.models import (  # noqa: E402
    AnomalyScore,
    Employee,
    Event,
    Incident,
    SimulationGroundTruth,
    SimulationRun,
)

from app.services.evaluation_ground_truth import (
    count_injected_events,
)


from app.database.session import (  # noqa: E402
    SessionLocal,
)

from ml_engine.evaluation.registry import (  # noqa: E402
    EVALUATION_REGISTRY_PATH,
)

from scripts.generate_company import (  # noqa: E402
    generate_company,
)

from scripts.generate_normal_activity import (  # noqa: E402
    generate_normal_activity,
)

from scripts.inject_attack_scenarios import (  # noqa: E402
    inject_attack_scenarios,
)

from scripts.validate_simulation import (  # noqa: E402
    validate_simulation,
)

from scripts.build_ml_dataset import (  # noqa: E402
    build_ml_dataset,
)

from scripts.train_isolation_forest import (  # noqa: E402
    train_and_evaluate
    as train_v1,
)

from scripts.train_isolation_forest_v2 import (  # noqa: E402
    train_and_evaluate
    as train_v2,
)

from scripts.compare_ml_models import (  # noqa: E402
    compare_models,
)

from ml_engine.models import (  # noqa: E402
    SentinelIsolationForest,
)

from scripts.train_selected_model import (  # noqa: E402
    train_selected_model,
)

from scripts.score_events_with_selected_model import (  # noqa: E402
    score_events,
)

from scripts.generate_incidents import (  # noqa: E402
    generate_incidents,
)

from scripts.evaluate_incidents import (  # noqa: E402
    evaluate_incidents,
)

from scripts.build_evaluation_registry import (  # noqa: E402
    main
    as build_evaluation_registry,
)


# ============================================================
# Canonical benchmark expectations
# ============================================================

BENCHMARK_SEED = 42

EXPECTED_EMPLOYEES = 100

EXPECTED_NORMAL_EVENTS = 5814

EXPECTED_ATTACK_EVENTS = 89

EXPECTED_BENCHMARK_BATCH_ID = (
    "phase3_attack_batch_01"
)

EXPECTED_SIMULATION_RUNS = 0

EXPECTED_TOTAL_EVENTS = 5903

EXPECTED_ATTACK_INSTANCES = 5

EXPECTED_SELECTED_EXPERIMENT = (
    "V1"
)

EXPECTED_SELECTED_MODEL_NAME = (
    "isolation-forest"
)

EXPECTED_SELECTED_MODEL_VERSION = (
    "1.2"
)

EXPECTED_FEATURE_COUNT = 17

EXPECTED_TRAINING_ROWS = 1952

EXPECTED_EVALUATION_ROWS = 3951

EXPECTED_MODEL_PRECISION = (
    0.6614173228346457
)

EXPECTED_MODEL_RECALL = (
    0.9438202247191011
)

EXPECTED_MODEL_F1 = (
    0.7777777777777778
)

EXPECTED_MODEL_FPR = (
    0.011134127395132056
)

EXPECTED_RISK_DISTRIBUTION = {
    "CRITICAL": 147,
    "HIGH": 51,
    "MEDIUM": 179,
    "LOW": 267,
    "NORMAL": 5259,
}

EXPECTED_INCIDENTS = 11

EXPECTED_INCIDENT_PRECISION = (
    0.625
)

EXPECTED_INCIDENT_RECALL = (
    1.0
)

EXPECTED_INCIDENT_F1 = (
    0.7692307692307693
)

EXPECTED_TIMELINE_RECOVERY = (
    1.0
)


# ============================================================
# Artifact paths
# ============================================================

RESULTS_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "evaluation"
    / "results"
)

PROCESSED_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "data"
    / "processed"
)

ARTIFACT_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "models"
    / "artifacts"
)


CANDIDATE_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "models"
    / "candidates"
)


BENCHMARK_CANDIDATE_MODEL_PATH = (
    CANDIDATE_DIRECTORY
    / "sentinel_iforest_v1_2_candidate.joblib"
)


BENCHMARK_CANDIDATE_MANIFEST_PATH = (
    CANDIDATE_DIRECTORY
    / "sentinel_iforest_v1_2_candidate_manifest.json"
)


MODEL_COMPARISON_PATH = (
    RESULTS_DIRECTORY
    / "model_comparison.json"
)

SELECTED_MODEL_EVALUATION_PATH = (
    RESULTS_DIRECTORY
    / "selected_model_evaluation.json"
)

INCIDENT_EVALUATION_PATH = (
    RESULTS_DIRECTORY
    / "incident_evaluation.json"
)

BENCHMARK_REPORT_PATH = (
    RESULTS_DIRECTORY
    / "benchmark_report.json"
)


# ============================================================
# Helpers
# ============================================================

def train_benchmark_selected_candidate(
) -> None:
    """
    Train the objectively selected detector into an isolated benchmark
    candidate location.

    This must never overwrite SENTINEL's promoted production artifact.
    """

    train_selected_model(
        model_path=(
            BENCHMARK_CANDIDATE_MODEL_PATH
        ),
        manifest_path=(
            BENCHMARK_CANDIDATE_MANIFEST_PATH
        ),
        promotion_status="candidate",
    )


def score_benchmark_events(
) -> None:
    """
    Score benchmark Events with the isolated benchmark candidate.

    Operational scoring continues to use the promoted production model.
    """

    detector = (
        SentinelIsolationForest.load(
            BENCHMARK_CANDIDATE_MODEL_PATH
        )
    )

    score_events(
        detector=detector
    )


def utc_now_iso(
) -> str:
    return (
        datetime.now(
            timezone.utc
        ).isoformat()
    )


def print_heading(
    title: str,
) -> None:
    print()
    print(
        "=" * 78
    )

    print(
        title
    )

    print(
        "=" * 78
    )


def benchmark_mode_enabled(
) -> bool:
    value = (
        os.getenv(
            "SENTINEL_BENCHMARK_MODE",
            "",
        )
        .strip()
        .lower()
    )

    return value in {
        "1",
        "true",
        "yes",
        "on",
    }


def database_name_from_url(
    database_url: str,
) -> str:
    """
    Extract the database name from a SQLAlchemy PostgreSQL URL.
    """

    parsed = urlparse(
        database_url.replace(
            "postgresql+psycopg://",
            "postgresql://",
        )
    )

    return (
        parsed.path
        .lstrip("/")
        .strip()
    )


def verify_benchmark_database_safety(
) -> None:
    """
    Refuse to run unless benchmark mode is explicit and the database name
    clearly identifies a benchmark database.
    """

    if not benchmark_mode_enabled():
        raise RuntimeError(
            "Benchmark safety check failed. "
            "Set SENTINEL_BENCHMARK_MODE=true "
            "before running the controlled benchmark."
        )

    database_url = (
        settings.database_url
    )

    database_name = (
        database_name_from_url(
            database_url
        )
    )

    if not database_name:
        raise RuntimeError(
            "Benchmark database name could not "
            "be determined from DATABASE_URL."
        )

    if (
        database_name.lower()
        == "sentinel"
    ):
        raise RuntimeError(
            "Refusing to run benchmark against "
            "the normal 'sentinel' database."
        )

    if (
        "benchmark"
        not in database_name.lower()
    ):
        raise RuntimeError(
            "Benchmark database name must contain "
            "'benchmark' for safety. "
            f"Current database: {database_name!r}"
        )

    print()
    print(
        "Benchmark database safety check"
    )

    print(
        "-" * 78
    )

    print(
        "Database:",
        database_name,
    )

    print(
        "Benchmark mode:",
        "enabled",
    )

    print(
        "PASS - operational database is isolated."
    )


def run_stage(
    number: int,
    title: str,
    function,
) -> None:
    print_heading(
        f"STAGE {number:02d} - {title}"
    )

    started = (
        time.perf_counter()
    )

    function()

    elapsed = (
        time.perf_counter()
        - started
    )

    print()
    print(
        f"PASS - {title}"
    )

    print(
        f"Elapsed: {elapsed:.2f} seconds"
    )


def load_json(
    path: Path,
) -> dict:
    if not path.exists():
        raise RuntimeError(
            "Expected benchmark artifact "
            f"was not created: {path}"
        )

    try:
        return json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )

    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        raise RuntimeError(
            "Benchmark artifact could not "
            f"be read: {path}"
        ) from exc


def floats_match(
    left: float,
    right: float,
) -> bool:
    return math.isclose(
        left,
        right,
        rel_tol=1e-12,
        abs_tol=1e-12,
    )


# ============================================================
# Benchmark reset
# ============================================================

def reset_benchmark_database(
) -> None:
    """
    Remove all benchmark application data while preserving the schema.

    Alembic owns schema creation/migrations.
    This runner owns only benchmark data.
    """

    print_heading(
        "BENCHMARK RESET"
    )

    engine = create_engine(
        settings.database_url
    )

    try:
        with engine.begin() as connection:
            inspector = inspect(
                connection
            )

            table_names = [
                table_name
                for table_name
                in inspector.get_table_names()
                if table_name
                != "alembic_version"
            ]

            if not table_names:
                print(
                    "No benchmark application "
                    "tables require reset."
                )

                return

            quoted_tables = ", ".join(
                (
                    '"'
                    + table_name.replace(
                        '"',
                        '""',
                    )
                    + '"'
                )
                for table_name
                in table_names
            )

            connection.execute(
                text(
                    "TRUNCATE TABLE "
                    f"{quoted_tables} "
                    "RESTART IDENTITY CASCADE"
                )
            )

        print(
            "Benchmark application tables reset:",
            len(
                table_names
            ),
        )

        print(
            "Alembic schema state preserved."
        )

        print(
            "PASS - benchmark database is clean."
        )

    finally:
        engine.dispose()


def clear_generated_outputs(
) -> None:
    """
    Remove outputs that should be regenerated by the benchmark.

    Historical v1.1 production artifacts are intentionally preserved.
    """

    paths = [
        PROCESSED_DIRECTORY
        / "sentinel_event_features.csv",

        PROCESSED_DIRECTORY
        / "isolation_forest_v1_evaluation.csv",

        PROCESSED_DIRECTORY
        / "isolation_forest_v2_evaluation.csv",

        PROCESSED_DIRECTORY
        / "sentinel_iforest_v1_2_evaluation.csv",

        ARTIFACT_DIRECTORY
        / "isolation_forest_v1.joblib",

        ARTIFACT_DIRECTORY
        / "isolation_forest_v2.joblib",

        BENCHMARK_CANDIDATE_MODEL_PATH,

        BENCHMARK_CANDIDATE_MANIFEST_PATH,

        MODEL_COMPARISON_PATH,

        SELECTED_MODEL_EVALUATION_PATH,

        INCIDENT_EVALUATION_PATH,

        EVALUATION_REGISTRY_PATH,

        BENCHMARK_REPORT_PATH,
    ]

    removed = 0

    for path in paths:
        if path.exists():
            path.unlink()
            removed += 1

    print(
        "Generated benchmark outputs removed:",
        removed,
    )


# ============================================================
# Verify Benchmark Provenance
# ============================================================

def verify_benchmark_provenance(
) -> None:
    """
    Verify benchmark truth is batch-scoped and does not
    impersonate a live/development simulator execution.
    """

    db = SessionLocal()

    try:
        simulation_run_count = int(
            db.scalar(
                select(
                    func.count(
                        SimulationRun.id
                    )
                )
            )
            or 0
        )


        total_truth_count = (
            count_injected_events(
                db
            )
        )


        benchmark_truth_count = int(
            db.scalar(
                select(
                    func.count(
                        SimulationGroundTruth.id
                    )
                )
                .where(
                    SimulationGroundTruth
                    .is_injected
                    .is_(True),

                    SimulationGroundTruth
                    .benchmark_batch_id
                    == EXPECTED_BENCHMARK_BATCH_ID,
                )
            )
            or 0
        )


        simulation_linked_truth_count = int(
            db.scalar(
                select(
                    func.count(
                        SimulationGroundTruth.id
                    )
                )
                .where(
                    SimulationGroundTruth
                    .simulation_run_id
                    .is_not(None)
                )
            )
            or 0
        )


        unbatched_truth_count = int(
            db.scalar(
                select(
                    func.count(
                        SimulationGroundTruth.id
                    )
                )
                .where(
                    SimulationGroundTruth
                    .benchmark_batch_id
                    .is_(None)
                )
            )
            or 0
        )


        if (
            simulation_run_count
            != EXPECTED_SIMULATION_RUNS
        ):
            raise RuntimeError(
                (
                    "Benchmark provenance regression: "
                    f"expected "
                    f"{EXPECTED_SIMULATION_RUNS} "
                    "SimulationRun rows; found "
                    f"{simulation_run_count}."
                )
            )


        if (
            total_truth_count
            != EXPECTED_ATTACK_EVENTS
        ):
            raise RuntimeError(
                (
                    "Benchmark provenance regression: "
                    f"expected "
                    f"{EXPECTED_ATTACK_EVENTS} "
                    "private injected truth rows; found "
                    f"{total_truth_count}."
                )
            )


        if (
            benchmark_truth_count
            != EXPECTED_ATTACK_EVENTS
        ):
            raise RuntimeError(
                (
                    "Benchmark provenance regression: "
                    f"expected "
                    f"{EXPECTED_ATTACK_EVENTS} "
                    "rows for benchmark batch "
                    f"{EXPECTED_BENCHMARK_BATCH_ID!r}; "
                    f"found "
                    f"{benchmark_truth_count}."
                )
            )


        if (
            simulation_linked_truth_count
            != 0
        ):
            raise RuntimeError(
                (
                    "Benchmark provenance regression: "
                    "controlled benchmark truth must "
                    "not reference SimulationRun. "
                    f"Found "
                    f"{simulation_linked_truth_count} "
                    "linked rows."
                )
            )


        if (
            unbatched_truth_count
            != 0
        ):
            raise RuntimeError(
                (
                    "Benchmark provenance regression: "
                    "all private benchmark truth must "
                    "have benchmark_batch_id. "
                    f"Found "
                    f"{unbatched_truth_count} "
                    "unbatched rows."
                )
            )


        print()
        print(
            "Benchmark provenance verification"
        )

        print(
            "-" * 78
        )

        print(
            "Simulation runs:",
            simulation_run_count,
        )

        print(
            "Private truth rows:",
            total_truth_count,
        )

        print(
            "Benchmark batch:",
            EXPECTED_BENCHMARK_BATCH_ID,
        )

        print(
            "PASS - benchmark provenance is "
            "independent from live simulation runtime."
        )

    finally:
        db.close()


# ============================================================
# Verification
# ============================================================

def verify_model_selection(
) -> None:
    """
    Ensure the controlled benchmark selected V1 objectively and that the
    promoted production artifact is the expected detector.
    """

    comparison = load_json(
        MODEL_COMPARISON_PATH
    )

    experiments = (
        comparison.get(
            "experiments",
            [],
        )
    )

    selected = [
        experiment
        for experiment
        in experiments
        if experiment.get(
            "selected"
        )
    ]

    if len(selected) != 1:
        raise RuntimeError(
            "Benchmark model comparison must "
            "select exactly one experiment."
        )

    selected_experiment = (
        selected[0]
    )

    selected_name = str(
        selected_experiment.get(
            "name",
            "",
        )
    )

    if (
        selected_name
        != EXPECTED_SELECTED_EXPERIMENT
    ):
        raise RuntimeError(
            "Canonical benchmark model-selection "
            "regression detected. "
            f"Expected "
            f"{EXPECTED_SELECTED_EXPERIMENT!r}; "
            f"selected {selected_name!r}."
        )

    selected_evaluation = load_json(
        SELECTED_MODEL_EVALUATION_PATH
    )

    selected_model = (
        selected_evaluation.get(
            "selected_model",
            {},
        )
    )

    model_name = (
        selected_model.get(
            "detector_name"
        )
    )

    model_version = (
        selected_model.get(
            "version"
        )
    )

    if (
        model_name
        != EXPECTED_SELECTED_MODEL_NAME
        or model_version
        != EXPECTED_SELECTED_MODEL_VERSION
    ):
        raise RuntimeError(
            "Selected production model identity "
            "does not match the canonical "
            "benchmark expectation. "
            f"Expected "
            f"{EXPECTED_SELECTED_MODEL_NAME} "
            f"v{EXPECTED_SELECTED_MODEL_VERSION}; "
            f"found "
            f"{model_name} "
            f"v{model_version}."
        )

    print()
    print(
        "Canonical model selection verified."
    )

    print(
        "Selected experiment:",
        selected_name,
    )

    print(
        "Selected model:",
        f"{model_name} "
        f"v{model_version}",
    )


def collect_database_summary(
) -> dict:
    db = SessionLocal()

    try:
        employee_count = (
            db.scalar(
                select(
                    func.count(
                        Employee.id
                    )
                )
            )
            or 0
        )

        total_events = (
            db.scalar(
                select(
                    func.count(
                        Event.id
                    )
                )
            )
            or 0
        )

        attack_events = (
            count_injected_events(
                db
            )
        )

        normal_events = (
            total_events
            - attack_events
        )

        score_count = (
            db.scalar(
                select(
                    func.count(
                        AnomalyScore.id
                    )
                ).where(
                    AnomalyScore.detector_name
                    == EXPECTED_SELECTED_MODEL_NAME,

                    AnomalyScore.detector_version
                    == EXPECTED_SELECTED_MODEL_VERSION,
                )
            )
            or 0
        )

        risk_rows = db.execute(
            select(
                AnomalyScore.risk_level,
                func.count(
                    AnomalyScore.id
                ),
            )
            .where(
                AnomalyScore.detector_name
                == EXPECTED_SELECTED_MODEL_NAME,

                AnomalyScore.detector_version
                == EXPECTED_SELECTED_MODEL_VERSION,
            )
            .group_by(
                AnomalyScore.risk_level
            )
        ).all()

        risk_distribution = {
            risk_level: int(
                count
            )
            for (
                risk_level,
                count,
            )
            in risk_rows
        }

        incident_count = (
            db.scalar(
                select(
                    func.count(
                        Incident.id
                    )
                )
            )
            or 0
        )

        severity_rows = db.execute(
            select(
                Incident.severity,
                func.count(
                    Incident.id
                ),
            )
            .group_by(
                Incident.severity
            )
        ).all()

        incident_severity = {
            severity: int(
                count
            )
            for (
                severity,
                count,
            )
            in severity_rows
        }

        return {
            "employees":
                int(
                    employee_count
                ),

            "events": {
                "total":
                    int(
                        total_events
                    ),

                "normal":
                    int(
                        normal_events
                    ),

                "injected":
                    int(
                        attack_events
                    ),
            },

            "anomaly_scores":
                int(
                    score_count
                ),

            "risk_distribution":
                risk_distribution,

            "incidents": {
                "total":
                    int(
                        incident_count
                    ),

                "severity_distribution":
                    incident_severity,
            },
        }

    finally:
        db.close()


def verify_database_results(
    database_summary: dict,
) -> None:
    if (
        database_summary[
            "employees"
        ]
        != EXPECTED_EMPLOYEES
    ):
        raise RuntimeError(
            "Benchmark employee count "
            "does not match canonical expectation."
        )

    events = (
        database_summary[
            "events"
        ]
    )

    if (
        events[
            "total"
        ]
        != EXPECTED_TOTAL_EVENTS
    ):
        raise RuntimeError(
            "Benchmark event count "
            "does not match canonical expectation."
        )

    if (
        events[
            "normal"
        ]
        != EXPECTED_NORMAL_EVENTS
        or events[
            "injected"
        ]
        != EXPECTED_ATTACK_EVENTS
    ):
        raise RuntimeError(
            "Benchmark normal/injected event "
            "distribution changed."
        )

    if (
        database_summary[
            "anomaly_scores"
        ]
        != EXPECTED_TOTAL_EVENTS
    ):
        raise RuntimeError(
            "Not every benchmark event "
            "received the selected model score."
        )

    actual_risk = {
        risk:
            database_summary[
                "risk_distribution"
            ].get(
                risk,
                0,
            )
        for risk
        in EXPECTED_RISK_DISTRIBUTION
    }

    if (
        actual_risk
        != EXPECTED_RISK_DISTRIBUTION
    ):
        raise RuntimeError(
            "Canonical anomaly risk "
            "distribution changed. "
            f"Expected "
            f"{EXPECTED_RISK_DISTRIBUTION}; "
            f"found {actual_risk}."
        )

    if (
        database_summary[
            "incidents"
        ][
            "total"
        ]
        != EXPECTED_INCIDENTS
    ):
        raise RuntimeError(
            "Canonical incident count changed."
        )


def verify_registry_results(
    registry: dict,
) -> None:
    selected_model = (
        registry.get(
            "selected_model",
            {},
        )
    )

    if (
        selected_model.get(
            "detector_name"
        )
        != EXPECTED_SELECTED_MODEL_NAME
        or selected_model.get(
            "version"
        )
        != EXPECTED_SELECTED_MODEL_VERSION
    ):
        raise RuntimeError(
            "Evaluation registry contains "
            "the wrong production detector."
        )

    if (
        selected_model.get(
            "feature_count"
        )
        != EXPECTED_FEATURE_COUNT
    ):
        raise RuntimeError(
            "Selected model feature count changed."
        )

    if (
        selected_model.get(
            "training_rows"
        )
        != EXPECTED_TRAINING_ROWS
        or selected_model.get(
            "evaluation_rows"
        )
        != EXPECTED_EVALUATION_ROWS
    ):
        raise RuntimeError(
            "Selected model train/evaluation "
            "split changed."
        )

    metric_expectations = {
        "precision":
            EXPECTED_MODEL_PRECISION,

        "recall":
            EXPECTED_MODEL_RECALL,

        "f1_score":
            EXPECTED_MODEL_F1,

        "false_positive_rate":
            EXPECTED_MODEL_FPR,
    }

    for (
        metric_name,
        expected_value,
    ) in metric_expectations.items():
        actual_value = float(
            selected_model.get(
                metric_name,
                -1.0,
            )
        )

        if not floats_match(
            actual_value,
            expected_value,
        ):
            raise RuntimeError(
                "Canonical model metric changed: "
                f"{metric_name}. "
                f"Expected {expected_value}; "
                f"found {actual_value}."
            )

    experiments = (
        registry.get(
            "experiments",
            [],
        )
    )

    selected_experiments = [
        experiment
        for experiment
        in experiments
        if experiment.get(
            "selected"
        )
    ]

    if (
        len(
            selected_experiments
        )
        != 1
        or selected_experiments[
            0
        ].get(
            "name"
        )
        != EXPECTED_SELECTED_EXPERIMENT
    ):
        raise RuntimeError(
            "Registry experiment selection "
            "is inconsistent."
        )

    incident_evaluation = (
        registry.get(
            "incident_evaluation",
            {},
        )
    )

    if (
        incident_evaluation.get(
            "attack_instances_detected"
        )
        != EXPECTED_ATTACK_INSTANCES
        or incident_evaluation.get(
            "attack_instances_total"
        )
        != EXPECTED_ATTACK_INSTANCES
    ):
        raise RuntimeError(
            "Not all controlled attack "
            "instances were recovered."
        )

    incident_metrics = {
        "precision":
            EXPECTED_INCIDENT_PRECISION,

        "recall":
            EXPECTED_INCIDENT_RECALL,

        "f1_score":
            EXPECTED_INCIDENT_F1,

        "timeline_recovery_rate":
            EXPECTED_TIMELINE_RECOVERY,
    }

    for (
        metric_name,
        expected_value,
    ) in incident_metrics.items():
        actual_value = float(
            incident_evaluation.get(
                metric_name,
                -1.0,
            )
        )

        if not floats_match(
            actual_value,
            expected_value,
        ):
            raise RuntimeError(
                "Canonical incident metric changed: "
                f"{metric_name}. "
                f"Expected {expected_value}; "
                f"found {actual_value}."
            )

    if (
        incident_evaluation.get(
            "timeline_events_recovered"
        )
        != EXPECTED_ATTACK_EVENTS
        or incident_evaluation.get(
            "timeline_events_total"
        )
        != EXPECTED_ATTACK_EVENTS
    ):
        raise RuntimeError(
            "Attack timeline recovery "
            "is incomplete."
        )


def verify_final_artifacts(
) -> tuple[
    dict,
    dict,
]:
    required_paths = [
        MODEL_COMPARISON_PATH,
        SELECTED_MODEL_EVALUATION_PATH,
        INCIDENT_EVALUATION_PATH,
        EVALUATION_REGISTRY_PATH,
        BENCHMARK_CANDIDATE_MODEL_PATH,
        BENCHMARK_CANDIDATE_MANIFEST_PATH,
    ]

    missing = [
        path
        for path
        in required_paths
        if not path.exists()
    ]

    if missing:
        formatted = "\n".join(
            f"  - {path}"
            for path
            in missing
        )

        raise RuntimeError(
            "Benchmark finished but required "
            "artifacts are missing:\n"
            f"{formatted}"
        )

    registry = load_json(
        EVALUATION_REGISTRY_PATH
    )

    database_summary = (
        collect_database_summary()
    )

    verify_database_results(
        database_summary
    )

    verify_registry_results(
        registry
    )

    print()
    print(
        "Canonical benchmark results verified."
    )

    print(
        "Events:",
        database_summary[
            "events"
        ][
            "total"
        ],
    )

    print(
        "Scores:",
        database_summary[
            "anomaly_scores"
        ],
    )

    print(
        "Incidents:",
        database_summary[
            "incidents"
        ][
            "total"
        ],
    )

    print(
        "Campaign recovery:",
        (
            f"{EXPECTED_ATTACK_INSTANCES}/"
            f"{EXPECTED_ATTACK_INSTANCES}"
        ),
    )

    print(
        "Timeline recovery:",
        (
            f"{EXPECTED_ATTACK_EVENTS}/"
            f"{EXPECTED_ATTACK_EVENTS}"
        ),
    )

    return (
        registry,
        database_summary,
    )


# ============================================================
# Benchmark report
# ============================================================

def write_benchmark_report(
    *,
    registry: dict,
    database_summary: dict,
    elapsed_seconds: float,
) -> dict:
    selected_model = (
        registry[
            "selected_model"
        ]
    )

    incident_evaluation = (
        registry[
            "incident_evaluation"
        ]
    )

    experiments = (
        registry[
            "experiments"
        ]
    )

    selected_experiment = next(
        experiment
        for experiment
        in experiments
        if experiment.get(
            "selected"
        )
    )

    report = {
        "benchmark": {
            "name":
                "SENTINEL Controlled Benchmark",

            "status":
                "PASS",

            "seed":
                BENCHMARK_SEED,

            "reproducible":
                True,

            "database_isolation":
                "dedicated benchmark database",

            "generated_at":
                utc_now_iso(),

            "elapsed_seconds":
                round(
                    elapsed_seconds,
                    3,
                ),
        },

        "dataset": {
            "employees":
                database_summary[
                    "employees"
                ],

            "normal_events":
                database_summary[
                    "events"
                ][
                    "normal"
                ],

            "attack_events":
                database_summary[
                    "events"
                ][
                    "injected"
                ],

            "total_events":
                database_summary[
                    "events"
                ][
                    "total"
                ],

            "attack_instances":
                EXPECTED_ATTACK_INSTANCES,
        },

        "selected_experiment":
            selected_experiment,

        "production_model":
            selected_model,

        "operational_scoring": {
            "scored_events":
                database_summary[
                    "anomaly_scores"
                ],

            "risk_distribution":
                database_summary[
                    "risk_distribution"
                ],
        },

        "incident_correlation":
            database_summary[
                "incidents"
            ],

        "incident_evaluation":
            incident_evaluation,

        "provenance":
            registry.get(
                "provenance",
                {},
            ),

        "canonical_signature": {
            "employees":
                EXPECTED_EMPLOYEES,

            "events":
                EXPECTED_TOTAL_EVENTS,

            "selected_experiment":
                EXPECTED_SELECTED_EXPERIMENT,

            "selected_detector":
                (
                    f"{EXPECTED_SELECTED_MODEL_NAME} "
                    f"v{EXPECTED_SELECTED_MODEL_VERSION}"
                ),

            "model_f1":
                EXPECTED_MODEL_F1,

            "critical_scores":
                EXPECTED_RISK_DISTRIBUTION[
                    "CRITICAL"
                ],

            "incidents":
                EXPECTED_INCIDENTS,

            "attack_instances_recovered":
                EXPECTED_ATTACK_INSTANCES,

            "timeline_events_recovered":
                EXPECTED_ATTACK_EVENTS,

            "incident_precision":
                EXPECTED_INCIDENT_PRECISION,

            "incident_recall":
                EXPECTED_INCIDENT_RECALL,
        },
    }

    RESULTS_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    BENCHMARK_REPORT_PATH.write_text(
        json.dumps(
            report,
            indent=2,
        ),
        encoding="utf-8",
    )

    return report


# ============================================================
# Main benchmark
# ============================================================

def run_benchmark(
) -> None:
    print_heading(
        "SENTINEL REPRODUCIBLE BENCHMARK"
    )

    print(
        "Controlled ML + incident intelligence evaluation"
    )

    print()
    print(
        "This workflow must use a dedicated benchmark database."
    )

    verify_benchmark_database_safety()

    total_started = (
        time.perf_counter()
    )

    reset_benchmark_database()

    clear_generated_outputs()

    stages = [
        (
            1,
            "Generate canonical company",
            generate_company,
        ),
        (
            2,
            "Generate normal activity",
            generate_normal_activity,
        ),
        (
            3,
            "Inject attack scenarios",
            inject_attack_scenarios,
        ),
        (
            4,
            "Validate synthetic dataset",
            validate_simulation,
        ),
        (
            5,
            "Build ML feature dataset",
            build_ml_dataset,
        ),
        (
            6,
            "Train and evaluate Isolation Forest V1",
            train_v1,
        ),
        (
            7,
            "Train and evaluate Isolation Forest V2",
            train_v2,
        ),
        (
            8,
            "Compare ML experiments",
            compare_models,
        ),
        (
            9,
            "Train selected benchmark candidate",
            train_benchmark_selected_candidate,
        ),
        (
            10,
            "Score benchmark events",
            score_benchmark_events,
        ),
        (
            11,
            "Generate correlated incidents",
            generate_incidents,
        ),
        (
            12,
            "Evaluate incident recovery",
            evaluate_incidents,
        ),
        (
            13,
            "Build evaluation registry",
            build_evaluation_registry,
        ),
    ]

    for (
        number,
        title,
        function,
    ) in stages:
        run_stage(
            number=number,
            title=title,
            function=function,
        )

        if number == 9:
            verify_benchmark_provenance()
            verify_model_selection()

    (
        registry,
        database_summary,
    ) = verify_final_artifacts()

    elapsed = (
        time.perf_counter()
        - total_started
    )

    write_benchmark_report(
        registry=registry,
        database_summary=database_summary,
        elapsed_seconds=elapsed,
    )

    print_heading(
        "SENTINEL BENCHMARK COMPLETE"
    )

    print(
        "Status                 : PASS"
    )

    print(
        "Dataset                : "
        f"{EXPECTED_TOTAL_EVENTS:,} events"
    )

    print(
        "Selected experiment    : "
        f"{EXPECTED_SELECTED_EXPERIMENT}"
    )

    print(
        "Selected detector      : "
        f"{EXPECTED_SELECTED_MODEL_NAME} "
        f"v{EXPECTED_SELECTED_MODEL_VERSION}"
    )

    print(
        "Model F1               : "
        f"{EXPECTED_MODEL_F1:.3f}"
    )

    print(
        "Incidents              : "
        f"{EXPECTED_INCIDENTS}"
    )

    print(
        "Attack campaigns       : "
        f"{EXPECTED_ATTACK_INSTANCES}/"
        f"{EXPECTED_ATTACK_INSTANCES}"
    )

    print(
        "Timeline recovery      : "
        f"{EXPECTED_ATTACK_EVENTS}/"
        f"{EXPECTED_ATTACK_EVENTS}"
    )

    print(
        "Evaluation registry    : "
        f"{EVALUATION_REGISTRY_PATH}"
    )

    print(
        "Benchmark report       : "
        f"{BENCHMARK_REPORT_PATH}"
    )

    print(
        "Total elapsed          : "
        f"{elapsed:.2f} seconds"
    )


if __name__ == "__main__":
    run_benchmark()