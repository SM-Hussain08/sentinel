"""
Generate and persist SENTINEL's synthetic company workforce.

The existing development employee (user_001) is preserved.

This script creates user_002 through user_100 using deterministic
department-level and individual behavioral profiles.
"""

from collections import Counter
from pathlib import Path
import sys

from sqlalchemy import select


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

sys.path.insert(
    0,
    str(BACKEND_ROOT),
)


from app.database.session import SessionLocal  # noqa: E402
from app.models import Employee  # noqa: E402
from simulator.company import EmployeeGenerator  # noqa: E402


TOTAL_COMPANY_SIZE = 100

GENERATED_START_NUMBER = 2
GENERATED_EMPLOYEE_COUNT = (
    TOTAL_COMPANY_SIZE - 1
)


def generate_company() -> None:
    generator = EmployeeGenerator(
        seed=42,
    )

    generated_employees = (
        generator.generate_company(
            employee_count=(
                GENERATED_EMPLOYEE_COUNT
            ),
            start_number=(
                GENERATED_START_NUMBER
            ),
        )
    )

    db = SessionLocal()

    inserted = 0
    skipped = 0

    inserted_departments: Counter[str] = (
        Counter()
    )

    try:
        for profile in generated_employees:
            existing_employee = db.scalar(
                select(Employee).where(
                    Employee.user_id
                    == profile.user_id
                )
            )

            if existing_employee is not None:
                skipped += 1
                continue

            employee = Employee(
                user_id=profile.user_id,
                name=profile.name,
                department=profile.department,
                job_role=profile.job_role,

                normal_start_hour=(
                    profile.normal_start_hour
                ),

                normal_end_hour=(
                    profile.normal_end_hour
                ),

                typical_ip=profile.typical_ip,

                typical_location=(
                    profile.typical_location
                ),

                typical_login_frequency=(
                    profile.typical_login_frequency
                ),

                typical_files_accessed=(
                    profile.typical_files_accessed
                ),

                typical_data_transfer_bytes=(
                    profile.typical_data_transfer_bytes
                ),

                behavior_profile=(
                    profile.behavior_profile
                ),

                is_active=True,
            )

            db.add(employee)

            inserted += 1

            inserted_departments[
                employee.department
            ] += 1

        db.commit()

        total_employees = len(
            db.scalars(
                select(Employee)
            ).all()
        )

        print()
        print(
            "SENTINEL company generation completed."
        )

        print("=" * 55)

        print(
            f"Inserted employees : {inserted}"
        )

        print(
            f"Skipped employees  : {skipped}"
        )

        print(
            f"Database workforce : {total_employees}"
        )

        print()
        print("New Employee Distribution")
        print("-" * 55)

        for department, count in sorted(
            inserted_departments.items()
        ):
            print(
                f"{department:<20}"
                f"{count:>4}"
            )

        print("=" * 55)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    generate_company()