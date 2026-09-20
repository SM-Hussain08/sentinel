import random
from dataclasses import dataclass
from typing import Any

from faker import Faker

from simulator.company.departments import (
    DEPARTMENTS,
    DepartmentProfile,
)
from simulator.company.localization import (
    generate_access_tier,
    generate_demo_phone,
    generate_employee_code,
    generate_home_area,
    generate_office_location,
    generate_operational_ip,
    generate_pakistani_name,
    generate_seniority,
    is_privileged_role,
)
from simulator.company.roles import (
    ROLES_BY_DEPARTMENT,
)


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

    Department templates establish broad behavioral patterns while random
    variation gives each employee an individual baseline.

    By default the generator preserves SENTINEL's canonical benchmark
    behavior exactly.

    Operational localization is opt-in so live/demo employees can use
    Pakistani/Karachi identity context without changing benchmark output.
    """

    def __init__(
        self,
        seed: int = 42,
        operational_localization: bool = False,
    ) -> None:
        self.seed = seed

        self.operational_localization = (
            operational_localization
        )

        self.random = random.Random(
            seed
        )

        # Keep Faker initialization exactly as before for canonical
        # benchmark generation.
        self.fake = Faker()
        self.fake.seed_instance(
            seed
        )

        self.department_names = list(
            DEPARTMENTS.keys()
        )

        self.department_weights = [
            DEPARTMENTS[
                name
            ].workforce_weight
            for name
            in self.department_names
        ]

    def _choose_department(
        self,
    ) -> DepartmentProfile:
        """
        Select a department according to workforce distribution.
        """

        department_name = (
            self.random.choices(
                self.department_names,
                weights=(
                    self.department_weights
                ),
                k=1,
            )[0]
        )

        return DEPARTMENTS[
            department_name
        ]

    def _generate_ip(
        self,
        profile: DepartmentProfile,
        employee_number: int,
    ) -> str:
        """
        Create SENTINEL's canonical private IPv4 address.

        This method is intentionally preserved for benchmark compatibility.
        """

        host = (
            10
            + (
                employee_number
                * 7
            )
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
            int(
                baseline
                * percentage
            ),
            1,
        )

        value = (
            self.random.randint(
                baseline - spread,
                baseline + spread,
            )
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

        start_shift = (
            self.random.choices(
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
        )

        start_hour = max(
            6,
            min(
                profile.start_hour
                + start_shift,
                11,
            ),
        )

        end_hour = max(
            start_hour + 7,
            profile.end_hour
            + start_shift,
        )

        return (
            start_hour,
            min(
                end_hour,
                22,
            ),
        )

    def _build_operational_metadata(
        self,
        *,
        profile: DepartmentProfile,
        role: str,
        employee_number: int,
    ) -> dict[str, Any]:
        """
        Build additional live-company metadata.

        These fields are descriptive simulation context. They do not replace
        the department-driven behavioral baselines used by the ML pipeline.
        """

        seniority = (
            generate_seniority(
                rng=self.random,
                job_role=role,
            )
        )

        access_tier = (
            generate_access_tier(
                rng=self.random,
                department=(
                    profile.name
                ),
            )
        )

        privileged_access = (
            is_privileged_role(
                department=(
                    profile.name
                ),
                job_role=role,
                access_tier=(
                    access_tier
                ),
            )
        )

        return {
            "employee_code": (
                generate_employee_code(
                    department=(
                        profile.name
                    ),
                    employee_number=(
                        employee_number
                    ),
                )
            ),

            "synthetic_phone": (
                generate_demo_phone(
                    employee_number
                )
            ),

            "home_area": (
                generate_home_area(
                    self.random
                )
            ),

            "city": "Karachi",
            "country": "Pakistan",

            "employment_type": (
                "Full-time"
            ),

            "seniority": (
                seniority
            ),

            "access_tier": (
                access_tier
            ),

            "privileged_access": (
                privileged_access
            ),

            "identity_profile": (
                "synthetic-pakistan-karachi"
            ),
        }

    def generate_employee(
        self,
        employee_number: int,
        department_name: str | None = None,
    ) -> GeneratedEmployee:
        """
        Generate one complete synthetic employee profile.

        When department_name is omitted, department selection uses the
        original weighted-random behavior. This preserves canonical
        benchmark reproducibility.

        Operational workforce generation may provide department_name
        explicitly so the company-wide workforce remains balanced.
        """

        if department_name is None:
            profile = (
                self._choose_department()
            )
        else:
            try:
                profile = (
                    DEPARTMENTS[
                        department_name
                    ]
                )
            except KeyError as exc:
                raise ValueError(
                    f"Unknown department: {department_name}"
                ) from exc

        role = (
            self.random.choice(
                ROLES_BY_DEPARTMENT[
                    profile.name
                ]
            )
        )

        start_hour, end_hour = (
            self._generate_work_hours(
                profile
            )
        )

        typical_logins = (
            self._vary_integer(
                baseline=(
                    profile
                    .typical_logins_per_day
                ),
                percentage=0.35,
                minimum=1,
            )
        )

        typical_files = (
            self._vary_integer(
                baseline=(
                    profile
                    .typical_files_per_day
                ),
                percentage=0.30,
                minimum=5,
            )
        )

        transfer_mb = (
            self._vary_integer(
                baseline=(
                    profile
                    .typical_transfer_mb_per_day
                ),
                percentage=0.40,
                minimum=20,
            )
        )

        remote_probability = min(
            max(
                (
                    profile
                    .remote_work_probability
                )
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
                (
                    profile
                    .late_work_probability
                )
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

        # --------------------------------------------------------
        # Identity / location
        # --------------------------------------------------------

        if self.operational_localization:
            name = (
                generate_pakistani_name(
                    self.random
                )
            )

            typical_ip = (
                generate_operational_ip(
                    department=(
                        profile.name
                    ),
                    employee_number=(
                        employee_number
                    ),
                )
            )

            typical_location = (
                generate_office_location(
                    rng=self.random,
                    department=(
                        profile.name
                    ),
                )
            )

        else:
            # Preserve canonical benchmark behavior.
            name = self.fake.name()

            typical_ip = (
                self._generate_ip(
                    profile=profile,
                    employee_number=(
                        employee_number
                    ),
                )
            )

            typical_location = (
                "Karachi HQ"
            )

        # --------------------------------------------------------
        # Behavioral profile
        # --------------------------------------------------------

        behavior_profile: dict[str, Any] = {
            "remote_work_probability": round(
                remote_probability,
                3,
            ),

            "late_work_probability": round(
                late_probability,
                3,
            ),

            "database_access_probability": (
                profile
                .database_access_probability
            ),

            "network_activity_probability": (
                profile
                .network_activity_probability
            ),

            "common_protocols": list(
                profile.common_protocols
            ),

            "typical_device": (
                f"{profile.name[:3].upper()}"
                f"-WS-{employee_number:03d}"
            ),

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

        if self.operational_localization:
            behavior_profile.update(
                self._build_operational_metadata(
                    profile=profile,
                    role=role,
                    employee_number=(
                        employee_number
                    ),
                )
            )

        return GeneratedEmployee(
            user_id=user_id,
            name=name,
            department=(
                profile.name
            ),
            job_role=role,

            normal_start_hour=(
                start_hour
            ),

            normal_end_hour=(
                end_hour
            ),

            typical_ip=(
                typical_ip
            ),

            typical_location=(
                typical_location
            ),

            typical_login_frequency=(
                typical_logins
            ),

            typical_files_accessed=(
                typical_files
            ),

            typical_data_transfer_bytes=(
                transfer_mb
                * 1_000_000
            ),

            behavior_profile=(
                behavior_profile
            ),
        )

    def generate_company(
        self,
        employee_count: int,
        start_number: int = 1,
        department_plan: list[str] | None = None,
    ) -> list[GeneratedEmployee]:
        """
        Generate an entire synthetic company workforce.

        Canonical benchmark generation omits department_plan and therefore
        preserves the original weighted-random department selection.

        Operational generation may supply one department per employee so
        the total workforce can be balanced against existing records.
        """

        if employee_count < 1:
            raise ValueError(
                "employee_count must be at least 1."
            )

        if (
            department_plan is not None
            and len(
                department_plan
            )
            != employee_count
        ):
            raise ValueError(
                "department_plan length must equal employee_count."
            )

        employees: list[
            GeneratedEmployee
        ] = []

        for offset, employee_number in enumerate(
            range(
                start_number,
                start_number
                + employee_count,
            )
        ):
            department_name = (
                None
                if department_plan is None
                else department_plan[
                    offset
                ]
            )

            employees.append(
                self.generate_employee(
                    employee_number,
                    department_name=(
                        department_name
                    ),
                )
            )

        return employees
