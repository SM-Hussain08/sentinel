from __future__ import annotations

import json
import math
from pathlib import Path
import sys
from typing import Any


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
    path_string = str(path)

    if path_string not in sys.path:
        sys.path.insert(
            0,
            path_string,
        )


from app.model_governance import (  # noqa: E402
    validate_model_governance,
)
from app.selected_detector import (  # noqa: E402
    SELECTED_MODEL_MANIFEST_PATH,
)
from ml_engine.evaluation.registry import (  # noqa: E402
    EVALUATION_REGISTRY_PATH,
    INCIDENT_EVALUATION_RESULT_PATH,
    MODEL_COMPARISON_RESULT_PATH,
    SELECTED_MODEL_RESULT_PATH,
)


BENCHMARK_REPORT_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "evaluation"
    / "results"
    / "benchmark_report.json"
)


EXPECTED_BENCHMARK_SEED = 42
EXPECTED_SELECTED_EXPERIMENT = "V1"
EXPECTED_DETECTOR_NAME = "isolation-forest"
EXPECTED_MODEL_VERSION = "1.2"

EXPECTED_FEATURE_COUNT = 17
EXPECTED_TRAINING_ROWS = 1952
EXPECTED_EVALUATION_ROWS = 3951

EXPECTED_GROUND_TRUTH_BATCH = (
    "phase3_attack_batch_01"
)


class BenchmarkProvenanceError(
    RuntimeError
):
    """
    Raised when SENTINEL benchmark provenance is inconsistent.
    """


def _fail(
    message: str,
) -> None:
    raise BenchmarkProvenanceError(
        message
    )


def _load_json(
    path: Path,
) -> dict[str, Any]:
    if not path.exists():
        _fail(
            "Required provenance artifact is missing: "
            f"{path}"
        )

    if not path.is_file():
        _fail(
            "Required provenance artifact is not a file: "
            f"{path}"
        )

    try:
        payload = json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )

    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        raise BenchmarkProvenanceError(
            "Could not read provenance artifact as "
            f"valid JSON: {path}"
        ) from exc

    if not isinstance(
        payload,
        dict,
    ):
        _fail(
            "Provenance artifact must contain a JSON "
            f"object: {path}"
        )

    return payload


def _require(
    condition: bool,
    message: str,
) -> None:
    if not condition:
        _fail(
            message
        )


def _require_equal(
    label: str,
    actual: Any,
    expected: Any,
) -> None:
    if actual != expected:
        _fail(
            f"{label} mismatch: "
            f"expected {expected!r}, "
            f"found {actual!r}."
        )


def _require_float_equal(
    label: str,
    actual: Any,
    expected: Any,
) -> None:
    try:
        actual_number = float(
            actual
        )

        expected_number = float(
            expected
        )

    except (
        TypeError,
        ValueError,
    ) as exc:
        raise BenchmarkProvenanceError(
            f"{label} must be numeric."
        ) from exc

    if not math.isclose(
        actual_number,
        expected_number,
        rel_tol=1e-12,
        abs_tol=1e-12,
    ):
        _fail(
            f"{label} mismatch: "
            f"expected {expected_number!r}, "
            f"found {actual_number!r}."
        )


def _require_mapping(
    payload: dict[str, Any],
    key: str,
    source: str,
) -> dict[str, Any]:
    value = payload.get(
        key
    )

    if not isinstance(
        value,
        dict,
    ):
        _fail(
            f"{source} is missing object field "
            f"{key!r}."
        )

    return value


def _require_list(
    payload: dict[str, Any],
    key: str,
    source: str,
) -> list[Any]:
    value = payload.get(
        key
    )

    if not isinstance(
        value,
        list,
    ):
        _fail(
            f"{source} is missing list field "
            f"{key!r}."
        )

    return value


def main() -> int:
    governance_report = (
        validate_model_governance()
    )

    manifest = _load_json(
        SELECTED_MODEL_MANIFEST_PATH
    )

    selected_result = _load_json(
        SELECTED_MODEL_RESULT_PATH
    )

    comparison_result = _load_json(
        MODEL_COMPARISON_RESULT_PATH
    )

    registry = _load_json(
        EVALUATION_REGISTRY_PATH
    )

    benchmark_report = _load_json(
        BENCHMARK_REPORT_PATH
    )

    incident_result = _load_json(
        INCIDENT_EVALUATION_RESULT_PATH
    )

    selected_model = _require_mapping(
        selected_result,
        "selected_model",
        "selected model evaluation",
    )

    selected_provenance = _require_mapping(
        selected_result,
        "provenance",
        "selected model evaluation",
    )

    registry_selected_model = _require_mapping(
        registry,
        "selected_model",
        "evaluation registry",
    )

    registry_provenance = _require_mapping(
        registry,
        "provenance",
        "evaluation registry",
    )

    benchmark = _require_mapping(
        benchmark_report,
        "benchmark",
        "benchmark report",
    )

    benchmark_dataset = _require_mapping(
        benchmark_report,
        "dataset",
        "benchmark report",
    )

    selected_experiment = _require_mapping(
        benchmark_report,
        "selected_experiment",
        "benchmark report",
    )

    production_model = _require_mapping(
        benchmark_report,
        "production_model",
        "benchmark report",
    )

    benchmark_incident = _require_mapping(
        benchmark_report,
        "incident_evaluation",
        "benchmark report",
    )

    benchmark_provenance = _require_mapping(
        benchmark_report,
        "provenance",
        "benchmark report",
    )

    canonical_signature = _require_mapping(
        benchmark_report,
        "canonical_signature",
        "benchmark report",
    )

    incident_evaluation = _require_mapping(
        incident_result,
        "incident_evaluation",
        "incident evaluation",
    )

    incident_provenance = _require_mapping(
        incident_result,
        "provenance",
        "incident evaluation",
    )

    registry_incident = _require_mapping(
        registry,
        "incident_evaluation",
        "evaluation registry",
    )

    experiments = _require_list(
        comparison_result,
        "experiments",
        "model comparison",
    )

    registry_experiments = _require_list(
        registry,
        "experiments",
        "evaluation registry",
    )

    # --------------------------------------------------------
    # Canonical benchmark identity
    # --------------------------------------------------------

    _require_equal(
        "Benchmark status",
        benchmark.get(
            "status"
        ),
        "PASS",
    )

    _require_equal(
        "Benchmark seed",
        benchmark.get(
            "seed"
        ),
        EXPECTED_BENCHMARK_SEED,
    )

    _require_equal(
        "Manifest benchmark seed",
        manifest.get(
            "benchmark_seed"
        ),
        EXPECTED_BENCHMARK_SEED,
    )

    _require_equal(
        "Benchmark reproducibility flag",
        benchmark.get(
            "reproducible"
        ),
        True,
    )

    # --------------------------------------------------------
    # Production detector lineage
    # --------------------------------------------------------

    _require_equal(
        "Governed detector name",
        governance_report.model_name,
        EXPECTED_DETECTOR_NAME,
    )

    _require_equal(
        "Governed detector version",
        governance_report.model_version,
        EXPECTED_MODEL_VERSION,
    )

    _require_equal(
        "Selected evaluation detector",
        selected_model.get(
            "detector_name"
        ),
        governance_report.model_name,
    )

    _require_equal(
        "Selected evaluation model version",
        selected_model.get(
            "version"
        ),
        governance_report.model_version,
    )

    _require_equal(
        "Benchmark production detector",
        production_model.get(
            "detector_name"
        ),
        governance_report.model_name,
    )

    _require_equal(
        "Benchmark production version",
        production_model.get(
            "version"
        ),
        governance_report.model_version,
    )

    # --------------------------------------------------------
    # Feature/training/evaluation lineage
    # --------------------------------------------------------

    _require_equal(
        "Governed feature count",
        governance_report.feature_count,
        EXPECTED_FEATURE_COUNT,
    )

    _require_equal(
        "Selected evaluation feature count",
        selected_model.get(
            "feature_count"
        ),
        EXPECTED_FEATURE_COUNT,
    )

    _require_equal(
        "Production model feature count",
        production_model.get(
            "feature_count"
        ),
        EXPECTED_FEATURE_COUNT,
    )

    _require_equal(
        "Selected evaluation training rows",
        selected_model.get(
            "training_rows"
        ),
        EXPECTED_TRAINING_ROWS,
    )

    _require_equal(
        "Manifest training rows",
        manifest.get(
            "training_rows"
        ),
        EXPECTED_TRAINING_ROWS,
    )

    _require_equal(
        "Production model training rows",
        production_model.get(
            "training_rows"
        ),
        EXPECTED_TRAINING_ROWS,
    )

    _require_equal(
        "Selected evaluation rows",
        selected_model.get(
            "evaluation_rows"
        ),
        EXPECTED_EVALUATION_ROWS,
    )

    _require_equal(
        "Manifest evaluation rows",
        manifest.get(
            "evaluation_rows"
        ),
        EXPECTED_EVALUATION_ROWS,
    )

    _require_equal(
        "Production model evaluation rows",
        production_model.get(
            "evaluation_rows"
        ),
        EXPECTED_EVALUATION_ROWS,
    )

    # --------------------------------------------------------
    # Production evaluation metrics
    # --------------------------------------------------------

    metric_fields = (
        "precision",
        "recall",
        "f1_score",
        "false_positive_rate",
        "threshold_percentile",
    )

    manifest_metrics = _require_mapping(
        manifest,
        "metrics",
        "selected model manifest",
    )

    for field in metric_fields:
        if field == "threshold_percentile":
            manifest_value = manifest.get(
                field
            )
        else:
            manifest_value = manifest_metrics.get(
                field
            )

        _require_float_equal(
            f"Manifest vs selected evaluation {field}",
            manifest_value,
            selected_model.get(
                field
            ),
        )

        _require_float_equal(
            f"Selected evaluation vs benchmark "
            f"production model {field}",
            selected_model.get(
                field
            ),
            production_model.get(
                field
            ),
        )

    _require_equal(
        "Manifest false positives",
        manifest_metrics.get(
            "false_positives"
        ),
        selected_model.get(
            "false_positives"
        ),
    )

    _require_equal(
        "Selected evaluation false positives",
        selected_model.get(
            "false_positives"
        ),
        production_model.get(
            "false_positives"
        ),
    )

    # --------------------------------------------------------
    # Registry selected-model consistency
    # --------------------------------------------------------

    _require_equal(
        "Registry selected model",
        registry_selected_model,
        selected_model,
    )

    # --------------------------------------------------------
    # Experiment selection consistency
    # --------------------------------------------------------

    selected_candidates = [
        experiment
        for experiment in experiments
        if (
            isinstance(
                experiment,
                dict,
            )
            and experiment.get(
                "selected"
            )
            is True
        )
    ]

    _require_equal(
        "Number of selected experiments",
        len(
            selected_candidates
        ),
        1,
    )

    comparison_selected = (
        selected_candidates[0]
    )

    _require_equal(
        "Selected experiment name",
        comparison_selected.get(
            "name"
        ),
        EXPECTED_SELECTED_EXPERIMENT,
    )

    _require_equal(
        "Benchmark selected experiment",
        selected_experiment,
        comparison_selected,
    )

    _require_equal(
        "Registry experiment list",
        registry_experiments,
        experiments,
    )

    _require_equal(
        "Manifest experiment lineage",
        manifest.get(
            "experiment"
        ),
        EXPECTED_SELECTED_EXPERIMENT,
    )

    _require_equal(
        "Selected experiment feature count",
        comparison_selected.get(
            "feature_count"
        ),
        EXPECTED_FEATURE_COUNT,
    )

    for field in (
        "precision",
        "recall",
        "f1_score",
        "false_positive_rate",
    ):
        _require_float_equal(
            f"Selected experiment vs production {field}",
            comparison_selected.get(
                field
            ),
            production_model.get(
                field
            ),
        )

    _require_equal(
        "Selected experiment false positives",
        comparison_selected.get(
            "false_positives"
        ),
        production_model.get(
            "false_positives"
        ),
    )

    # --------------------------------------------------------
    # Training/evaluation period provenance
    # --------------------------------------------------------

    _require_equal(
        "Training period",
        manifest.get(
            "training_period"
        ),
        selected_provenance.get(
            "training_period"
        ),
    )

    _require_equal(
        "Evaluation period",
        manifest.get(
            "evaluation_period"
        ),
        selected_provenance.get(
            "evaluation_period"
        ),
    )

    _require_equal(
        "Registry training period",
        registry_provenance.get(
            "ml_training_period"
        ),
        manifest.get(
            "training_period"
        ),
    )

    _require_equal(
        "Registry evaluation period",
        registry_provenance.get(
            "ml_evaluation_period"
        ),
        manifest.get(
            "evaluation_period"
        ),
    )

    _require_equal(
        "Benchmark training period",
        benchmark_provenance.get(
            "ml_training_period"
        ),
        manifest.get(
            "training_period"
        ),
    )

    _require_equal(
        "Benchmark evaluation period",
        benchmark_provenance.get(
            "ml_evaluation_period"
        ),
        manifest.get(
            "evaluation_period"
        ),
    )

    # --------------------------------------------------------
    # Incident evaluation provenance
    # --------------------------------------------------------

    _require_equal(
        "Incident evaluation registry payload",
        registry_incident,
        incident_evaluation,
    )

    _require_equal(
        "Benchmark incident evaluation payload",
        benchmark_incident,
        incident_evaluation,
    )

    _require_equal(
        "Incident ground-truth batch",
        incident_provenance.get(
            "ground_truth_batch"
        ),
        EXPECTED_GROUND_TRUTH_BATCH,
    )

    _require_equal(
        "Registry ground-truth batch",
        registry_provenance.get(
            "incident_ground_truth_batch"
        ),
        EXPECTED_GROUND_TRUTH_BATCH,
    )

    _require_equal(
        "Benchmark ground-truth batch",
        benchmark_provenance.get(
            "incident_ground_truth_batch"
        ),
        EXPECTED_GROUND_TRUTH_BATCH,
    )

    _require_equal(
        "Registry ground-truth policy",
        registry_provenance.get(
            "ground_truth_policy"
        ),
        incident_provenance.get(
            "ground_truth_policy"
        ),
    )

    _require_equal(
        "Benchmark ground-truth policy",
        benchmark_provenance.get(
            "ground_truth_policy"
        ),
        incident_provenance.get(
            "ground_truth_policy"
        ),
    )

    # --------------------------------------------------------
    # Canonical benchmark signature
    # --------------------------------------------------------

    _require_equal(
        "Canonical employee count",
        canonical_signature.get(
            "employees"
        ),
        benchmark_dataset.get(
            "employees"
        ),
    )

    _require_equal(
        "Canonical event count",
        canonical_signature.get(
            "events"
        ),
        benchmark_dataset.get(
            "total_events"
        ),
    )

    _require_equal(
        "Canonical selected experiment",
        canonical_signature.get(
            "selected_experiment"
        ),
        EXPECTED_SELECTED_EXPERIMENT,
    )

    _require_equal(
        "Canonical selected detector",
        canonical_signature.get(
            "selected_detector"
        ),
        (
            f"{EXPECTED_DETECTOR_NAME} "
            f"v{EXPECTED_MODEL_VERSION}"
        ),
    )

    _require_float_equal(
        "Canonical model F1",
        canonical_signature.get(
            "model_f1"
        ),
        production_model.get(
            "f1_score"
        ),
    )

    _require_equal(
        "Canonical incident count",
        canonical_signature.get(
            "incidents"
        ),
        benchmark_report[
            "incident_correlation"
        ].get(
            "total"
        ),
    )

    _require_equal(
        "Canonical attack instances recovered",
        canonical_signature.get(
            "attack_instances_recovered"
        ),
        incident_evaluation.get(
            "attack_instances_detected"
        ),
    )

    _require_equal(
        "Canonical timeline events recovered",
        canonical_signature.get(
            "timeline_events_recovered"
        ),
        incident_evaluation.get(
            "timeline_events_recovered"
        ),
    )

    _require_float_equal(
        "Canonical incident precision",
        canonical_signature.get(
            "incident_precision"
        ),
        incident_evaluation.get(
            "precision"
        ),
    )

    _require_float_equal(
        "Canonical incident recall",
        canonical_signature.get(
            "incident_recall"
        ),
        incident_evaluation.get(
            "recall"
        ),
    )

    # --------------------------------------------------------
    # Dataset arithmetic sanity
    # --------------------------------------------------------

    normal_events = (
        benchmark_dataset.get(
            "normal_events"
        )
    )

    attack_events = (
        benchmark_dataset.get(
            "attack_events"
        )
    )

    total_events = (
        benchmark_dataset.get(
            "total_events"
        )
    )

    _require(
        isinstance(
            normal_events,
            int,
        )
        and isinstance(
            attack_events,
            int,
        )
        and isinstance(
            total_events,
            int,
        ),
        "Benchmark event counts must be integers.",
    )

    _require_equal(
        "Benchmark total event arithmetic",
        normal_events
        + attack_events,
        total_events,
    )

    print()
    print(
        "=" * 68
    )
    print(
        "SENTINEL Benchmark Provenance"
    )
    print(
        "=" * 68
    )
    print()
    print(
        "STATUS: PASS"
    )
    print()
    print(
        f"Benchmark seed:       "
        f"{EXPECTED_BENCHMARK_SEED}"
    )
    print(
        f"Selected experiment:  "
        f"{EXPECTED_SELECTED_EXPERIMENT}"
    )
    print(
        f"Production detector:  "
        f"{governance_report.model_name} "
        f"v{governance_report.model_version}"
    )
    print(
        f"Feature count:        "
        f"{governance_report.feature_count}"
    )
    print(
        f"Training rows:        "
        f"{EXPECTED_TRAINING_ROWS}"
    )
    print(
        f"Evaluation rows:      "
        f"{EXPECTED_EVALUATION_ROWS}"
    )
    print(
        f"Ground-truth batch:   "
        f"{EXPECTED_GROUND_TRUTH_BATCH}"
    )
    print()
    print(
        "Cross-artifact checks:"
    )
    print(
        "  ✓ promoted model manifest"
    )
    print(
        "  ✓ selected-model evaluation"
    )
    print(
        "  ✓ model experiment comparison"
    )
    print(
        "  ✓ evaluation registry"
    )
    print(
        "  ✓ benchmark report"
    )
    print(
        "  ✓ incident evaluation"
    )
    print(
        "  ✓ canonical benchmark signature"
    )
    print()
    print(
        "=" * 68
    )
    print(
        "SENTINEL BENCHMARK PROVENANCE: PASS"
    )
    print(
        "=" * 68
    )
    print()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(
            main()
        )

    except BenchmarkProvenanceError as exc:
        print()
        print(
            "=" * 68
        )
        print(
            "SENTINEL Benchmark Provenance"
        )
        print(
            "=" * 68
        )
        print()
        print(
            "STATUS: FAIL"
        )
        print()
        print(
            f"Reason: {exc}"
        )
        print()
        print(
            "=" * 68
        )
        print(
            "SENTINEL BENCHMARK PROVENANCE: FAIL"
        )
        print(
            "=" * 68
        )
        print()

        raise SystemExit(
            1
        )
