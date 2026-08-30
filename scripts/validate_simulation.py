"""
Validate and summarize the SENTINEL Phase 3 synthetic dataset.

This script performs:
- data quality validation
- workforce summary
- event distribution
- attack ground-truth summary
- anomaly prevalence reporting

It does not modify the database.
"""

from pathlib import Path
import sys

from sqlalchemy import func, select


# ---------------------------------------------------------
# Import setup
# ---------------------------------------------------------
#
# Allow this script to be executed directly from the repository root:
#
#     python scripts/validate_simulation.py
#
# without requiring a manual PYTHONPATH.
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

for path in (
    PROJECT_ROOT,
    BACKEND_ROOT,
):
    path_string = str(path)

    if path_string not in sys.path:
        sys.path.insert(
            0,
            path_string,
        )


from app.database.session import SessionLocal  # noqa: E402
from app.models import Employee, Event  # noqa: E402
from simulator.validation import DatasetValidator  # noqa: E402


def print_section(
    title: str,
) -> None:
    print()
    print(title)
    print("=" * 68)


def validate_simulation() -> None:
    db = SessionLocal()

    try:
        validator = DatasetValidator(
            db=db,
        )

        report = validator.validate()

        employee_count = int(
            db.scalar(
                select(
                    func.count(
                        Employee.id
                    )
                )
            )
            or 0
        )

        event_count = int(
            db.scalar(
                select(
                    func.count(
                        Event.id
                    )
                )
            )
            or 0
        )

        injected_count = int(
            db.scalar(
                select(
                    func.count(
                        Event.id
                    )
                )
                .where(
                    Event.is_injected_anomaly.is_(
                        True
                    )
                )
            )
            or 0
        )

        normal_count = (
            event_count
            - injected_count
        )

        print()
        print(
            "SENTINEL PHASE 3 DATASET REPORT"
        )

        print("=" * 68)

        print(
            "Synthetic Corporate Environment "
            "Validation"
        )

        print_section(
            "Dataset Overview"
        )

        print(
            f"Employees              : "
            f"{employee_count:,}"
        )

        print(
            f"Total Events           : "
            f"{event_count:,}"
        )

        print(
            f"Normal Events          : "
            f"{normal_count:,}"
        )

        print(
            f"Injected Events        : "
            f"{injected_count:,}"
        )

        anomaly_rate = (
            injected_count
            / event_count
            if event_count
            else 0
        )

        print(
            f"Ground-Truth Rate      : "
            f"{anomaly_rate:.2%}"
        )

        # -------------------------------------------------
        # Departments
        # -------------------------------------------------

        department_rows = db.execute(
            select(
                Employee.department,
                func.count(
                    Employee.id
                ),
            )
            .group_by(
                Employee.department
            )
            .order_by(
                func.count(
                    Employee.id
                ).desc()
            )
        ).all()

        print_section(
            "Workforce Distribution"
        )

        for (
            department,
            count,
        ) in department_rows:
            print(
                f"{department:<24}"
                f"{count:>5}"
            )

        # -------------------------------------------------
        # Event types
        # -------------------------------------------------

        event_rows = db.execute(
            select(
                Event.event_type,
                func.count(
                    Event.id
                ),
            )
            .group_by(
                Event.event_type
            )
            .order_by(
                func.count(
                    Event.id
                ).desc()
            )
        ).all()

        print_section(
            "Event Distribution"
        )

        for (
            event_type,
            count,
        ) in event_rows:
            print(
                f"{event_type:<24}"
                f"{count:>7}"
            )

        # -------------------------------------------------
        # Attack scenarios
        # -------------------------------------------------

        scenario_rows = db.execute(
            select(
                Event.scenario_type,
                func.count(
                    Event.id
                ),
            )
            .where(
                Event.is_injected_anomaly.is_(
                    True
                )
            )
            .group_by(
                Event.scenario_type
            )
            .order_by(
                func.count(
                    Event.id
                ).desc()
            )
        ).all()

        print_section(
            "Attack Ground Truth"
        )

        for (
            scenario,
            count,
        ) in scenario_rows:
            print(
                f"{str(scenario):<24}"
                f"{count:>7}"
            )

        # -------------------------------------------------
        # Quality validation
        # -------------------------------------------------

        print_section(
            "Quality Validation"
        )

        for result in report.results:
            indicator = (
                "PASS"
                if result.passed
                else "FAIL"
            )

            print(
                f"[{indicator:<4}] "
                f"{result.name:<24} "
                f"{result.message}"
            )

        print()
        print("-" * 68)

        print(
            f"Checks passed : "
            f"{report.passed_count}"
        )

        print(
            f"Checks failed : "
            f"{report.failed_count}"
        )

        print()

        if report.all_passed:
            print(
                "PHASE 3 DATASET STATUS: VALID"
            )
        else:
            print(
                "PHASE 3 DATASET STATUS: "
                "REVIEW REQUIRED"
            )

        print("=" * 68)

    finally:
        db.close()


if __name__ == "__main__":
    validate_simulation()