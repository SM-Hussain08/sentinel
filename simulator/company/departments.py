from dataclasses import dataclass


@dataclass(frozen=True)
class DepartmentProfile:
    """
    Describes the broad behavioral characteristics of a department.

    Individual employees will receive natural random variation around
    these values so that no department behaves perfectly uniformly.
    """

    name: str

    workforce_weight: float

    start_hour: int
    end_hour: int

    typical_logins_per_day: int
    typical_files_per_day: int
    typical_transfer_mb_per_day: int

    remote_work_probability: float
    late_work_probability: float

    database_access_probability: float
    network_activity_probability: float

    common_protocols: tuple[str, ...]

    subnet_prefix: str


DEPARTMENTS: dict[str, DepartmentProfile] = {
    "Engineering": DepartmentProfile(
        name="Engineering",
        workforce_weight=0.28,
        start_hour=9,
        end_hour=18,
        typical_logins_per_day=3,
        typical_files_per_day=70,
        typical_transfer_mb_per_day=1200,
        remote_work_probability=0.20,
        late_work_probability=0.15,
        database_access_probability=0.35,
        network_activity_probability=0.55,
        common_protocols=(
            "HTTPS",
            "SSH",
            "Git",
        ),
        subnet_prefix="10.20.3",
    ),

    "Finance": DepartmentProfile(
        name="Finance",
        workforce_weight=0.18,
        start_hour=9,
        end_hour=17,
        typical_logins_per_day=2,
        typical_files_per_day=35,
        typical_transfer_mb_per_day=350,
        remote_work_probability=0.08,
        late_work_probability=0.08,
        database_access_probability=0.60,
        network_activity_probability=0.20,
        common_protocols=(
            "HTTPS",
            "SMB",
            "SQL",
        ),
        subnet_prefix="10.20.4",
    ),

    "Human Resources": DepartmentProfile(
        name="Human Resources",
        workforce_weight=0.14,
        start_hour=9,
        end_hour=17,
        typical_logins_per_day=2,
        typical_files_per_day=30,
        typical_transfer_mb_per_day=180,
        remote_work_probability=0.10,
        late_work_probability=0.05,
        database_access_probability=0.25,
        network_activity_probability=0.15,
        common_protocols=(
            "HTTPS",
            "SMB",
        ),
        subnet_prefix="10.20.5",
    ),

    "Sales": DepartmentProfile(
        name="Sales",
        workforce_weight=0.22,
        start_hour=8,
        end_hour=18,
        typical_logins_per_day=4,
        typical_files_per_day=25,
        typical_transfer_mb_per_day=300,
        remote_work_probability=0.38,
        late_work_probability=0.12,
        database_access_probability=0.15,
        network_activity_probability=0.35,
        common_protocols=(
            "HTTPS",
            "VPN",
        ),
        subnet_prefix="10.20.6",
    ),

    "IT Operations": DepartmentProfile(
        name="IT Operations",
        workforce_weight=0.18,
        start_hour=8,
        end_hour=18,
        typical_logins_per_day=4,
        typical_files_per_day=50,
        typical_transfer_mb_per_day=900,
        remote_work_probability=0.18,
        late_work_probability=0.25,
        database_access_probability=0.45,
        network_activity_probability=0.80,
        common_protocols=(
            "HTTPS",
            "SSH",
            "RDP",
            "SNMP",
        ),
        subnet_prefix="10.20.7",
    ),
}