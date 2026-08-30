import random
from dataclasses import dataclass
from typing import Any

from faker import Faker

from simulator.company.departments import (
    DEPARTMENTS,
    DepartmentProfile,
)
from simulator.company.roles import ROLES_BY_DEPARTMENT


@dataclass
class GeneratedEmployee:
    """
    A generated employee profile before it is converted into a
    SQLAlchemy Employee database model.
    """

    user_id: str
    name: str
    department: str
    job_role: str

    normal_start_hour: int
    normal_end_hour: int

    typical_ip: str
    typical_location: str

    typical_login_frequency: int
    typical_files_accessed: int
    typical_data_transfer_bytes: int

    behavior_profile: dict[str, Any]


class EmployeeGenerator:
    """
    Creates realistic synthetic employees for SENTINEL.

    Department templates establish broad patterns while random variation
    gives every employee an individual behavioral baseline.
    """

    def __init__(
        self,
        seed: int = 42,
    ) -> None:
        self.seed = seed

        self.random = random.Random(seed)

        self.fake = Faker()
        self.fake.seed_instance(seed)

        self.department_names = list(
            DEPARTMENTS.keys()
        )

        self.department_weights = [
            DEPARTMENTS[name].workforce_weight
            for name in self.department_names
        ]

    def _choose_department(
        self,
    ) -> DepartmentProfile:
        """
        Select a department according to workforce distribution.
        """

        department_name = self.random.choices(
            self.department_names,
            weights=self.department_weights,
            k=1,
        )[0]

        return DEPARTMENTS[department_name]

    def _generate_ip(
        self,
        profile: DepartmentProfile,
        employee_number: int,
    ) -> str:
        """
        Create a stable private IPv4 address within the department subnet.

        The last octet is deterministic enough to keep generated employee
        profiles readable while still preventing collisions for this scale.
        """

        host = 10 + (
            (employee_number * 7)
            % 230
        )

        return (
            f"{profile.subnet_prefix}."
            f"{host}"
        )

    def _vary_integer(
        self,
        baseline: int,
        percentage: float,
        minimum: int = 0,
    ) -> int:
        """
        Add natural variation around an integer behavioral baseline.
        """

        spread = max(
            int(baseline * percentage),
            1,
        )

        value = self.random.randint(
            baseline - spread,
            baseline + spread,
        )

        return max(
            value,
            minimum,
        )

    def _generate_work_hours(
        self,
        profile: DepartmentProfile,
    ) -> tuple[int, int]:
        """
        Give some employees slightly earlier or later schedules.
        """

        start_shift = self.random.choices(
            population=[
                -1,
                0,
                1,
            ],
            weights=[
                0.12,
                0.76,
                0.12,
            ],
            k=1,
        )[0]

        start_hour = max(
            6,
            min(
                profile.start_hour + start_shift,
                11,
            ),
        )

        end_hour = max(
            start_hour + 7,
            profile.end_hour + start_shift,
        )

        return (
            start_hour,
            min(
                end_hour,
                22,
            ),
        )

    def generate_employee(
        self,
        employee_number: int,
    ) -> GeneratedEmployee:
        """
        Generate one complete synthetic employee profile.
        """

        profile = self._choose_department()

        role = self.random.choice(
            ROLES_BY_DEPARTMENT[
                profile.name
            ]
        )

        start_hour, end_hour = (
            self._generate_work_hours(
                profile,
            )
        )

        typical_logins = self._vary_integer(
            baseline=profile.typical_logins_per_day,
            percentage=0.35,
            minimum=1,
        )

        typical_files = self._vary_integer(
            baseline=profile.typical_files_per_day,
            percentage=0.30,
            minimum=5,
        )

        transfer_mb = self._vary_integer(
            baseline=profile.typical_transfer_mb_per_day,
            percentage=0.40,
            minimum=20,
        )

        remote_probability = min(
            max(
                profile.remote_work_probability
                + self.random.uniform(
                    -0.05,
                    0.05,
                ),
                0.0,
            ),
            0.80,
        )

        late_probability = min(
            max(
                profile.late_work_probability
                + self.random.uniform(
                    -0.03,
                    0.04,
                ),
                0.0,
            ),
            0.60,
        )

        user_id = (
            f"user_{employee_number:03d}"
        )

        name = self.fake.name()

        typical_ip = self._generate_ip(
            profile=profile,
            employee_number=employee_number,
        )

        behavior_profile = {
            "remote_work_probability": round(
                remote_probability,
                3,
            ),

            "late_work_probability": round(
                late_probability,
                3,
            ),

            "database_access_probability": (
                profile.database_access_probability
            ),

            "network_activity_probability": (
                profile.network_activity_probability
            ),

            "common_protocols": list(
                profile.common_protocols
            ),

            "typical_device": (
                f"{profile.name[:3].upper()}"
                f"-WS-{employee_number:03d}"
            ),

            # More precise behavioral timing is stored here.
            # The database integer columns remain useful as broad baselines.
            "typical_start_minute_offset": (
                self.random.randint(
                    -25,
                    25,
                )
            ),

            "typical_end_minute_offset": (
                self.random.randint(
                    -30,
                    30,
                )
            ),

            "daily_activity_variation": round(
                self.random.uniform(
                    0.10,
                    0.30,
                ),
                3,
            ),
        }

        return GeneratedEmployee(
            user_id=user_id,
            name=name,
            department=profile.name,
            job_role=role,

            normal_start_hour=start_hour,
            normal_end_hour=end_hour,

            typical_ip=typical_ip,
            typical_location="Karachi HQ",

            typical_login_frequency=typical_logins,
            typical_files_accessed=typical_files,

            typical_data_transfer_bytes=(
                transfer_mb
                * 1_000_000
            ),

            behavior_profile=behavior_profile,
        )

    def generate_company(
        self,
        employee_count: int,
        start_number: int = 1,
    ) -> list[GeneratedEmployee]:
        """
        Generate an entire synthetic company workforce.
        """

        if employee_count < 1:
            raise ValueError(
                "employee_count must be at least 1."
            )

        return [
            self.generate_employee(
                employee_number,
            )
            for employee_number
            in range(
                start_number,
                start_number
                + employee_count,
            )
        ]