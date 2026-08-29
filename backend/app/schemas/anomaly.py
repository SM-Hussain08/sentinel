from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class AnomalyRead(BaseModel):
    """
    API representation of one event anomaly-analysis result.
    """

    id: UUID

    event_id: str
    employee_user_id: str

    detector_name: str
    detector_version: str
    detector_type: str

    raw_score: float
    anomaly_score: float
    risk_level: str

    feature_snapshot: dict[str, Any]
    explanation: dict[str, Any]

    created_at: datetime