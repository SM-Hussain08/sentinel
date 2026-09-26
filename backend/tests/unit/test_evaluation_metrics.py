"""
Unit tests for SENTINEL evaluation mathematics.

These tests protect:
- anomaly percentile -> operational risk classification;
- event-level binary detection metrics;
- incident-level detection metrics.

No database or model artifact is required.
"""

from __future__ import annotations

import numpy as np
import pytest

from ml_engine.evaluation.incident_metrics import (
    calculate_incident_metrics,
)
from ml_engine.evaluation.metrics import (
    calculate_detection_metrics,
)
from ml_engine.evaluation.risk import (
    classify_ml_risk,
)


# ============================================================
# Risk classification boundaries
# ============================================================


@pytest.mark.unit
@pytest.mark.parametrize(
    (
        "score",
        "expected",
    ),
    [
        (1.00, "CRITICAL"),
        (0.99, "CRITICAL"),
        (0.989999, "HIGH"),
        (0.98, "HIGH"),
        (0.979999, "MEDIUM"),
        (0.95, "MEDIUM"),
        (0.949999, "LOW"),
        (0.90, "LOW"),
        (0.899999, "NORMAL"),
        (0.00, "NORMAL"),
    ],
)
def test_ml_risk_threshold_boundaries(
    score: float,
    expected: str,
) -> None:
    assert classify_ml_risk(
        score
    ) == expected


# ============================================================
# Event-level detection metrics
# ============================================================


@pytest.mark.unit
def test_detection_metrics_for_perfect_predictions() -> None:
    y_true = np.array(
        [0, 0, 1, 1]
    )

    y_pred = np.array(
        [0, 0, 1, 1]
    )

    metrics = calculate_detection_metrics(
        y_true,
        y_pred,
    )

    assert metrics.true_positives == 2
    assert metrics.false_positives == 0
    assert metrics.true_negatives == 2
    assert metrics.false_negatives == 0

    assert metrics.precision == pytest.approx(
        1.0
    )

    assert metrics.recall == pytest.approx(
        1.0
    )

    assert metrics.f1_score == pytest.approx(
        1.0
    )

    assert metrics.false_positive_rate == pytest.approx(
        0.0
    )


@pytest.mark.unit
def test_detection_metrics_for_mixed_predictions() -> None:
    """
    Confusion matrix:

        TN = 3
        FP = 1
        FN = 2
        TP = 2
    """

    y_true = np.array(
        [
            0,
            0,
            0,
            0,
            1,
            1,
            1,
            1,
        ]
    )

    y_pred = np.array(
        [
            0,
            0,
            0,
            1,
            1,
            1,
            0,
            0,
        ]
    )

    metrics = calculate_detection_metrics(
        y_true,
        y_pred,
    )

    assert metrics.true_negatives == 3
    assert metrics.false_positives == 1
    assert metrics.false_negatives == 2
    assert metrics.true_positives == 2

    # TP / (TP + FP) = 2 / 3
    assert metrics.precision == pytest.approx(
        2 / 3
    )

    # TP / (TP + FN) = 2 / 4
    assert metrics.recall == pytest.approx(
        0.5
    )

    # harmonic mean of precision and recall
    assert metrics.f1_score == pytest.approx(
        4 / 7
    )

    # FP / (TN + FP) = 1 / 4
    assert metrics.false_positive_rate == pytest.approx(
        0.25
    )


@pytest.mark.unit
def test_detection_metrics_handle_no_positive_predictions() -> None:
    y_true = np.array(
        [0, 0, 1, 1]
    )

    y_pred = np.array(
        [0, 0, 0, 0]
    )

    metrics = calculate_detection_metrics(
        y_true,
        y_pred,
    )

    assert metrics.true_negatives == 2
    assert metrics.false_positives == 0
    assert metrics.false_negatives == 2
    assert metrics.true_positives == 0

    assert metrics.precision == pytest.approx(
        0.0
    )

    assert metrics.recall == pytest.approx(
        0.0
    )

    assert metrics.f1_score == pytest.approx(
        0.0
    )

    assert metrics.false_positive_rate == pytest.approx(
        0.0
    )


@pytest.mark.unit
def test_detection_metrics_handle_no_normal_events() -> None:
    """
    With no normal ground-truth events, FPR denominator is zero and
    SENTINEL intentionally reports 0.0 rather than dividing by zero.
    """

    y_true = np.array(
        [1, 1, 1]
    )

    y_pred = np.array(
        [1, 0, 1]
    )

    metrics = calculate_detection_metrics(
        y_true,
        y_pred,
    )

    assert metrics.true_negatives == 0
    assert metrics.false_positives == 0
    assert metrics.false_negatives == 1
    assert metrics.true_positives == 2

    assert metrics.false_positive_rate == pytest.approx(
        0.0
    )


# ============================================================
# Incident-level metrics
# ============================================================


@pytest.mark.unit
def test_incident_metrics_calculate_precision_recall_and_f1() -> None:
    metrics = calculate_incident_metrics(
        true_positive_incidents=8,
        false_positive_incidents=2,
        detected_attack_instances=9,
        total_attack_instances=10,
    )

    assert metrics.true_positive_incidents == 8
    assert metrics.false_positive_incidents == 2
    assert metrics.detected_attack_instances == 9
    assert metrics.total_attack_instances == 10

    assert metrics.precision == pytest.approx(
        0.8
    )

    assert metrics.recall == pytest.approx(
        0.9
    )

    expected_f1 = (
        2
        * 0.8
        * 0.9
        / (
            0.8
            + 0.9
        )
    )

    assert metrics.f1_score == pytest.approx(
        expected_f1
    )


@pytest.mark.unit
def test_incident_metrics_handle_zero_denominators() -> None:
    metrics = calculate_incident_metrics(
        true_positive_incidents=0,
        false_positive_incidents=0,
        detected_attack_instances=0,
        total_attack_instances=0,
    )

    assert metrics.precision == pytest.approx(
        0.0
    )

    assert metrics.recall == pytest.approx(
        0.0
    )

    assert metrics.f1_score == pytest.approx(
        0.0
    )


@pytest.mark.unit
def test_incident_metrics_zero_precision_produces_zero_f1() -> None:
    metrics = calculate_incident_metrics(
        true_positive_incidents=0,
        false_positive_incidents=5,
        detected_attack_instances=0,
        total_attack_instances=4,
    )

    assert metrics.precision == pytest.approx(
        0.0
    )

    assert metrics.recall == pytest.approx(
        0.0
    )

    assert metrics.f1_score == pytest.approx(
        0.0
    )
