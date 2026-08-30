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

from app.database.dependencies import (
    get_db,
)

from app.models import (
    AnomalyScore,
    Employee,
    Event,
    Incident,
    IncidentEvent,
)

from app.schemas.incident import (
    IncidentDetail,
    IncidentInvestigation,
    IncidentListItem,
    IncidentSeverityDistribution,
    IncidentSummary,
    IncidentTimelineEvent,
)


router = APIRouter(
    prefix="/incidents",
    tags=[
        "Incident Intelligence",
    ],
)


DETECTOR_NAME = "isolation-forest"
DETECTOR_VERSION = "1.1"


@router.get(
    "",
    response_model=list[
        IncidentListItem
    ],
)
def get_incidents(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),

    severity: str | None = Query(
        default=None,
    ),

    status: str | None = Query(
        default=None,
    ),

    db: Session = Depends(
        get_db
    ),
) -> list[
    IncidentListItem
]:
    query = (
        select(
            Incident,
            Employee,
        )
        .outerjoin(
            Employee,
            Incident.primary_employee_id
            == Employee.id,
        )
    )

    if severity:
        query = query.where(
            Incident.severity
            == severity.upper()
        )

    if status:
        query = query.where(
            Incident.status
            == status.upper()
        )

    rows = db.execute(
        query
        .order_by(
            desc(
                Incident.first_seen
            )
        )
        .limit(
            limit
        )
    ).all()

    return [
        IncidentListItem(
            incident_id=(
                incident.incident_id
            ),

            title=incident.title,

            incident_type=(
                incident.incident_type
            ),

            severity=(
                incident.severity
            ),

            status=(
                incident.status
            ),

            primary_employee_user_id=(
                employee.user_id
                if employee
                else None
            ),

            first_seen=(
                incident.first_seen
            ),

            last_seen=(
                incident.last_seen
            ),

            event_count=(
                incident.event_count
            ),

            anomaly_count=(
                incident.anomaly_count
            ),

            max_anomaly_score=(
                incident.max_anomaly_score
            ),

            summary=(
                incident.summary
            ),
        )
        for (
            incident,
            employee,
        )
        in rows
    ]


@router.get(
    "/summary",
    response_model=IncidentSummary,
)
def get_incident_summary(
    db: Session = Depends(
        get_db
    ),
) -> IncidentSummary:
    total_incidents = int(
        db.scalar(
            select(
                func.count(
                    Incident.id
                )
            )
        )
        or 0
    )

    open_incidents = int(
        db.scalar(
            select(
                func.count(
                    Incident.id
                )
            )
            .where(
                Incident.status
                == "OPEN"
            )
        )
        or 0
    )

    severity_rows = db.execute(
        select(
            Incident.severity,
            func.count(
                Incident.id
            ),
        )
        .group_by(
            Incident.severity
        )
    ).all()

    severity_map = {
        severity: count
        for (
            severity,
            count,
        )
        in severity_rows
    }

    total_correlated_events = int(
        db.scalar(
            select(
                func.count(
                    IncidentEvent.id
                )
            )
        )
        or 0
    )

    critical = int(
        severity_map.get(
            "CRITICAL",
            0,
        )
    )

    high = int(
        severity_map.get(
            "HIGH",
            0,
        )
    )

    medium = int(
        severity_map.get(
            "MEDIUM",
            0,
        )
    )

    return IncidentSummary(
        total_incidents=(
            total_incidents
        ),

        open_incidents=(
            open_incidents
        ),

        critical_incidents=(
            critical
        ),

        high_incidents=(
            high
        ),

        medium_incidents=(
            medium
        ),

        total_correlated_events=(
            total_correlated_events
        ),

        severity_distribution=(
            IncidentSeverityDistribution(
                medium=medium,
                high=high,
                critical=critical,
            )
        ),
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentDetail,
)
def get_incident(
    incident_id: str,

    db: Session = Depends(
        get_db
    ),
) -> IncidentDetail:
    row = db.execute(
        select(
            Incident,
            Employee,
        )
        .outerjoin(
            Employee,
            Incident.primary_employee_id
            == Employee.id,
        )
        .where(
            Incident.incident_id
            == incident_id
        )
    ).first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Incident was not found."
            ),
        )

    incident, employee = row

    return IncidentDetail(
        incident_id=(
            incident.incident_id
        ),

        title=incident.title,

        incident_type=(
            incident.incident_type
        ),

        severity=(
            incident.severity
        ),

        status=(
            incident.status
        ),

        primary_employee_user_id=(
            employee.user_id
            if employee
            else None
        ),

        first_seen=(
            incident.first_seen
        ),

        last_seen=(
            incident.last_seen
        ),

        event_count=(
            incident.event_count
        ),

        anomaly_count=(
            incident.anomaly_count
        ),

        max_anomaly_score=(
            incident.max_anomaly_score
        ),

        summary=incident.summary,

        correlation_reason=(
            incident.correlation_reason
        ),

        indicators=(
            incident.indicators
        ),

        evidence=(
            incident.evidence
        ),

        investigation_steps=(
            incident.investigation_steps
        ),
    )


@router.get(
    "/{incident_id}/timeline",
    response_model=list[
        IncidentTimelineEvent
    ],
)
def get_incident_timeline(
    incident_id: str,

    db: Session = Depends(
        get_db
    ),
) -> list[
    IncidentTimelineEvent
]:
    incident = db.scalar(
        select(
            Incident
        )
        .where(
            Incident.incident_id
            == incident_id
        )
    )

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Incident was not found."
            ),
        )

    rows = db.execute(
        select(
            IncidentEvent,
            Event,
            Employee,
            AnomalyScore,
        )
        .join(
            Event,
            IncidentEvent.event_uuid
            == Event.id,
        )
        .join(
            Employee,
            Event.employee_id
            == Employee.id,
        )
        .join(
            AnomalyScore,
            AnomalyScore.event_uuid
            == Event.id,
        )
        .where(
            IncidentEvent.incident_uuid
            == incident.id,

            AnomalyScore.detector_name
            == DETECTOR_NAME,

            AnomalyScore.detector_version
            == DETECTOR_VERSION,
        )
        .order_by(
            IncidentEvent.sequence_number
        )
    ).all()

    return [
        IncidentTimelineEvent(
            sequence_number=(
                link.sequence_number
            ),

            event_id=(
                event.event_id
            ),

            timestamp=(
                event.timestamp
            ),

            event_type=(
                event.event_type
            ),

            employee_user_id=(
                employee.user_id
            ),

            source_ip=(
                event.source_ip
            ),

            destination_ip=(
                event.destination_ip
            ),

            anomaly_score=(
                anomaly.anomaly_score
            ),

            risk_level=(
                anomaly.risk_level
            ),

            correlation_score=(
                link.correlation_score
            ),

            correlation_reason=(
                link.correlation_reason
            ),
        )

        for (
            link,
            event,
            employee,
            anomaly,
        )
        in rows
    ]


@router.get(
    "/{incident_id}/investigation",
    response_model=IncidentInvestigation,
)
def get_incident_investigation(
    incident_id: str,

    db: Session = Depends(
        get_db
    ),
) -> IncidentInvestigation:
    incident = db.scalar(
        select(
            Incident
        )
        .where(
            Incident.incident_id
            == incident_id
        )
    )

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Incident was not found."
            ),
        )

    investigation = (
        incident.evidence.get(
            "investigation",
            {},
        )
    )

    if not investigation:
        raise HTTPException(
            status_code=404,
            detail=(
                "Investigation intelligence "
                "has not been generated."
            ),
        )

    return IncidentInvestigation(
        incident_id=(
            incident.incident_id
        ),

        severity_rationale=(
            investigation.get(
                "severity_rationale",
                "",
            )
        ),

        key_findings=(
            investigation.get(
                "key_findings",
                [],
            )
        ),

        investigation_steps=(
            incident.investigation_steps
        ),

        analyst_questions=(
            investigation.get(
                "analyst_questions",
                [],
            )
        ),

        containment_actions=(
            investigation.get(
                "containment_actions",
                [],
            )
        ),
    )