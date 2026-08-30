import json
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from sqlalchemy import (
    desc,
    func,
    select,
)
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models import (
    AnomalyScore,
    Employee,
    Event,
)
from app.schemas.ml import (
    MLAnomalyRead,
    MLEventAnalysis,
    MLModelInfo,
    MLRiskDistribution,
    MLSummary,
)


router = APIRouter(
    prefix="/ml",
    tags=[
        "Machine Learning",
    ],
)


DETECTOR_NAME = "isolation-forest"
DETECTOR_VERSION = "1.1"


PROJECT_ROOT = (
    Path(__file__).resolve().parents[3]
)


MODEL_MANIFEST_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "models"
    / "artifacts"
    / "sentinel_iforest_v1_1_manifest.json"
)


@router.get(
    "/model",
    response_model=MLModelInfo,
)
def get_model_info() -> MLModelInfo:
    if not MODEL_MANIFEST_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "Selected ML model manifest "
                "is not available."
            ),
        )

    manifest = json.loads(
        MODEL_MANIFEST_PATH.read_text(
            encoding="utf-8",
        )
    )

    metrics = manifest[
        "metrics"
    ]

    return MLModelInfo(
        model_name=manifest[
            "model_name"
        ],

        model_version=manifest[
            "model_version"
        ],

        algorithm=manifest[
            "algorithm"
        ],

        feature_count=manifest[
            "feature_count"
        ],

        training_rows=manifest[
            "training_rows"
        ],

        evaluation_rows=manifest[
            "evaluation_rows"
        ],

        threshold_percentile=(
            manifest[
                "threshold_percentile"
            ]
        ),

        precision=metrics[
            "precision"
        ],

        recall=metrics[
            "recall"
        ],

        f1_score=metrics[
            "f1_score"
        ],

        false_positive_rate=metrics[
            "false_positive_rate"
        ],
    )


@router.get(
    "/summary",
    response_model=MLSummary,
)
def get_ml_summary(
    db: Session = Depends(
        get_db
    ),
) -> MLSummary:
    base_filters = (
        AnomalyScore.detector_name
        == DETECTOR_NAME,
        AnomalyScore.detector_version
        == DETECTOR_VERSION,
    )

    events_scored = int(
        db.scalar(
            select(
                func.count(
                    AnomalyScore.id
                )
            )
            .where(
                *base_filters
            )
        )
        or 0
    )

    average_score = float(
        db.scalar(
            select(
                func.avg(
                    AnomalyScore.anomaly_score
                )
            )
            .where(
                *base_filters
            )
        )
        or 0.0
    )

    highest_score = float(
        db.scalar(
            select(
                func.max(
                    AnomalyScore.anomaly_score
                )
            )
            .where(
                *base_filters
            )
        )
        or 0.0
    )

    risk_rows = db.execute(
        select(
            AnomalyScore.risk_level,
            func.count(
                AnomalyScore.id
            ),
        )
        .where(
            *base_filters
        )
        .group_by(
            AnomalyScore.risk_level
        )
    ).all()

    risk_map = {
        risk_level: count
        for (
            risk_level,
            count,
        )
        in risk_rows
    }

    alert_count = int(
        risk_map.get(
            "CRITICAL",
            0,
        )
    )

    return MLSummary(
        detector_name=DETECTOR_NAME,
        detector_version=DETECTOR_VERSION,

        events_scored=events_scored,
        alert_count=alert_count,

        average_score=average_score,
        highest_score=highest_score,

        risk_distribution=(
            MLRiskDistribution(
                normal=int(
                    risk_map.get(
                        "NORMAL",
                        0,
                    )
                ),

                low=int(
                    risk_map.get(
                        "LOW",
                        0,
                    )
                ),

                medium=int(
                    risk_map.get(
                        "MEDIUM",
                        0,
                    )
                ),

                high=int(
                    risk_map.get(
                        "HIGH",
                        0,
                    )
                ),

                critical=int(
                    risk_map.get(
                        "CRITICAL",
                        0,
                    )
                ),
            )
        ),
    )


@router.get(
    "/anomalies",
    response_model=list[
        MLAnomalyRead
    ],
)
def get_ml_anomalies(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),

    db: Session = Depends(
        get_db
    ),
) -> list[MLAnomalyRead]:
    rows = db.execute(
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
            AnomalyScore.detector_name
            == DETECTOR_NAME,

            AnomalyScore.detector_version
            == DETECTOR_VERSION,

            AnomalyScore.risk_level
            != "NORMAL",
        )
        .order_by(
            desc(
                AnomalyScore.anomaly_score
            ),
            desc(
                Event.timestamp
            ),
        )
        .limit(
            limit
        )
    ).all()

    return [
        MLAnomalyRead(
            score_id=score.id,

            event_id=event.event_id,

            employee_user_id=(
                employee.user_id
            ),

            timestamp=event.timestamp,
            event_type=event.event_type,

            anomaly_score=(
                score.anomaly_score
            ),

            raw_score=score.raw_score,

            risk_level=(
                score.risk_level
            ),

            alert_threshold_reached=bool(
                score.explanation.get(
                    "alert_threshold_reached",
                    False,
                )
            ),

            feature_snapshot=(
                score.feature_snapshot
            ),

            explanation=(
                score.explanation
            ),
        )

        for (
            score,
            event,
            employee,
        )
        in rows
    ]


@router.get(
    "/events/{event_id}",
    response_model=MLEventAnalysis,
)
def get_event_ml_analysis(
    event_id: str,
    db: Session = Depends(
        get_db
    ),
) -> MLEventAnalysis:
    row = db.execute(
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
            Event.event_id
            == event_id,

            AnomalyScore.detector_name
            == DETECTOR_NAME,

            AnomalyScore.detector_version
            == DETECTOR_VERSION,
        )
    ).first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "ML analysis was not found "
                "for this event."
            ),
        )

    score, event, employee = row

    return MLEventAnalysis(
        event_id=event.event_id,

        employee_user_id=(
            employee.user_id
        ),

        timestamp=event.timestamp,
        event_type=event.event_type,

        detector_name=(
            score.detector_name
        ),

        detector_version=(
            score.detector_version
        ),

        raw_score=score.raw_score,

        anomaly_score=(
            score.anomaly_score
        ),

        risk_level=(
            score.risk_level
        ),

        alert_threshold_reached=bool(
            score.explanation.get(
                "alert_threshold_reached",
                False,
            )
        ),

        feature_snapshot=(
            score.feature_snapshot
        ),

        explanation=(
            score.explanation
        ),
    )