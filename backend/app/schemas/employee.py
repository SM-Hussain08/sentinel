from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EmployeeBase(BaseModel):
    """
    Common employee fields shared by create and response schemas.
    """

    user_id: str = Field(
        min_length=3,
        max_length=30,
        examples=["user_001"],
    )

    name: str = Field(
        min_length=2,
        max_length=120,
        examples=["Ayesha Khan"],
    )

    department: str = Field(
        min_length=2,
        max_length=80,
        examples=["Engineering"],
    )

    job_role: str = Field(
        min_length=2,
        max_length=100,
        examples=["Backend Engineer"],
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
        examples=["10.20.3.44"],
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


class EmployeeCreate(EmployeeBase):
    """
    Data accepted when creating a simulated employee.
    """

    pass


class EmployeeRead(EmployeeBase):
    """
    Employee representation returned by the SENTINEL API.
    """

    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)