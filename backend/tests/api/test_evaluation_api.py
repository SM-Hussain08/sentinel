"""
FastAPI contract tests for SENTINEL's evaluation intelligence API.

The evaluation endpoint is file-backed and intentionally separate from
the operational detection pipeline.

These tests verify:
- canonical registry + benchmark assembly;
- missing-artifact 503 behavior;
- malformed-artifact 500 behavior;
- benchmark field selection;
- schema validation of the resulting public contract.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

import app.api.evaluation as evaluation_api


# ============================================================
# Helpers
# ============================================================


def _registry_payload() -> dict:
    return {
        "registry_version":
            "1.0",

        "generated_at":
            "2026-09-22T12:00:00+00:00",

        "selected_model": {
            "name":
                "Isolation Forest v1.2",

            "detector_name":
                "isolation-forest",

            "version":
                "1.2",

            "feature_count":
                17,

            "training_rows":
                12_000,

            "evaluation_rows":
                3_000,

            "precision":
                0.91,

            "recall":
                0.88,

            "f1_score":
                0.895,

            "false_positive_rate":
                0.012,

            "false_positives":
                14,

            "threshold_percentile":
                0.99,
        },

        "experiments": [
            {
                "name":
                    "Isolation Forest v1.2",

                "version":
                    "1.2",

                "feature_count":
                    17,

                "precision":
                    0.91,

                "recall":
                    0.88,

                "f1_score":
                    0.895,

                "false_positive_rate":
                    0.012,

                "false_positives":
                    14,

                "alerts":
                    128,

                "selected":
                    True,

                "decision":
                    "Promoted production detector.",
            },
            {
                "name":
                    "Isolation Forest v1.1",

                "version":
                    "1.1",

                "feature_count":
                    15,

                "precision":
                    0.86,

                "recall":
                    0.84,

                "f1_score":
                    0.85,

                "false_positive_rate":
                    0.021,

                "false_positives":
                    24,

                "alerts":
                    141,

                "selected":
                    False,

                "decision":
                    "Not selected.",
            },
        ],

        "incident_evaluation": {
            "true_positive_incidents":
                9,

            "false_positive_incidents":
                1,

            "attack_instances_detected":
                9,

            "attack_instances_total":
                10,

            "precision":
                0.90,

            "recall":
                0.90,

            "f1_score":
                0.90,

            "timeline_events_recovered":
                45,

            "timeline_events_total":
                50,

            "timeline_recovery_rate":
                0.90,
        },

        "provenance": {
            "ml_training_period":
                "2026-01-01 to 2026-01-31",

            "ml_evaluation_period":
                "2026-02-01 to 2026-02-07",

            "incident_ground_truth_batch":
                "benchmark-batch-001",

            "ground_truth_policy":
                "Evaluation-only isolated ground truth.",
        },

        "component_generated_at": {
            "selected_model":
                "2026-09-22T11:00:00+00:00",

            "model_comparison":
                "2026-09-22T11:05:00+00:00",

            "incident_evaluation":
                "2026-09-22T11:10:00+00:00",
        },
    }


def _benchmark_payload() -> dict:
    return {
        "benchmark": {
            "name":
                "sentinel-controlled-benchmark",

            "status":
                "completed",

            "seed":
                42,

            "reproducible":
                True,

            "database_isolation":
                "sentinel_benchmark",

            "generated_at":
                "2026-09-22T12:30:00+00:00",

            "elapsed_seconds":
                18.4,

            # Intentionally private/unpublished-looking field.
            # The API must not copy this into the response.
            "internal_debug":
                "DO-NOT-EXPOSE",
        },

        "dataset": {
            "employees":
                300,

            "normal_events":
                10_000,

            "attack_events":
                500,

            "total_events":
                10_500,

            "attack_instances":
                10,
        },

        "operational_scoring": {
            "scored_events":
                10_500,

            "risk_distribution": {
                "NORMAL":
                    9_800,

                "LOW":
                    300,

                "MEDIUM":
                    200,

                "HIGH":
                    120,

                "CRITICAL":
                    80,
            },
        },

        "incident_correlation": {
            "total":
                10,

            "severity_distribution": {
                "HIGH":
                    4,

                "CRITICAL":
                    6,
            },
        },

        "canonical_signature": {
            "employees":
                300,

            "events":
                10_500,

            "selected_experiment":
                "isolation-forest-v1.2",

            "selected_detector":
                "isolation-forest:1.2",

            "model_f1":
                0.895,

            "critical_scores":
                80,

            "incidents":
                10,

            "attack_instances_recovered":
                9,

            "timeline_events_recovered":
                45,

            "incident_precision":
                0.90,

            "incident_recall":
                0.90,
        },

        # Another field not part of the public benchmark schema.
        "private_notes": {
            "secret":
                "DO-NOT-EXPOSE"
        },
    }


def _write_json(
    path,
    payload: dict,
) -> None:
    path.write_text(
        json.dumps(
            payload
        ),
        encoding="utf-8",
    )


# ============================================================
# Successful public contract
# ============================================================


@pytest.mark.api
def test_evaluation_summary_combines_registry_and_benchmark(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    registry_path = (
        tmp_path
        / "evaluation_registry.json"
    )

    benchmark_path = (
        tmp_path
        / "benchmark_report.json"
    )

    _write_json(
        registry_path,
        _registry_payload(),
    )

    _write_json(
        benchmark_path,
        _benchmark_payload(),
    )

    monkeypatch.setattr(
        evaluation_api,
        "REGISTRY_PATH",
        registry_path,
    )

    monkeypatch.setattr(
        evaluation_api,
        "BENCHMARK_REPORT_PATH",
        benchmark_path,
    )

    response = client.get(
        "/api/v1/evaluation/summary"
    )

    assert response.status_code == 200

    payload = response.json()

    # --------------------------------------------------------
    # Registry
    # --------------------------------------------------------

    assert (
        payload[
            "registry_version"
        ]
        == "1.0"
    )

    assert (
        payload[
            "selected_model"
        ][
            "detector_name"
        ]
        == "isolation-forest"
    )

    assert (
        payload[
            "selected_model"
        ][
            "version"
        ]
        == "1.2"
    )

    assert (
        payload[
            "selected_model"
        ][
            "f1_score"
        ]
        == pytest.approx(
            0.895
        )
    )

    assert len(
        payload[
            "experiments"
        ]
    ) == 2

    assert (
        payload[
            "experiments"
        ][0][
            "selected"
        ]
        is True
    )

    assert (
        payload[
            "incident_evaluation"
        ][
            "attack_instances_detected"
        ]
        == 9
    )

    assert (
        payload[
            "incident_evaluation"
        ][
            "timeline_recovery_rate"
        ]
        == pytest.approx(
            0.90
        )
    )

    assert (
        payload[
            "provenance"
        ][
            "ground_truth_policy"
        ]
        == (
            "Evaluation-only isolated "
            "ground truth."
        )
    )

    # --------------------------------------------------------
    # Controlled benchmark
    # --------------------------------------------------------

    benchmark = payload[
        "benchmark"
    ]

    assert (
        benchmark[
            "name"
        ]
        == "sentinel-controlled-benchmark"
    )

    assert (
        benchmark[
            "status"
        ]
        == "completed"
    )

    assert (
        benchmark[
            "seed"
        ]
        == 42
    )

    assert (
        benchmark[
            "reproducible"
        ]
        is True
    )

    assert (
        benchmark[
            "database_isolation"
        ]
        == "sentinel_benchmark"
    )

    assert (
        benchmark[
            "dataset"
        ][
            "total_events"
        ]
        == 10_500
    )

    assert (
        benchmark[
            "operational_scoring"
        ][
            "scored_events"
        ]
        == 10_500
    )

    assert (
        benchmark[
            "incident_correlation"
        ][
            "total"
        ]
        == 10
    )

    assert (
        benchmark[
            "canonical_signature"
        ][
            "attack_instances_recovered"
        ]
        == 9
    )


# ============================================================
# Explicit benchmark output selection
# ============================================================


@pytest.mark.api
def test_evaluation_summary_does_not_expose_unselected_benchmark_fields(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    registry_path = (
        tmp_path
        / "evaluation_registry.json"
    )

    benchmark_path = (
        tmp_path
        / "benchmark_report.json"
    )

    _write_json(
        registry_path,
        _registry_payload(),
    )

    _write_json(
        benchmark_path,
        _benchmark_payload(),
    )

    monkeypatch.setattr(
        evaluation_api,
        "REGISTRY_PATH",
        registry_path,
    )

    monkeypatch.setattr(
        evaluation_api,
        "BENCHMARK_REPORT_PATH",
        benchmark_path,
    )

    response = client.get(
        "/api/v1/evaluation/summary"
    )

    assert response.status_code == 200

    serialized = response.text

    assert (
        "DO-NOT-EXPOSE"
        not in serialized
    )

    assert (
        "internal_debug"
        not in serialized
    )

    assert (
        "private_notes"
        not in serialized
    )


# ============================================================
# Missing artifacts
# ============================================================


@pytest.mark.api
def test_evaluation_summary_returns_503_when_registry_missing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    missing_registry = (
        tmp_path
        / "missing-registry.json"
    )

    benchmark_path = (
        tmp_path
        / "benchmark_report.json"
    )

    _write_json(
        benchmark_path,
        _benchmark_payload(),
    )

    monkeypatch.setattr(
        evaluation_api,
        "REGISTRY_PATH",
        missing_registry,
    )

    monkeypatch.setattr(
        evaluation_api,
        "BENCHMARK_REPORT_PATH",
        benchmark_path,
    )

    response = client.get(
        "/api/v1/evaluation/summary"
    )

    assert response.status_code == 503

    assert response.json() == {
        "detail": (
            "SENTINEL evaluation registry "
            "is unavailable."
        )
    }


@pytest.mark.api
def test_evaluation_summary_returns_503_when_benchmark_missing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    registry_path = (
        tmp_path
        / "evaluation_registry.json"
    )

    missing_benchmark = (
        tmp_path
        / "missing-benchmark.json"
    )

    _write_json(
        registry_path,
        _registry_payload(),
    )

    monkeypatch.setattr(
        evaluation_api,
        "REGISTRY_PATH",
        registry_path,
    )

    monkeypatch.setattr(
        evaluation_api,
        "BENCHMARK_REPORT_PATH",
        missing_benchmark,
    )

    response = client.get(
        "/api/v1/evaluation/summary"
    )

    assert response.status_code == 503

    assert response.json() == {
        "detail": (
            "SENTINEL benchmark report "
            "is unavailable."
        )
    }


# ============================================================
# Malformed artifacts
# ============================================================


@pytest.mark.api
def test_evaluation_summary_returns_500_when_registry_is_invalid_json(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    registry_path = (
        tmp_path
        / "evaluation_registry.json"
    )

    benchmark_path = (
        tmp_path
        / "benchmark_report.json"
    )

    registry_path.write_text(
        "{ definitely-not-json",
        encoding="utf-8",
    )

    _write_json(
        benchmark_path,
        _benchmark_payload(),
    )

    monkeypatch.setattr(
        evaluation_api,
        "REGISTRY_PATH",
        registry_path,
    )

    monkeypatch.setattr(
        evaluation_api,
        "BENCHMARK_REPORT_PATH",
        benchmark_path,
    )

    response = client.get(
        "/api/v1/evaluation/summary"
    )

    assert response.status_code == 500

    assert response.json() == {
        "detail": (
            "SENTINEL evaluation registry "
            "could not be loaded."
        )
    }


@pytest.mark.api
def test_evaluation_summary_returns_500_when_benchmark_is_invalid_json(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    registry_path = (
        tmp_path
        / "evaluation_registry.json"
    )

    benchmark_path = (
        tmp_path
        / "benchmark_report.json"
    )

    _write_json(
        registry_path,
        _registry_payload(),
    )

    benchmark_path.write_text(
        "{ broken-benchmark-json",
        encoding="utf-8",
    )

    monkeypatch.setattr(
        evaluation_api,
        "REGISTRY_PATH",
        registry_path,
    )

    monkeypatch.setattr(
        evaluation_api,
        "BENCHMARK_REPORT_PATH",
        benchmark_path,
    )

    response = client.get(
        "/api/v1/evaluation/summary"
    )

    assert response.status_code == 500

    assert response.json() == {
        "detail": (
            "SENTINEL benchmark report "
            "could not be loaded."
        )
    }
