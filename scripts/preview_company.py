"""
Preview SENTINEL's synthetic corporate workforce.

This script does not modify the database.

It exists so generated employee distributions and behavioral profiles
can be inspected before persistence.
"""

from collections import Counter
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(PROJECT_ROOT),
)


from simulator.company import EmployeeGenerator  # noqa: E402


EMPLOYEE_COUNT = 100


def preview_company() -> None:
    generator = EmployeeGenerator(
        seed=42,
    )

    employees = generator.generate_company(
        employee_count=EMPLOYEE_COUNT,
    )

    department_counts = Counter(
        employee.department
        for employee in employees
    )

    print()
    print("SENTINEL Synthetic Company Preview")
    print("=" * 55)

    print()
    print(
        f"Employees generated: "
        f"{len(employees)}"
    )

    print()
    print("Department Distribution")
    print("-" * 55)

    for department, count in sorted(
        department_counts.items()
    ):
        percentage = (
            count
            / len(employees)
            * 100
        )

        print(
            f"{department:<20}"
            f"{count:>4} "
            f"({percentage:>5.1f}%)"
        )

    print()
    print("Sample Employees")
    print("-" * 55)

    for employee in employees[:8]:
        transfer_mb = (
            employee.typical_data_transfer_bytes
            / 1_000_000
        )

        print(
            f"{employee.user_id:<10} "
            f"{employee.name:<24} "
            f"{employee.department:<18}"
        )

        print(
            f"  Role: {employee.job_role}"
        )

        print(
            f"  Hours: "
            f"{employee.normal_start_hour:02d}:00"
            f" - "
            f"{employee.normal_end_hour:02d}:00"
        )

        print(
            f"  IP: {employee.typical_ip}"
        )

        print(
            f"  Files/day: "
            f"{employee.typical_files_accessed}"
        )

        print(
            f"  Transfer/day: "
            f"{transfer_mb:.0f} MB"
        )

        print()

    print("=" * 55)


if __name__ == "__main__":
    preview_company()