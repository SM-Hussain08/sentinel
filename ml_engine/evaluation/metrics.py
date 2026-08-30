from dataclasses import dataclass

import numpy as np
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


@dataclass(frozen=True)
class DetectionMetrics:
    """
    Standard evaluation metrics for a SENTINEL anomaly detector.
    """

    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int

    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float


def calculate_detection_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> DetectionMetrics:
    """
    Calculate binary anomaly-detection metrics.

    Ground-truth labels are used only for post-prediction evaluation.
    """

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        y_pred,
        labels=[
            0,
            1,
        ],
    ).ravel()

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

    normal_count = (
        tn + fp
    )

    false_positive_rate = (
        fp / normal_count
        if normal_count
        else 0.0
    )

    return DetectionMetrics(
        true_positives=int(tp),
        false_positives=int(fp),
        true_negatives=int(tn),
        false_negatives=int(fn),
        precision=float(precision),
        recall=float(recall),
        f1_score=float(f1),
        false_positive_rate=float(
            false_positive_rate
        ),
    )