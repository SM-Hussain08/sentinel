from fastapi import (
    APIRouter,
    Depends,
    Query,
)
from sqlalchemy import (
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.database.dependencies import (
    get_db,
)

from app.models import (
    AnomalyScore,
    Employee,
    Event,
)

from app.schemas.anomaly_feed import (
    MLAnomalyFeedItem,
    MLAnomalyFeedPage,
)

from app.selected_detector import (
    SELECTED_DETECTOR,
)


router = APIRouter(
    prefix="/ml",
    tags=[
        "Machine Learning",
    ],
)


ALLOWED_RISK_LEVELS = {
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
}


@router.get(
    "/anomalies/paged",
    response_model=MLAnomalyFeedPage,
)
def get_paginated_ml_anomalies(
    risk_level: str | None = Query(
        default=None,
    ),

    search: str | None = Query(
        default=None,
        max_length=120,
    ),

    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),

    offset: int = Query(
        default=0,
        ge=0,
    ),

    db: Session = Depends(
        get_db
    ),
) -> MLAnomalyFeedPage:
    normalized_risk = (
        risk_level.upper()
        if risk_level
        else None
    )

    if (
        normalized_risk
        and normalized_risk
        not in ALLOWED_RISK_LEVELS
    ):
        normalized_risk = None

    base_conditions = [
        AnomalyScore.detector_name
        == SELECTED_DETECTOR.name,

        AnomalyScore.detector_version
        == SELECTED_DETECTOR.version,

        AnomalyScore.risk_level
        != "NORMAL",
    ]

    if normalized_risk:
        base_conditions.append(
            AnomalyScore.risk_level
            == normalized_risk
        )

    normalized_search = (
        search.strip()
        if search
        else ""
    )

    search_condition = None

    if normalized_search:
        pattern = (
            f"%{normalized_search}%"
        )

        search_condition = or_(
            Event.event_id.ilike(
                pattern
            ),

            Event.event_type.ilike(
                pattern
            ),

            Employee.user_id.ilike(
                pattern
            ),
        )

    count_query = (
        select(
            func.count(
                AnomalyScore.id
            )
        )
        .select_from(
            AnomalyScore
        )
        .join(
            Event,
            AnomalyScore.event_uuid
            == Event.id,
        )
        .join(
            Employee,
            Event.employee_id
            == Employee.id,
        )
        .where(
            *base_conditions
        )
    )

    if search_condition is not None:
        count_query = (
            count_query.where(
                search_condition
            )
        )

    total = int(
        db.scalar(
            count_query
        )
        or 0
    )

    data_query = (
        select(
            AnomalyScore,
            Event,
            Employee,
        )
        .join(
            Event,
            AnomalyScore.event_uuid
            == Event.id,
        )
        .join(
            Employee,
            Event.employee_id
            == Employee.id,
        )
        .where(
            *base_conditions
        )
    )

    if search_condition is not None:
        data_query = (
            data_query.where(
                search_condition
            )
        )

    rows = db.execute(
        data_query
        .order_by(
            AnomalyScore
            .anomaly_score
            .desc(),

            Event.timestamp.desc(),
        )
        .offset(
            offset
        )
        .limit(
            limit
        )
    ).all()

    items = [
        MLAnomalyFeedItem(
            score_id=(
                anomaly.id
            ),

            event_id=(
                event.event_id
            ),

            employee_user_id=(
                employee.user_id
            ),

            timestamp=(
                event.timestamp
            ),

            event_type=(
                event.event_type
            ),

            anomaly_score=(
                anomaly.anomaly_score
            ),

            raw_score=(
                anomaly.raw_score
            ),

            risk_level=(
                anomaly.risk_level
            ),

            alert_threshold_reached=(
                bool(
                    anomaly.explanation.get(
                        "alert_threshold_reached",
                        False,
                    )
                )
            ),

            feature_snapshot=(
                anomaly.feature_snapshot
                or {}
            ),

            explanation=(
                anomaly.explanation
                or {}
            ),
        )

        for (
            anomaly,
            event,
            employee,
        )
        in rows
    ]

    return MLAnomalyFeedPage(
        items=items,

        total=total,

        limit=limit,
        offset=offset,

        has_previous=(
            offset > 0
        ),

        has_next=(
            offset
            + len(items)
            < total
        ),
    )