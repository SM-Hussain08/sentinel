from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AnomalyScore, Employee, Event
from app.services.feature_engineering import (
    extract_behavioral_features,
)


DETECTOR_NAME = "behavioral-baseline"
DETECTOR_VERSION = "1.0"
DETECTOR_TYPE = "heuristic"


def classify_risk(score: float) -> str:
    """
    Convert a normalized anomaly score into a dashboard risk level.

    These thresholds belong to the temporary baseline detector.
    They will later be calibrated using Isolation Forest output.
    """

    if score >= 0.85:
        return "CRITICAL"

    if score >= 0.65:
        return "HIGH"

    if score >= 0.40:
        return "MEDIUM"

    if score >= 0.20:
        return "LOW"

    return "NORMAL"


def calculate_behavioral_score(
    features: dict,
) -> tuple[float, list[str]]:
    """
    Produce an explainable temporary anomaly score.

    This is deliberately simple and transparent.

    It exists to validate SENTINEL's complete scoring pipeline before
    the heuristic logic is replaced by Isolation Forest.
    """

    score = 0.0
    reasons: list[str] = []

    if features["outside_work_hours"]:
        score += 0.25
        reasons.append(
            "Activity occurred outside the employee's normal working hours."
        )

    if features["unusual_source_ip"]:
        score += 0.30
        reasons.append(
            "The event originated from an IP address outside the employee's baseline."
        )

    if features["failed_operation"]:
        score += 0.15
        reasons.append(
            "The recorded operation was unsuccessful."
        )

    data_volume_ratio = float(
        features["data_volume_ratio"]
    )

    if data_volume_ratio >= 5:
        score += 0.30
        reasons.append(
            "Transferred data exceeded five times the employee's normal daily baseline."
        )

    elif data_volume_ratio >= 2:
        score += 0.22
        reasons.append(
            "Transferred data significantly exceeded the employee's normal baseline."
        )

    elif data_volume_ratio >= 1:
        score += 0.12
        reasons.append(
            "A single event transferred at least the employee's typical daily data volume."
        )

    if not reasons:
        reasons.append(
            "Activity is consistent with the employee's current behavioral baseline."
        )

    # Protect the normalized scale.
    normalized_score = min(
        round(score, 4),
        1.0,
    )

    return normalized_score, reasons


def analyze_event(
    db: Session,
    event: Event,
    employee: Employee,
) -> AnomalyScore:
    """
    Analyze one event and persist its anomaly result.

    If this exact detector version already analyzed the event,
    return the existing result instead of creating a duplicate.
    """

    existing_statement = select(
        AnomalyScore
    ).where(
        AnomalyScore.event_uuid == event.id,
        AnomalyScore.detector_name == DETECTOR_NAME,
        AnomalyScore.detector_version == DETECTOR_VERSION,
    )

    existing_score = db.scalar(
        existing_statement
    )

    if existing_score is not None:
        return existing_score

    features = extract_behavioral_features(
        event=event,
        employee=employee,
    )

    normalized_score, reasons = (
        calculate_behavioral_score(features)
    )

    risk_level = classify_risk(
        normalized_score
    )

    anomaly = AnomalyScore(
        event_uuid=event.id,
        detector_name=DETECTOR_NAME,
        detector_version=DETECTOR_VERSION,
        detector_type=DETECTOR_TYPE,
        raw_score=normalized_score,
        anomaly_score=normalized_score,
        risk_level=risk_level,
        feature_snapshot=features,
        explanation={
            "summary": (
                "Behavioral baseline analysis completed."
            ),
            "reasons": reasons,
        },
    )

    db.add(anomaly)

    db.commit()
    db.refresh(anomaly)

    return anomaly