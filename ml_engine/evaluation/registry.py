"""
Evaluation artifact management for SENTINEL.

Individual evaluation workflows own their own generated result files:

- selected model evaluation
- model experiment comparison
- incident correlation evaluation

The final evaluation_registry.json is assembled automatically when
all required component results are available.
"""

from datetime import (
    datetime,
    timezone,
)
import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)


EVALUATION_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "evaluation"
)


RESULTS_DIRECTORY = (
    EVALUATION_DIRECTORY
    / "results"
)


SELECTED_MODEL_RESULT_PATH = (
    RESULTS_DIRECTORY
    / "selected_model_evaluation.json"
)


MODEL_COMPARISON_RESULT_PATH = (
    RESULTS_DIRECTORY
    / "model_comparison.json"
)


INCIDENT_EVALUATION_RESULT_PATH = (
    RESULTS_DIRECTORY
    / "incident_evaluation.json"
)


EVALUATION_REGISTRY_PATH = (
    EVALUATION_DIRECTORY
    / "evaluation_registry.json"
)


REQUIRED_COMPONENTS = {
    "selected model":
        SELECTED_MODEL_RESULT_PATH,

    "model comparison":
        MODEL_COMPARISON_RESULT_PATH,

    "incident evaluation":
        INCIDENT_EVALUATION_RESULT_PATH,
}


def utc_now_iso() -> str:
    return datetime.now(
        timezone.utc
    ).isoformat()


def write_evaluation_component(
    path: Path,
    payload: dict[str, Any],
) -> None:
    """
    Persist one generated evaluation component.

    A generation timestamp is automatically attached.
    """

    RESULTS_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    output = {
        **payload,
        "generated_at":
            utc_now_iso(),
    }

    path.write_text(
        json.dumps(
            output,
            indent=2,
        ),
        encoding="utf-8",
    )


def _load_json(
    path: Path,
) -> dict[str, Any]:
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
            f"Evaluation artifact could not be read: {path}"
        ) from exc


def missing_components(
) -> list[str]:
    return [
        label
        for (
            label,
            path,
        )
        in REQUIRED_COMPONENTS.items()
        if not path.exists()
    ]


def build_evaluation_registry(
) -> dict[str, Any]:
    """
    Assemble the canonical evaluation registry.

    All three evaluation components must already exist.
    """

    missing = (
        missing_components()
    )

    if missing:
        formatted = ", ".join(
            missing
        )

        raise RuntimeError(
            "Cannot build SENTINEL evaluation registry. "
            f"Missing: {formatted}."
        )

    selected_result = (
        _load_json(
            SELECTED_MODEL_RESULT_PATH
        )
    )

    comparison_result = (
        _load_json(
            MODEL_COMPARISON_RESULT_PATH
        )
    )

    incident_result = (
        _load_json(
            INCIDENT_EVALUATION_RESULT_PATH
        )
    )

    selected_model = (
        selected_result[
            "selected_model"
        ]
    )

    experiments = (
        comparison_result[
            "experiments"
        ]
    )

    incident_evaluation = (
        incident_result[
            "incident_evaluation"
        ]
    )

    selected_provenance = (
        selected_result[
            "provenance"
        ]
    )

    incident_provenance = (
        incident_result[
            "provenance"
        ]
    )

    registry = {
        "registry_version":
            "1.1",

        "generated_at":
            utc_now_iso(),

        "selected_model":
            selected_model,

        "experiments":
            experiments,

        "incident_evaluation":
            incident_evaluation,

        "provenance": {
            "ml_training_period":
                selected_provenance[
                    "training_period"
                ],

            "ml_evaluation_period":
                selected_provenance[
                    "evaluation_period"
                ],

            "incident_ground_truth_batch":
                incident_provenance[
                    "ground_truth_batch"
                ],

            "ground_truth_policy":
                incident_provenance[
                    "ground_truth_policy"
                ],
        },

        "component_generated_at": {
            "selected_model":
                selected_result.get(
                    "generated_at"
                ),

            "model_comparison":
                comparison_result.get(
                    "generated_at"
                ),

            "incident_evaluation":
                incident_result.get(
                    "generated_at"
                ),
        },
    }

    EVALUATION_REGISTRY_PATH.write_text(
        json.dumps(
            registry,
            indent=2,
        ),
        encoding="utf-8",
    )

    return registry


def try_build_evaluation_registry(
) -> tuple[
    bool,
    list[str],
]:
    """
    Rebuild automatically when all component outputs exist.

    This lets each evaluation script update its own artifact without
    failing merely because another evaluation workflow has not yet
    been run.
    """

    missing = (
        missing_components()
    )

    if missing:
        return (
            False,
            missing,
        )

    build_evaluation_registry()

    return (
        True,
        [],
    )