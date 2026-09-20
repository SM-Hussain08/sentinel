"""
Selected-detector anomaly API for SENTINEL.

All operational anomaly endpoints expose results from SENTINEL's currently
promoted production detector only.

Historical detector rows may remain in PostgreSQL for comparison and
development history, but they are not mixed into operational API responses.
"""

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.dependencies import (
    get_db,
)
from app.models import (
    AnomalyScore,
    Employee,
    Event,
)
from app.schemas import (
    AnomalyRead,
)
from app.selected_detector import (
    SELECTED_DETECTOR,
)
from app.services.ml_scoring import (
    score_event,
)


router = APIRouter(
    prefix="/anomalies",
    tags=[
        "Anomalies",
    ],
)


# ============================================================
# Selected-detector anomaly feed
# ============================================================

@router.get(
    "",
    response_model=list[
        AnomalyRead
    ],
)
def list_anomalies(
    db: Session = Depends(
        get_db
    ),
) -> list[
    AnomalyRead
]:
    """
    Return anomaly-analysis results from SENTINEL's selected production
    detector, ordered from most anomalous to least anomalous.

    Historical rows from retired or experimental detectors are deliberately
    excluded from the operational feed.
    """

    statement = (
        select(
            AnomalyScore,
            Event.event_id,
            Employee.user_id,
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
            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
        .order_by(
            AnomalyScore
            .anomaly_score
            .desc()
        )
    )

    rows = db.execute(
        statement
    ).all()

    return [
        AnomalyRead(
            id=anomaly.id,

            event_id=(
                event_id
            ),

            employee_user_id=(
                user_id
            ),

            detector_name=(
                anomaly.detector_name
            ),

            detector_version=(
                anomaly.detector_version
            ),

            detector_type=(
                anomaly.detector_type
            ),

            raw_score=(
                anomaly.raw_score
            ),

            anomaly_score=(
                anomaly.anomaly_score
            ),

            risk_level=(
                anomaly.risk_level
            ),

            feature_snapshot=(
                anomaly.feature_snapshot
            ),

            explanation=(
                anomaly.explanation
            ),

            created_at=(
                anomaly.created_at
            ),
        )
        for (
            anomaly,
            event_id,
            user_id,
        )
        in rows
    ]


# ============================================================
# Incremental event analysis
# ============================================================

@router.post(
    "/analyze/{event_id}",
    response_model=AnomalyRead,
)
def analyze_event_endpoint(
    event_id: str,
    db: Session = Depends(
        get_db
    ),
) -> AnomalyRead:
    """
    Analyze one stored event with SENTINEL's selected Isolation Forest.

    If the event already has a result from the selected detector version,
    the existing result is returned instead of creating a duplicate.

    Simulator ground-truth metadata is not supplied to the operational
    scoring path.
    """

    statement = (
        select(
            Event,
            Employee,
        )
        .join(
            Employee,
            Event.employee_id
            == Employee.id,
        )
        .where(
            Event.event_id
            == event_id
        )
    )

    result = db.execute(
        statement
    ).first()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Event '{event_id}' "
                "was not found."
            ),
        )

    event, employee = result

    try:
        anomaly = (
            score_event(
                db=db,
                event=event,
                employee=employee,
            )
        )

        db.commit()
        db.refresh(
            anomaly
        )

    except Exception:
        db.rollback()
        raise

    return AnomalyRead(
        id=anomaly.id,

        event_id=(
            event.event_id
        ),

        employee_user_id=(
            employee.user_id
        ),

        detector_name=(
            anomaly.detector_name
        ),

        detector_version=(
            anomaly.detector_version
        ),

        detector_type=(
            anomaly.detector_type
        ),

        raw_score=(
            anomaly.raw_score
        ),

        anomaly_score=(
            anomaly.anomaly_score
        ),

        risk_level=(
            anomaly.risk_level
        ),

        feature_snapshot=(
            anomaly.feature_snapshot
        ),

        explanation=(
            anomaly.explanation
        ),

        created_at=(
            anomaly.created_at
        ),
    )