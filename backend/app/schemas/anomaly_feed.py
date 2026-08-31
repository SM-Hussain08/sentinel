from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class MLAnomalyFeedItem(BaseModel):
    score_id: UUID

    event_id: str
    employee_user_id: str

    timestamp: datetime
    event_type: str

    anomaly_score: float
    raw_score: float

    risk_level: str

    alert_threshold_reached: bool

    feature_snapshot:dict[str, Any]

    explanation:dict[str, Any]


class MLAnomalyFeedPage(BaseModel):
    items:list[MLAnomalyFeedItem]

    total: int

    limit: int
    offset: int

    has_previous: bool
    has_next: bool