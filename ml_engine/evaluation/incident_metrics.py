from dataclasses import dataclass


@dataclass(frozen=True)
class IncidentDetectionMetrics:
    """
    Incident-level detection metrics.

    A true-positive incident overlaps at least one controlled
    ground-truth attack instance.

    A false-positive incident contains no controlled attack events.
    """

    true_positive_incidents: int
    false_positive_incidents: int

    detected_attack_instances: int
    total_attack_instances: int

    precision: float
    recall: float
    f1_score: float


def calculate_incident_metrics(
    *,
    true_positive_incidents: int,
    false_positive_incidents: int,
    detected_attack_instances: int,
    total_attack_instances: int,
) -> IncidentDetectionMetrics:
    precision_denominator = (
        true_positive_incidents
        + false_positive_incidents
    )

    precision = (
        true_positive_incidents
        / precision_denominator
        if precision_denominator
        else 0.0
    )

    recall = (
        detected_attack_instances
        / total_attack_instances
        if total_attack_instances
        else 0.0
    )

    f1 = (
        2
        * precision
        * recall
        / (
            precision
            + recall
        )
        if (
            precision
            + recall
        )
        else 0.0
    )

    return IncidentDetectionMetrics(
        true_positive_incidents=(
            true_positive_incidents
        ),

        false_positive_incidents=(
            false_positive_incidents
        ),

        detected_attack_instances=(
            detected_attack_instances
        ),

        total_attack_instances=(
            total_attack_instances
        ),

        precision=precision,
        recall=recall,
        f1_score=f1,
    )