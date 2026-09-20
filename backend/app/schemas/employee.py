from datetime import datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


# ============================================================
# Existing employee create/read schemas
# ============================================================


class EmployeeBase(BaseModel):
    """
    Common employee identity and behavioral-baseline fields.
    """

    user_id: str = Field(
        min_length=3,
        max_length=30,
        examples=[
            "user_001",
        ],
    )

    name: str = Field(
        min_length=2,
        max_length=120,
        examples=[
            "Ayesha Khan",
        ],
    )

    department: str = Field(
        min_length=2,
        max_length=80,
        examples=[
            "Engineering",
        ],
    )

    job_role: str = Field(
        min_length=2,
        max_length=100,
        examples=[
            "Backend Engineer",
        ],
    )

    normal_start_hour: int = Field(
        default=9,
        ge=0,
        le=23,
    )

    normal_end_hour: int = Field(
        default=17,
        ge=0,
        le=23,
    )

    typical_ip: str = Field(
        max_length=45,
        examples=[
            "10.20.3.44",
        ],
    )

    typical_location: str = Field(
        default="Corporate Office",
        max_length=120,
    )

    typical_login_frequency: int = Field(
        default=2,
        ge=0,
    )

    typical_files_accessed: int = Field(
        default=20,
        ge=0,
    )

    typical_data_transfer_bytes: int = Field(
        default=50_000_000,
        ge=0,
    )

    behavior_profile: dict = Field(
        default_factory=dict,
    )

    is_active: bool = True


class EmployeeCreate(
    EmployeeBase
):
    """
    Data accepted when creating a simulated employee.
    """

    pass


class EmployeeRead(
    EmployeeBase
):
    """
    Existing representation returned by GET /employees.

    Kept backward-compatible because the overview already consumes it.
    """

    id: UUID
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# Security summary
# ============================================================


class EmployeeSecuritySummary(
    BaseModel
):
    """
    Current operational security context for one employee.

    Selected-model score rows are separated from actual non-NORMAL
    anomalies so frontend labels remain semantically accurate.
    """

    total_events: int = 0

    scored_event_count: int = 0

    anomaly_count: int = 0

    elevated_anomaly_count: int = 0

    critical_anomaly_count: int = 0

    incident_count: int = 0
    open_incident_count: int = 0

    highest_risk_level: str = "NORMAL"

    highest_anomaly_score: float | None = None

    last_activity_at: datetime | None = None



# ============================================================
# Employee workforce summary
# ============================================================


class EmployeeWorkforceSummary(
    BaseModel
):
    """
    Organization-wide SOC summary for the employee overview.

    Risk counts use only the currently selected detector.
    Incident ownership preserves historical security cases.
    """

    total_employees: int = 0
    active_employees: int = 0

    critical_risk_employees: int = 0
    high_risk_employees: int = 0
    medium_risk_employees: int = 0

    employees_with_open_incidents: int = 0

    elevated_anomaly_count: int = 0

    scored_employees: int = 0


# ============================================================
# Employee directory
# ============================================================


class EmployeeDirectoryItem(
    BaseModel
):
    """
    One employee row for the analyst-facing directory.
    """

    id: UUID

    user_id: str
    name: str

    department: str
    job_role: str

    typical_location: str

    is_active: bool

    security: EmployeeSecuritySummary


class EmployeeDirectoryPage(
    BaseModel
):
    """
    Paginated employee directory response.
    """

    items: list[
        EmployeeDirectoryItem
    ]

    total: int

    limit: int
    offset: int

    departments: list[str]


# ============================================================
# Employee detail
# ============================================================


class EmployeeBehaviorBaseline(
    BaseModel
):
    """
    Behavioral expectations used by SENTINEL for this employee.
    """

    normal_start_hour: int
    normal_end_hour: int

    typical_ip: str
    typical_location: str

    typical_login_frequency: int
    typical_files_accessed: int

    typical_data_transfer_bytes: int


class EmployeeAnomalyItem(
    BaseModel
):
    """
    One recent non-NORMAL selected-model anomaly.
    """

    event_id: str

    timestamp: datetime
    event_type: str

    anomaly_score: float
    risk_level: str

    resource_type: str | None
    resource_name: str | None

    source_ip: str
    source_location: str | None


class EmployeeIncidentItem(
    BaseModel
):
    """
    Historical security incident associated with an employee.
    """

    incident_id: str

    title: str
    incident_type: str

    severity: str
    status: str

    detector_name: str
    detector_version: str

    correlation_engine: str
    correlation_version: str

    first_seen: datetime
    last_seen: datetime

    event_count: int
    anomaly_count: int

    max_anomaly_score: float

    summary: str


class EmployeeDetail(
    BaseModel
):
    """
    Complete analyst-facing employee profile.
    """

    id: UUID

    user_id: str
    name: str

    department: str
    job_role: str

    is_active: bool

    created_at: datetime

    baseline: EmployeeBehaviorBaseline

    security: EmployeeSecuritySummary

    recent_anomalies: list[
        EmployeeAnomalyItem
    ]

    incidents: list[
        EmployeeIncidentItem
    ]


# ============================================================
# Employee activity
# ============================================================


class EmployeeActivityItem(
    BaseModel
):
    """
    One operational Event in an employee activity timeline.

    Event.event_metadata is deliberately excluded.
    """

    event_id: str

    timestamp: datetime
    event_type: str

    session_id: str | None

    source_ip: str
    destination_ip: str | None

    source_location: str | None

    resource_type: str | None
    resource_name: str | None

    bytes_sent: int
    bytes_received: int

    success: bool

    anomaly_score: float | None
    risk_level: str | None

    detector_name: str | None
    detector_version: str | None

    linked_incident_ids: list[str]


class EmployeeActivityPage(
    BaseModel
):
    """
    Paginated operational activity for one employee.
    """

    user_id: str

    items: list[
        EmployeeActivityItem
    ]

    total: int

    limit: int
    offset: int