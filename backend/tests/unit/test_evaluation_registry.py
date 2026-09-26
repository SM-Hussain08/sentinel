"""
Unit tests for SENTINEL's evaluation artifact registry.

These tests use pytest temporary directories so the real project evaluation
artifacts are never modified.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import ml_engine.evaluation.registry as registry


# ============================================================
# Test helpers
# ============================================================


@pytest.fixture
def isolated_registry_paths(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> dict[str, Path]:
    results_directory = (
        tmp_path
        / "results"
    )

    selected_path = (
        results_directory
        / "selected_model_evaluation.json"
    )

    comparison_path = (
        results_directory
        / "model_comparison.json"
    )

    incident_path = (
        results_directory
        / "incident_evaluation.json"
    )

    registry_path = (
        tmp_path
        / "evaluation_registry.json"
    )

    monkeypatch.setattr(
        registry,
        "RESULTS_DIRECTORY",
        results_directory,
    )

    monkeypatch.setattr(
        registry,
        "SELECTED_MODEL_RESULT_PATH",
        selected_path,
    )

    monkeypatch.setattr(
        registry,
        "MODEL_COMPARISON_RESULT_PATH",
        comparison_path,
    )

    monkeypatch.setattr(
        registry,
        "INCIDENT_EVALUATION_RESULT_PATH",
        incident_path,
    )

    monkeypatch.setattr(
        registry,
        "EVALUATION_REGISTRY_PATH",
        registry_path,
    )

    monkeypatch.setattr(
        registry,
        "REQUIRED_COMPONENTS",
        {
            "selected model":
                selected_path,

            "model comparison":
                comparison_path,

            "incident evaluation":
                incident_path,
        },
    )

    return {
        "results_directory":
            results_directory,

        "selected":
            selected_path,

        "comparison":
            comparison_path,

        "incident":
            incident_path,

        "registry":
            registry_path,
    }


def _write_json(
    path: Path,
    payload: dict,
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    path.write_text(
        json.dumps(
            payload,
            indent=2,
        ),
        encoding="utf-8",
    )


def _write_complete_components(
    paths: dict[str, Path],
) -> None:
    _write_json(
        paths["selected"],
        {
            "selected_model": {
                "name": "isolation-forest",
                "version": "1.2",
                "precision": 0.6614,
                "recall": 0.9438,
                "f1_score": 0.7778,
            },
            "provenance": {
                "training_period":
                    "2026-01-01/2026-06-30",

                "evaluation_period":
                    "2026-07-01/2026-07-31",
            },
            "generated_at":
                "2026-09-20T10:00:00+00:00",
        },
    )

    _write_json(
        paths["comparison"],
        {
            "experiments": [
                {
                    "model_name":
                        "isolation-forest",

                    "model_version":
                        "1.2",

                    "f1_score":
                        0.7778,
                },
                {
                    "model_name":
                        "isolation-forest",

                    "model_version":
                        "1.1",

                    "f1_score":
                        0.70,
                },
            ],
            "generated_at":
                "2026-09-20T10:05:00+00:00",
        },
    )

    _write_json(
        paths["incident"],
        {
            "incident_evaluation": {
                "true_positive_incidents":
                    5,

                "false_positive_incidents":
                    1,

                "detected_attack_instances":
                    5,

                "total_attack_instances":
                    5,
            },
            "provenance": {
                "ground_truth_batch":
                    "benchmark-seed-42",

                "ground_truth_policy":
                    "private evaluation only",
            },
            "generated_at":
                "2026-09-20T10:10:00+00:00",
        },
    )


# ============================================================
# Component writing
# ============================================================


@pytest.mark.unit
def test_write_evaluation_component_creates_directory_and_timestamp(
    isolated_registry_paths: dict[str, Path],
) -> None:
    path = (
        isolated_registry_paths[
            "selected"
        ]
    )

    registry.write_evaluation_component(
        path,
        {
            "selected_model": {
                "name":
                    "isolation-forest"
            }
        },
    )

    assert path.exists()

    payload = json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )

    assert (
        payload["selected_model"]["name"]
        == "isolation-forest"
    )

    assert "generated_at" in payload

    assert isinstance(
        payload["generated_at"],
        str,
    )


# ============================================================
# Missing-component detection
# ============================================================


@pytest.mark.unit
def test_missing_components_reports_only_absent_artifacts(
    isolated_registry_paths: dict[str, Path],
) -> None:
    paths = isolated_registry_paths

    _write_json(
        paths["selected"],
        {
            "selected_model": {}
        },
    )

    missing = registry.missing_components()

    assert missing == [
        "model comparison",
        "incident evaluation",
    ]


@pytest.mark.unit
def test_build_registry_refuses_missing_components(
    isolated_registry_paths: dict[str, Path],
) -> None:
    with pytest.raises(
        RuntimeError,
        match=(
            "Cannot build SENTINEL "
            "evaluation registry"
        ),
    ):
        registry.build_evaluation_registry()


# ============================================================
# Artifact loading failures
# ============================================================


@pytest.mark.unit
def test_load_json_rejects_invalid_json(
    isolated_registry_paths: dict[str, Path],
) -> None:
    invalid_path = (
        isolated_registry_paths[
            "selected"
        ]
    )

    invalid_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    invalid_path.write_text(
        "{this-is-not-json",
        encoding="utf-8",
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "Evaluation artifact "
            "could not be read"
        ),
    ):
        registry._load_json(
            invalid_path
        )


@pytest.mark.unit
def test_load_json_rejects_missing_file(
    isolated_registry_paths: dict[str, Path],
) -> None:
    missing_path = (
        isolated_registry_paths[
            "selected"
        ]
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "Evaluation artifact "
            "could not be read"
        ),
    ):
        registry._load_json(
            missing_path
        )


# ============================================================
# Canonical registry assembly
# ============================================================


@pytest.mark.unit
def test_build_evaluation_registry_assembles_canonical_payload(
    isolated_registry_paths: dict[str, Path],
) -> None:
    paths = isolated_registry_paths

    _write_complete_components(
        paths
    )

    result = (
        registry.build_evaluation_registry()
    )

    assert (
        result["registry_version"]
        == "1.1"
    )

    assert (
        result["selected_model"]["name"]
        == "isolation-forest"
    )

    assert (
        result["selected_model"]["version"]
        == "1.2"
    )

    assert (
        len(
            result["experiments"]
        )
        == 2
    )

    assert (
        result[
            "incident_evaluation"
        ][
            "detected_attack_instances"
        ]
        == 5
    )

    provenance = (
        result["provenance"]
    )

    assert (
        provenance[
            "ml_training_period"
        ]
        == "2026-01-01/2026-06-30"
    )

    assert (
        provenance[
            "ml_evaluation_period"
        ]
        == "2026-07-01/2026-07-31"
    )

    assert (
        provenance[
            "incident_ground_truth_batch"
        ]
        == "benchmark-seed-42"
    )

    assert (
        provenance[
            "ground_truth_policy"
        ]
        == "private evaluation only"
    )

    component_times = (
        result[
            "component_generated_at"
        ]
    )

    assert (
        component_times[
            "selected_model"
        ]
        == "2026-09-20T10:00:00+00:00"
    )

    assert (
        component_times[
            "model_comparison"
        ]
        == "2026-09-20T10:05:00+00:00"
    )

    assert (
        component_times[
            "incident_evaluation"
        ]
        == "2026-09-20T10:10:00+00:00"
    )

    assert (
        paths["registry"].exists()
    )

    persisted = json.loads(
        paths["registry"].read_text(
            encoding="utf-8"
        )
    )

    assert persisted == result


# ============================================================
# Automatic registry build
# ============================================================


@pytest.mark.unit
def test_try_build_registry_returns_missing_without_failure(
    isolated_registry_paths: dict[str, Path],
) -> None:
    built, missing = (
        registry.try_build_evaluation_registry()
    )

    assert built is False

    assert missing == [
        "selected model",
        "model comparison",
        "incident evaluation",
    ]


@pytest.mark.unit
def test_try_build_registry_builds_when_all_components_exist(
    isolated_registry_paths: dict[str, Path],
) -> None:
    paths = isolated_registry_paths

    _write_complete_components(
        paths
    )

    built, missing = (
        registry.try_build_evaluation_registry()
    )

    assert built is True
    assert missing == []

    assert (
        paths["registry"].exists()
    )


# ============================================================
# Generated timestamp format
# ============================================================


@pytest.mark.unit
def test_utc_now_iso_returns_timezone_aware_iso_timestamp() -> None:
    value = registry.utc_now_iso()

    # Python aware UTC ISO timestamps end in +00:00.
    assert value.endswith(
        "+00:00"
    )
