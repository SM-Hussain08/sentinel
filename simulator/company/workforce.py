"""
Reusable synthetic-workforce management for SENTINEL.

This module provides two deliberately different workflows:

1. Canonical benchmark generation
   - fixed employee count
   - fixed seed
   - requires an empty employee table
   - reproducible across benchmark runs

2. Additive operational generation
   - adds employees after the existing highest user number
   - never overwrites existing employees
   - derives a run-specific random seed from the requested seed and the
     next employee number
   - suitable for repeated demo / live population growth
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from app.models import Employee
from simulator.company.departments import (
    DEPARTMENTS,
)
from simulator.company.employee_generator import (
    EmployeeGenerator,
    GeneratedEmployee,
)


# ============================================================
# Result model
# ============================================================

@dataclass(frozen=True)
class WorkforceGenerationResult:
    """
    Summary of one workforce-generation operation.
    """

    created_count: int

    first_user_id: str
    last_user_id: str

    start_number: int
    end_number: int

    requested_seed: int
    effective_seed: int

    total_employee_count: int


# ============================================================
# Conversion helpers
# ============================================================

def _to_employee_model(
    generated: GeneratedEmployee,
) -> Employee:
    """
    Convert a generated profile into the SQLAlchemy Employee model.
    """

    return Employee(
        user_id=(
            generated.user_id
        ),

        name=(
            generated.name
        ),

        department=(
            generated.department
        ),

        job_role=(
            generated.job_role
        ),

        normal_start_hour=(
            generated.normal_start_hour
        ),

        normal_end_hour=(
            generated.normal_end_hour
        ),

        typical_ip=(
            generated.typical_ip
        ),

        typical_location=(
            generated.typical_location
        ),

        typical_login_frequency=(
            generated.typical_login_frequency
        ),

        typical_files_accessed=(
            generated.typical_files_accessed
        ),

        typical_data_transfer_bytes=(
            generated.typical_data_transfer_bytes
        ),

        behavior_profile=(
            generated.behavior_profile
        ),

        is_active=True,
    )


def _employee_count(
    db: Session,
) -> int:
    """
    Return the number of employee identities currently stored.
    """

    return int(
        db.scalar(
            select(
                func.count(
                    Employee.id
                )
            )
        )
        or 0
    )


def _parse_user_number(
    user_id: str,
) -> int | None:
    """
    Parse SENTINEL identifiers such as user_001 -> 1.

    Non-standard identifiers are ignored when determining the next
    generated employee number.
    """

    if not user_id.startswith(
        "user_"
    ):
        return None

    suffix = user_id[
        len("user_"):
    ]

    if not suffix.isdigit():
        return None

    return int(
        suffix
    )


def next_employee_number(
    db: Session,
) -> int:
    """
    Determine the next available generated employee number.

    Example:
        existing highest user = user_125
        result = 126
    """

    user_ids = list(
        db.scalars(
            select(
                Employee.user_id
            )
        ).all()
    )

    numbers = [
        number
        for user_id
        in user_ids
        if (
            number
            := _parse_user_number(
                user_id
            )
        )
        is not None
    ]

    if not numbers:
        return 1

    return (
        max(
            numbers
        )
        + 1
    )


def _derive_additive_seed(
    *,
    requested_seed: int,
    start_number: int,
) -> int:
    """
    Derive a deterministic run-specific seed.

    Reusing --seed 42 on later runs therefore does not restart Faker and
    employee-profile generation from the same random sequence.

    The result is deterministic for a given requested seed and workforce
    starting position, which still makes debugging reproducible.
    """

    return (
        requested_seed
        + (
            start_number
            * 1009
        )
    )


def _persist_generated_profiles(
    *,
    db: Session,
    generated_profiles: list[
        GeneratedEmployee
    ],
) -> list[
    Employee
]:
    """
    Persist generated profiles without committing.

    Transaction ownership remains with the caller.
    """

    employees = [
        _to_employee_model(
            generated
        )
        for generated
        in generated_profiles
    ]

    db.add_all(
        employees
    )

    db.flush()

    return employees


# ============================================================
# Operational workforce balancing
# ============================================================

def _department_counts(
    db: Session,
) -> dict[str, int]:
    """
    Return current employee counts for every configured department.

    Departments with no employees are still returned with count zero.
    """

    result = {
        name: 0
        for name
        in DEPARTMENTS
    }

    rows = db.execute(
        select(
            Employee.department,
            func.count(
                Employee.id
            ),
        )
        .group_by(
            Employee.department
        )
    ).all()

    for department, count in rows:
        if department in result:
            result[
                department
            ] = int(
                count
            )

    return result


def _build_balanced_department_plan(
    *,
    current_counts: dict[str, int],
    employee_count: int,
) -> list[str]:
    """
    Build one department assignment for every new employee.

    The algorithm considers the workforce after each individual addition.

    For the next workforce size, each department has an ideal count based
    on DepartmentProfile.workforce_weight. The employee is assigned to the
    department with the largest deficit relative to that ideal.

    This has useful properties:

    - existing employees are never moved or deleted;
    - overrepresented departments naturally receive fewer new employees;
    - underrepresented departments catch up automatically;
    - small and large batches both improve balance;
    - if the requested final size permits the configured proportions to
      resolve exactly, the final workforce lands exactly on target.
    """

    if employee_count < 1:
        raise ValueError(
            "employee_count must be at least 1."
        )

    working_counts = {
        department: int(
            current_counts.get(
                department,
                0,
            )
        )
        for department
        in DEPARTMENTS
    }

    current_total = sum(
        working_counts.values()
    )

    plan: list[str] = []

    department_order = list(
        DEPARTMENTS.keys()
    )

    for _ in range(
        employee_count
    ):
        next_total = (
            current_total
            + 1
        )

        deficits = {
            department: (
                DEPARTMENTS[
                    department
                ].workforce_weight
                * next_total
                - working_counts[
                    department
                ]
            )
            for department
            in department_order
        }

        selected_department = max(
            department_order,
            key=lambda department: (
                deficits[
                    department
                ],
                -department_order.index(
                    department
                ),
            ),
        )

        plan.append(
            selected_department
        )

        working_counts[
            selected_department
        ] += 1

        current_total = (
            next_total
        )

    return plan


def _count_department_plan(
    department_plan: list[str],
) -> dict[str, int]:
    """
    Summarize how many new employees will be assigned per department.
    """

    counts = {
        department: 0
        for department
        in DEPARTMENTS
    }

    for department in (
        department_plan
    ):
        counts[
            department
        ] += 1

    return counts


# ============================================================
# Canonical benchmark population
# ============================================================

def generate_canonical_company(
    *,
    db: Session,
    employee_count: int = 100,
    seed: int = 42,
) -> WorkforceGenerationResult:
    """
    Generate SENTINEL's canonical benchmark workforce.

    The benchmark database must be empty.

    This strict rule prevents a partially populated database from silently
    changing the supposedly reproducible benchmark.
    """

    if employee_count < 1:
        raise ValueError(
            "employee_count must be at least 1."
        )

    existing_count = (
        _employee_count(
            db
        )
    )

    if existing_count != 0:
        raise RuntimeError(
            "Canonical benchmark generation requires "
            "an empty employee table. "
            f"Found {existing_count} existing employees."
        )

    start_number = 1

    generator = (
        EmployeeGenerator(
            seed=seed
        )
    )

    generated_profiles = (
        generator.generate_company(
            employee_count=(
                employee_count
            ),
            start_number=(
                start_number
            ),
        )
    )

    employees = (
        _persist_generated_profiles(
            db=db,
            generated_profiles=(
                generated_profiles
            ),
        )
    )

    end_number = (
        start_number
        + employee_count
        - 1
    )

    total_count = (
        _employee_count(
            db
        )
    )

    return WorkforceGenerationResult(
        created_count=len(
            employees
        ),

        first_user_id=(
            f"user_{start_number:03d}"
        ),

        last_user_id=(
            f"user_{end_number:03d}"
        ),

        start_number=(
            start_number
        ),

        end_number=(
            end_number
        ),

        requested_seed=(
            seed
        ),

        effective_seed=(
            seed
        ),

        total_employee_count=(
            total_count
        ),
    )


# ============================================================
# Additive operational population
# ============================================================

def append_employees(
    *,
    db: Session,
    employee_count: int,
    seed: int = 42,
) -> WorkforceGenerationResult:
    """
    Add new employees while balancing the complete operational workforce.

    Existing records are never modified.

    Before generating employees, SENTINEL examines the current department
    distribution. Each new employee is assigned to the department with the
    greatest deficit relative to the configured workforce proportions.

    Example:
        existing workforce = 120
        requested employees = 180
        resulting workforce = 300

    The new 180 employees are allocated specifically to move the full
    300-person company as close as possible to the configured department
    weights.
    """

    if employee_count < 1:
        raise ValueError(
            "employee_count must be at least 1."
        )

    start_number = (
        next_employee_number(
            db
        )
    )

    effective_seed = (
        _derive_additive_seed(
            requested_seed=(
                seed
            ),
            start_number=(
                start_number
            ),
        )
    )

    current_department_counts = (
        _department_counts(
            db
        )
    )

    department_plan = (
        _build_balanced_department_plan(
            current_counts=(
                current_department_counts
            ),
            employee_count=(
                employee_count
            ),
        )
    )

    generator = (
        EmployeeGenerator(
            seed=(
                effective_seed
            ),
            operational_localization=True,
        )
    )

    generated_profiles = (
        generator.generate_company(
            employee_count=(
                employee_count
            ),
            start_number=(
                start_number
            ),
            department_plan=(
                department_plan
            ),
        )
    )

    employees = (
        _persist_generated_profiles(
            db=db,
            generated_profiles=(
                generated_profiles
            ),
        )
    )

    end_number = (
        start_number
        + employee_count
        - 1
    )

    total_count = (
        _employee_count(
            db
        )
    )

    return WorkforceGenerationResult(
        created_count=len(
            employees
        ),

        first_user_id=(
            f"user_{start_number:03d}"
        ),

        last_user_id=(
            f"user_{end_number:03d}"
        ),

        start_number=(
            start_number
        ),

        end_number=(
            end_number
        ),

        requested_seed=(
            seed
        ),

        effective_seed=(
            effective_seed
        ),

        total_employee_count=(
            total_count
        ),
    )
