"""
Add synthetic employees to SENTINEL's operational company.

This utility is intentionally additive.

Every run:

1. inspects the existing employee population;
2. continues after the highest generated user ID;
3. balances department assignments against the full workforce;
4. creates Pakistan/Karachi-localized synthetic employee identities;
5. never overwrites existing employees.

Examples
--------

Add 10 employees:

    python scripts/generate_employees.py --count 10

Add 100 employees using base seed 42:

    python scripts/generate_employees.py --count 100 --seed 42
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

from sqlalchemy import (
    func,
    select,
)


# ============================================================
# Repository bootstrap
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

BACKEND_ROOT = (
    PROJECT_ROOT
    / "backend"
)

for path in (
    PROJECT_ROOT,
    BACKEND_ROOT,
):
    path_string = str(
        path
    )

    if (
        path_string
        not in sys.path
    ):
        sys.path.insert(
            0,
            path_string,
        )


from app.database.session import SessionLocal  # noqa: E402
from app.models import Employee  # noqa: E402
from simulator.company.departments import (  # noqa: E402
    DEPARTMENTS,
)
from simulator.company.workforce import (  # noqa: E402
    append_employees,
)


# ============================================================
# CLI
# ============================================================

def parse_args(
) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Add balanced, localized synthetic employees "
            "to SENTINEL's operational company."
        )
    )

    parser.add_argument(
        "--count",
        type=int,
        required=True,
        help=(
            "Number of new employees to add."
        ),
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help=(
            "Base random seed. "
            "Default: 42."
        ),
    )

    return parser.parse_args()


# ============================================================
# Reporting
# ============================================================

def _department_distribution(
    db,
) -> dict[str, int]:
    distribution = {
        department: 0
        for department
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
        if department in distribution:
            distribution[
                department
            ] = int(
                count
            )

    return distribution


def _print_distribution(
    *,
    distribution: dict[str, int],
) -> None:
    total = sum(
        distribution.values()
    )

    print()
    print(
        "Operational workforce distribution"
    )
    print(
        "-" * 68
    )

    for department, profile in (
        DEPARTMENTS.items()
    ):
        count = (
            distribution[
                department
            ]
        )

        actual_percent = (
            0.0
            if total == 0
            else (
                count
                / total
                * 100
            )
        )

        target_percent = (
            profile.workforce_weight
            * 100
        )

        print(
            f"{department:<20} "
            f"{count:>4} "
            f"actual={actual_percent:>6.2f}% "
            f"target={target_percent:>6.2f}%"
        )

    print(
        "-" * 68
    )

    print(
        f"{'Total':<20} "
        f"{total:>4}"
    )


# ============================================================
# Generation
# ============================================================

def generate_employees(
    *,
    employee_count: int,
    seed: int,
) -> None:
    db = (
        SessionLocal()
    )

    try:
        before_distribution = (
            _department_distribution(
                db
            )
        )

        before_total = sum(
            before_distribution.values()
        )

        result = (
            append_employees(
                db=db,
                employee_count=(
                    employee_count
                ),
                seed=(
                    seed
                ),
            )
        )

        db.commit()

        after_distribution = (
            _department_distribution(
                db
            )
        )

        print()
        print(
            "SENTINEL employee generation complete."
        )

        print(
            "=" * 68
        )

        print(
            f"Employees before        : "
            f"{before_total:,}"
        )

        print(
            f"Employees created       : "
            f"{result.created_count:,}"
        )

        print(
            f"Created range           : "
            f"{result.first_user_id} "
            f"-> "
            f"{result.last_user_id}"
        )

        print(
            f"Requested seed          : "
            f"{result.requested_seed}"
        )

        print(
            f"Effective run seed      : "
            f"{result.effective_seed}"
        )

        print(
            f"Total employees         : "
            f"{result.total_employee_count:,}"
        )

        print(
            "=" * 68
        )

        _print_distribution(
            distribution=(
                after_distribution
            )
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


def main() -> None:
    args = (
        parse_args()
    )

    generate_employees(
        employee_count=(
            args.count
        ),
        seed=(
            args.seed
        ),
    )


if __name__ == "__main__":
    main()
