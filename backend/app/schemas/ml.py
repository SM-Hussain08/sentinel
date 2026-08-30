from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class MLModelInfo(BaseModel):
    model_name: str
    model_version: str
    algorithm: str

    feature_count: int
    training_rows: int
    evaluation_rows: int

    threshold_percentile: float

    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float


class MLRiskDistribution(BaseModel):
    normal: int
    low: int
    medium: int
    high: int
    critical: int


class MLSummary(BaseModel):
    detector_name: str
    detector_version: str

    events_scored: int
    alert_count: int

    average_score: float
    highest_score: float

    risk_distribution: MLRiskDistribution


class MLAnomalyRead(BaseModel):
    score_id: UUID

    event_id: str
    employee_user_id: str

    timestamp: datetime
    event_type: str

    anomaly_score: float
    raw_score: float
    risk_level: str

    alert_threshold_reached: bool

    feature_snapshot: dict[str, Any]
    explanation: dict[str, Any]


class MLEventAnalysis(BaseModel):
    event_id: str
    employee_user_id: str

    timestamp: datetime
    event_type: str

    detector_name: str
    detector_version: str

    raw_score: float
    anomaly_score: float
    risk_level: str

    alert_threshold_reached: bool

    feature_snapshot: dict[str, Any]
    explanation: dict[str, Any]