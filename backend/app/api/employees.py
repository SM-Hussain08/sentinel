from __future__ import annotations

from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)

from sqlalchemy import (
    and_,
    case,
    func,
    or_,
    select,
)

from sqlalchemy.orm import (
    Session,
)

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

from app.schemas import (
    EmployeeActivityItem,
    EmployeeActivityPage,
    EmployeeAnomalyItem,
    EmployeeBehaviorBaseline,
    EmployeeDetail,
    EmployeeDirectoryItem,
    EmployeeDirectoryPage,
    EmployeeIncidentItem,
    EmployeeRead,
    EmployeeSecuritySummary,
    EmployeeWorkforceSummary,
)

from app.selected_detector import (
    SELECTED_DETECTOR,
)


router = APIRouter(
    prefix="/employees",
    tags=[
        "Employees",
    ],
)


# ============================================================
# Helpers
# ============================================================


def _highest_risk_level(
    *,
    critical_count: int,
    high_count: int,
    medium_count: int,
    low_count: int,
) -> str:
    if critical_count > 0:
        return "CRITICAL"

    if high_count > 0:
        return "HIGH"

    if medium_count > 0:
        return "MEDIUM"

    if low_count > 0:
        return "LOW"

    return "NORMAL"


def _get_employee_or_404(
    db: Session,
    user_id: str,
) -> Employee:
    employee = db.scalar(
        select(
            Employee
        )
        .where(
            Employee.user_id
            == user_id
        )
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Employee '{user_id}' "
                "was not found."
            ),
        )

    return employee


def _build_security_summary(
    db: Session,
    employee: Employee,
) -> EmployeeSecuritySummary:
    """
    Build current operational security context for one employee.

    Events represent full activity history.
    Anomaly statistics use only the selected detector.
    Incident statistics preserve historical security cases.
    """

    event_row = db.execute(
        select(
            func.count(
                Event.id
            ).label(
                "total_events"
            ),

            func.max(
                Event.timestamp
            ).label(
                "last_activity_at"
            ),
        )
        .where(
            Event.employee_id
            == employee.id
        )
    ).one()

    anomaly_row = db.execute(
        select(
            func.count(
                AnomalyScore.id
            ).label(
                "scored_event_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        != "NORMAL",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "anomaly_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level.in_(
                            [
                                "MEDIUM",
                                "HIGH",
                                "CRITICAL",
                            ]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "elevated_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "CRITICAL",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "critical_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "HIGH",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "high_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "MEDIUM",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "medium_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "LOW",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "low_count"
            ),

            func.max(
                AnomalyScore.anomaly_score
            ).label(
                "highest_anomaly_score"
            ),
        )
        .join(
            Event,
            AnomalyScore.event_uuid
            == Event.id,
        )
        .where(
            Event.employee_id
            == employee.id,

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
    ).one()

    incident_row = db.execute(
        select(
            func.count(
                Incident.id
            ).label(
                "incident_count"
            ),

            func.sum(
                case(
                    (
                        Incident.status
                        == "OPEN",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "open_incident_count"
            ),
        )
        .where(
            Incident.primary_employee_id
            == employee.id
        )
    ).one()

    critical_count = int(
        anomaly_row.critical_count
        or 0
    )

    high_count = int(
        anomaly_row.high_count
        or 0
    )

    medium_count = int(
        anomaly_row.medium_count
        or 0
    )

    low_count = int(
        anomaly_row.low_count
        or 0
    )

    return EmployeeSecuritySummary(
        total_events=int(
            event_row.total_events
            or 0
        ),

        scored_event_count=int(
            anomaly_row.scored_event_count
            or 0
        ),

        anomaly_count=int(
            anomaly_row.anomaly_count
            or 0
        ),

        elevated_anomaly_count=int(
            anomaly_row.elevated_count
            or 0
        ),

        critical_anomaly_count=(
            critical_count
        ),

        incident_count=int(
            incident_row.incident_count
            or 0
        ),

        open_incident_count=int(
            incident_row.open_incident_count
            or 0
        ),

        highest_risk_level=(
            _highest_risk_level(
                critical_count=(
                    critical_count
                ),

                high_count=(
                    high_count
                ),

                medium_count=(
                    medium_count
                ),

                low_count=(
                    low_count
                ),
            )
        ),

        highest_anomaly_score=(
            float(
                anomaly_row
                .highest_anomaly_score
            )
            if (
                anomaly_row
                .highest_anomaly_score
                is not None
            )
            else None
        ),

        last_activity_at=(
            event_row
            .last_activity_at
        ),
    )


# ============================================================
# Existing backward-compatible endpoint
# ============================================================


@router.get(
    "",
    response_model=list[
        EmployeeRead
    ],
)
def list_employees(
    db: Session = Depends(
        get_db
    ),
) -> list[Employee]:
    """
    Return all employees currently stored in SENTINEL.

    Kept backward-compatible because the overview already uses this
    endpoint for employee counts.
    """

    statement = (
        select(
            Employee
        )
        .order_by(
            Employee.user_id
        )
    )

    return list(
        db.scalars(
            statement
        )
        .all()
    )


# ============================================================
# Workforce security summary
# ============================================================


@router.get(
    "/summary",
    response_model=(
        EmployeeWorkforceSummary
    ),
)
def get_employee_workforce_summary(
    db: Session = Depends(
        get_db
    ),
) -> EmployeeWorkforceSummary:
    """
    Return organization-wide employee security posture.

    Employee risk is determined from the highest risk level produced
    by the currently selected detector for that identity.

    Open-incident ownership is historical case state and therefore
    is not restricted to the currently selected detector version.
    """

    # --------------------------------------------------------
    # Workforce population
    # --------------------------------------------------------

    total_employees = int(
        db.scalar(
            select(
                func.count(
                    Employee.id
                )
            )
        )
        or 0
    )

    active_employees = int(
        db.scalar(
            select(
                func.count(
                    Employee.id
                )
            )
            .where(
                Employee.is_active.is_(
                    True
                )
            )
        )
        or 0
    )

    # --------------------------------------------------------
    # Highest selected-detector risk per employee
    #
    # CRITICAL = 4
    # HIGH     = 3
    # MEDIUM   = 2
    # LOW      = 1
    # NORMAL   = 0
    # --------------------------------------------------------

    employee_risk_subquery = (
        select(
            Event.employee_id.label(
                "employee_id"
            ),

            func.max(
                case(
                    (
                        AnomalyScore.risk_level
                        == "CRITICAL",
                        4,
                    ),

                    (
                        AnomalyScore.risk_level
                        == "HIGH",
                        3,
                    ),

                    (
                        AnomalyScore.risk_level
                        == "MEDIUM",
                        2,
                    ),

                    (
                        AnomalyScore.risk_level
                        == "LOW",
                        1,
                    ),

                    else_=0,
                )
            ).label(
                "risk_rank"
            ),
        )
        .join(
            AnomalyScore,
            AnomalyScore.event_uuid
            == Event.id,
        )
        .where(
            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
        .group_by(
            Event.employee_id
        )
        .subquery()
    )

    risk_counts = db.execute(
        select(
            func.count().label(
                "scored_employees"
            ),

            func.sum(
                case(
                    (
                        employee_risk_subquery
                        .c.risk_rank
                        == 4,
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "critical_employees"
            ),

            func.sum(
                case(
                    (
                        employee_risk_subquery
                        .c.risk_rank
                        == 3,
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "high_employees"
            ),

            func.sum(
                case(
                    (
                        employee_risk_subquery
                        .c.risk_rank
                        == 2,
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "medium_employees"
            ),
        )
        .select_from(
            employee_risk_subquery
        )
    ).one()

    # --------------------------------------------------------
    # Elevated selected-detector anomaly signals
    # --------------------------------------------------------

    elevated_anomaly_count = int(
        db.scalar(
            select(
                func.count(
                    AnomalyScore.id
                )
            )
            .where(
                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,

                AnomalyScore.risk_level.in_(
                    [
                        "MEDIUM",
                        "HIGH",
                        "CRITICAL",
                    ]
                ),
            )
        )
        or 0
    )

    # --------------------------------------------------------
    # Employees currently owning at least one open incident
    # --------------------------------------------------------

    employees_with_open_incidents = int(
        db.scalar(
            select(
                func.count(
                    func.distinct(
                        Incident.primary_employee_id
                    )
                )
            )
            .where(
                Incident.status
                == "OPEN",

                Incident.primary_employee_id
                .is_not(
                    None
                ),
            )
        )
        or 0
    )

    return EmployeeWorkforceSummary(
        total_employees=(
            total_employees
        ),

        active_employees=(
            active_employees
        ),

        critical_risk_employees=int(
            risk_counts
            .critical_employees
            or 0
        ),

        high_risk_employees=int(
            risk_counts
            .high_employees
            or 0
        ),

        medium_risk_employees=int(
            risk_counts
            .medium_employees
            or 0
        ),

        employees_with_open_incidents=(
            employees_with_open_incidents
        ),

        elevated_anomaly_count=(
            elevated_anomaly_count
        ),

        scored_employees=int(
            risk_counts
            .scored_employees
            or 0
        ),
    )


# ============================================================
# SOC employee directory
# ============================================================


@router.get(
    "/directory",
    response_model=(
        EmployeeDirectoryPage
    ),
)
def get_employee_directory(
    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=120,
    ),

    department: str | None = Query(
        default=None,
        min_length=1,
        max_length=80,
    ),

    status: Literal[
        "all",
        "active",
        "inactive",
    ] = Query(
        default="all"
    ),

    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),

    offset: int = Query(
        default=0,
        ge=0,
    ),

    db: Session = Depends(
        get_db
    ),
) -> EmployeeDirectoryPage:
    """
    Return a paginated analyst-facing employee directory.
    """

    conditions = []

    if search is not None:
        normalized_search = (
            search.strip()
        )

        if normalized_search:
            pattern = (
                f"%{normalized_search}%"
            )

            conditions.append(
                or_(
                    Employee.user_id.ilike(
                        pattern
                    ),

                    Employee.name.ilike(
                        pattern
                    ),

                    Employee.job_role.ilike(
                        pattern
                    ),

                    Employee.department.ilike(
                        pattern
                    ),
                )
            )

    if department is not None:
        normalized_department = (
            department.strip()
        )

        if normalized_department:
            conditions.append(
                Employee.department
                == normalized_department
            )

    if status == "active":
        conditions.append(
            Employee.is_active.is_(
                True
            )
        )

    elif status == "inactive":
        conditions.append(
            Employee.is_active.is_(
                False
            )
        )

    total_statement = select(
        func.count(
            Employee.id
        )
    )

    if conditions:
        total_statement = (
            total_statement
            .where(
                and_(
                    *conditions
                )
            )
        )

    total = int(
        db.scalar(
            total_statement
        )
        or 0
    )

    employee_statement = (
        select(
            Employee
        )
    )

    if conditions:
        employee_statement = (
            employee_statement
            .where(
                and_(
                    *conditions
                )
            )
        )

    employee_statement = (
        employee_statement
        .order_by(
            Employee.user_id
        )
        .offset(
            offset
        )
        .limit(
            limit
        )
    )

    employees = list(
        db.scalars(
            employee_statement
        )
        .all()
    )

    departments = list(
        db.scalars(
            select(
                Employee.department
            )
            .distinct()
            .order_by(
                Employee.department
            )
        )
        .all()
    )

    if not employees:
        return EmployeeDirectoryPage(
            items=[],
            total=total,
            limit=limit,
            offset=offset,
            departments=departments,
        )

    employee_ids = [
        employee.id
        for employee
        in employees
    ]

    # --------------------------------------------------------
    # Event aggregates
    # --------------------------------------------------------

    event_rows = db.execute(
        select(
            Event.employee_id,

            func.count(
                Event.id
            ).label(
                "total_events"
            ),

            func.max(
                Event.timestamp
            ).label(
                "last_activity_at"
            ),
        )
        .where(
            Event.employee_id.in_(
                employee_ids
            )
        )
        .group_by(
            Event.employee_id
        )
    ).all()

    event_stats = {
        row.employee_id: row
        for row
        in event_rows
    }

    # --------------------------------------------------------
    # Selected-detector score aggregates
    # --------------------------------------------------------

    anomaly_rows = db.execute(
        select(
            Event.employee_id,

            func.count(
                AnomalyScore.id
            ).label(
                "scored_event_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        != "NORMAL",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "anomaly_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level.in_(
                            [
                                "MEDIUM",
                                "HIGH",
                                "CRITICAL",
                            ]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "elevated_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "CRITICAL",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "critical_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "HIGH",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "high_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "MEDIUM",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "medium_count"
            ),

            func.sum(
                case(
                    (
                        AnomalyScore.risk_level
                        == "LOW",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "low_count"
            ),

            func.max(
                AnomalyScore.anomaly_score
            ).label(
                "highest_anomaly_score"
            ),
        )
        .join(
            Event,
            AnomalyScore.event_uuid
            == Event.id,
        )
        .where(
            Event.employee_id.in_(
                employee_ids
            ),

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,
        )
        .group_by(
            Event.employee_id
        )
    ).all()

    anomaly_stats = {
        row.employee_id: row
        for row
        in anomaly_rows
    }

    # --------------------------------------------------------
    # Historical incident aggregates
    # --------------------------------------------------------

    incident_rows = db.execute(
        select(
            Incident.primary_employee_id,

            func.count(
                Incident.id
            ).label(
                "incident_count"
            ),

            func.sum(
                case(
                    (
                        Incident.status
                        == "OPEN",
                        1,
                    ),
                    else_=0,
                )
            ).label(
                "open_incident_count"
            ),
        )
        .where(
            Incident.primary_employee_id.in_(
                employee_ids
            )
        )
        .group_by(
            Incident.primary_employee_id
        )
    ).all()

    incident_stats = {
        row.primary_employee_id: row
        for row
        in incident_rows
    }

    # --------------------------------------------------------
    # Build directory items
    # --------------------------------------------------------

    items: list[
        EmployeeDirectoryItem
    ] = []

    for employee in employees:
        event_row = (
            event_stats.get(
                employee.id
            )
        )

        anomaly_row = (
            anomaly_stats.get(
                employee.id
            )
        )

        incident_row = (
            incident_stats.get(
                employee.id
            )
        )

        critical_count = int(
            (
                anomaly_row.critical_count
                if anomaly_row
                else 0
            )
            or 0
        )

        high_count = int(
            (
                anomaly_row.high_count
                if anomaly_row
                else 0
            )
            or 0
        )

        medium_count = int(
            (
                anomaly_row.medium_count
                if anomaly_row
                else 0
            )
            or 0
        )

        low_count = int(
            (
                anomaly_row.low_count
                if anomaly_row
                else 0
            )
            or 0
        )

        security = (
            EmployeeSecuritySummary(
                total_events=int(
                    (
                        event_row.total_events
                        if event_row
                        else 0
                    )
                    or 0
                ),

                scored_event_count=int(
                    (
                        anomaly_row
                        .scored_event_count
                        if anomaly_row
                        else 0
                    )
                    or 0
                ),

                anomaly_count=int(
                    (
                        anomaly_row
                        .anomaly_count
                        if anomaly_row
                        else 0
                    )
                    or 0
                ),

                elevated_anomaly_count=int(
                    (
                        anomaly_row
                        .elevated_count
                        if anomaly_row
                        else 0
                    )
                    or 0
                ),

                critical_anomaly_count=(
                    critical_count
                ),

                incident_count=int(
                    (
                        incident_row
                        .incident_count
                        if incident_row
                        else 0
                    )
                    or 0
                ),

                open_incident_count=int(
                    (
                        incident_row
                        .open_incident_count
                        if incident_row
                        else 0
                    )
                    or 0
                ),

                highest_risk_level=(
                    _highest_risk_level(
                        critical_count=(
                            critical_count
                        ),
                        high_count=(
                            high_count
                        ),
                        medium_count=(
                            medium_count
                        ),
                        low_count=(
                            low_count
                        ),
                    )
                ),

                highest_anomaly_score=(
                    float(
                        anomaly_row
                        .highest_anomaly_score
                    )
                    if (
                        anomaly_row
                        and anomaly_row
                        .highest_anomaly_score
                        is not None
                    )
                    else None
                ),

                last_activity_at=(
                    event_row
                    .last_activity_at
                    if event_row
                    else None
                ),
            )
        )

        items.append(
            EmployeeDirectoryItem(
                id=employee.id,

                user_id=(
                    employee.user_id
                ),

                name=(
                    employee.name
                ),

                department=(
                    employee.department
                ),

                job_role=(
                    employee.job_role
                ),

                typical_location=(
                    employee
                    .typical_location
                ),

                is_active=(
                    employee.is_active
                ),

                security=security,
            )
        )

    return EmployeeDirectoryPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        departments=departments,
    )


# ============================================================
# Employee activity
#
# IMPORTANT:
# This route is declared before /{user_id}.
# ============================================================


@router.get(
    "/{user_id}/activity",
    response_model=(
        EmployeeActivityPage
    ),
)
def get_employee_activity(
    user_id: str,

    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),

    offset: int = Query(
        default=0,
        ge=0,
    ),

    db: Session = Depends(
        get_db
    ),
) -> EmployeeActivityPage:
    """
    Return paginated operational activity for one employee.

    Selected-detector anomaly context is attached when available.
    Incident IDs preserve historical incident linkage.
    """

    employee = _get_employee_or_404(
        db,
        user_id,
    )

    total = int(
        db.scalar(
            select(
                func.count(
                    Event.id
                )
            )
            .where(
                Event.employee_id
                == employee.id
            )
        )
        or 0
    )

    rows = db.execute(
        select(
            Event,
            AnomalyScore,
        )
        .outerjoin(
            AnomalyScore,
            and_(
                AnomalyScore.event_uuid
                == Event.id,

                AnomalyScore.detector_name
                == SELECTED_DETECTOR.name,

                AnomalyScore.detector_version
                == SELECTED_DETECTOR.version,
            ),
        )
        .where(
            Event.employee_id
            == employee.id
        )
        .order_by(
            Event.timestamp.desc(),
            Event.id.desc(),
        )
        .offset(
            offset
        )
        .limit(
            limit
        )
    ).all()

    event_ids = [
        event.id
        for (
            event,
            _,
        )
        in rows
    ]

    incident_map: dict[
        object,
        list[str],
    ] = {}

    if event_ids:
        incident_rows = db.execute(
            select(
                IncidentEvent.event_uuid,
                Incident.incident_id,
            )
            .join(
                Incident,
                IncidentEvent.incident_uuid
                == Incident.id,
            )
            .where(
                IncidentEvent.event_uuid.in_(
                    event_ids
                )
            )
            .order_by(
                Incident.incident_id
            )
        ).all()

        for (
            event_uuid,
            incident_id,
        ) in incident_rows:
            incident_map.setdefault(
                event_uuid,
                [],
            ).append(
                incident_id
            )

    items: list[
        EmployeeActivityItem
    ] = []

    for (
        event,
        anomaly,
    ) in rows:
        items.append(
            EmployeeActivityItem(
                event_id=(
                    event.event_id
                ),

                timestamp=(
                    event.timestamp
                ),

                event_type=(
                    event.event_type
                ),

                session_id=(
                    event.session_id
                ),

                source_ip=(
                    event.source_ip
                ),

                destination_ip=(
                    event.destination_ip
                ),

                source_location=(
                    event.source_location
                ),

                resource_type=(
                    event.resource_type
                ),

                resource_name=(
                    event.resource_name
                ),

                bytes_sent=int(
                    event.bytes_sent
                ),

                bytes_received=int(
                    event.bytes_received
                ),

                success=bool(
                    event.success
                ),

                anomaly_score=(
                    float(
                        anomaly.anomaly_score
                    )
                    if anomaly
                    else None
                ),

                risk_level=(
                    anomaly.risk_level
                    if anomaly
                    else None
                ),

                detector_name=(
                    anomaly.detector_name
                    if anomaly
                    else None
                ),

                detector_version=(
                    anomaly.detector_version
                    if anomaly
                    else None
                ),

                linked_incident_ids=(
                    incident_map.get(
                        event.id,
                        [],
                    )
                ),
            )
        )

    return EmployeeActivityPage(
        user_id=(
            employee.user_id
        ),

        items=items,

        total=total,

        limit=limit,
        offset=offset,
    )


# ============================================================
# Employee detail
# ============================================================


@router.get(
    "/{user_id}",
    response_model=(
        EmployeeDetail
    ),
)
def get_employee_detail(
    user_id: str,

    db: Session = Depends(
        get_db
    ),
) -> EmployeeDetail:
    """
    Return an analyst-facing employee profile with behavioral baseline,
    selected-model anomalies, and historical incident context.
    """

    employee = _get_employee_or_404(
        db,
        user_id,
    )

    security = (
        _build_security_summary(
            db,
            employee,
        )
    )

    # --------------------------------------------------------
    # Recent selected-model non-NORMAL anomalies
    # --------------------------------------------------------

    anomaly_rows = db.execute(
        select(
            Event,
            AnomalyScore,
        )
        .join(
            AnomalyScore,
            AnomalyScore.event_uuid
            == Event.id,
        )
        .where(
            Event.employee_id
            == employee.id,

            AnomalyScore.detector_name
            == SELECTED_DETECTOR.name,

            AnomalyScore.detector_version
            == SELECTED_DETECTOR.version,

            AnomalyScore.risk_level
            != "NORMAL",
        )
        .order_by(
            Event.timestamp.desc(),
            Event.id.desc(),
        )
        .limit(
            10
        )
    ).all()

    recent_anomalies = [
        EmployeeAnomalyItem(
            event_id=(
                event.event_id
            ),

            timestamp=(
                event.timestamp
            ),

            event_type=(
                event.event_type
            ),

            anomaly_score=float(
                anomaly.anomaly_score
            ),

            risk_level=(
                anomaly.risk_level
            ),

            resource_type=(
                event.resource_type
            ),

            resource_name=(
                event.resource_name
            ),

            source_ip=(
                event.source_ip
            ),

            source_location=(
                event.source_location
            ),
        )
        for (
            event,
            anomaly,
        )
        in anomaly_rows
    ]

    # --------------------------------------------------------
    # Historical incidents
    # --------------------------------------------------------

    incidents = list(
        db.scalars(
            select(
                Incident
            )
            .where(
                Incident.primary_employee_id
                == employee.id
            )
            .order_by(
                Incident.last_seen.desc(),
                Incident.incident_id.desc(),
            )
        )
        .all()
    )

    incident_items = [
        EmployeeIncidentItem(
            incident_id=(
                incident.incident_id
            ),

            title=(
                incident.title
            ),

            incident_type=(
                incident.incident_type
            ),

            severity=(
                incident.severity
            ),

            status=(
                incident.status
            ),

            detector_name=(
                incident.detector_name
            ),

            detector_version=(
                incident.detector_version
            ),

            correlation_engine=(
                incident.correlation_engine
            ),

            correlation_version=(
                incident.correlation_version
            ),

            first_seen=(
                incident.first_seen
            ),

            last_seen=(
                incident.last_seen
            ),

            event_count=int(
                incident.event_count
            ),

            anomaly_count=int(
                incident.anomaly_count
            ),

            max_anomaly_score=float(
                incident.max_anomaly_score
            ),

            summary=(
                incident.summary
            ),
        )
        for incident
        in incidents
    ]

    return EmployeeDetail(
        id=employee.id,

        user_id=(
            employee.user_id
        ),

        name=(
            employee.name
        ),

        department=(
            employee.department
        ),

        job_role=(
            employee.job_role
        ),

        is_active=(
            employee.is_active
        ),

        created_at=(
            employee.created_at
        ),

        baseline=(
            EmployeeBehaviorBaseline(
                normal_start_hour=(
                    employee
                    .normal_start_hour
                ),

                normal_end_hour=(
                    employee
                    .normal_end_hour
                ),

                typical_ip=(
                    employee.typical_ip
                ),

                typical_location=(
                    employee
                    .typical_location
                ),

                typical_login_frequency=(
                    employee
                    .typical_login_frequency
                ),

                typical_files_accessed=(
                    employee
                    .typical_files_accessed
                ),

                typical_data_transfer_bytes=(
                    employee
                    .typical_data_transfer_bytes
                ),
            )
        ),

        security=security,

        recent_anomalies=(
            recent_anomalies
        ),

        incidents=(
            incident_items
        ),
    )