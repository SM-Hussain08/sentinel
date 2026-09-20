"""
Generate SENTINEL's canonical benchmark company.

This command is intended for a fresh, isolated benchmark database.

Canonical configuration:
    employees = 100
    seed      = 42

The employee table must be empty. This prevents partially populated databases
from silently changing benchmark results.
"""

from __future__ import annotations

from pathlib import Path
import sys


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
from simulator.company.workforce import (  # noqa: E402
    generate_canonical_company,
)


# ============================================================
# Canonical benchmark configuration
# ============================================================

TOTAL_COMPANY_SIZE = 100

BENCHMARK_SEED = 42


def generate_company() -> None:
    """
    Generate and persist the canonical benchmark workforce.
    """

    db = SessionLocal()

    try:
        result = (
            generate_canonical_company(
                db=db,

                employee_count=(
                    TOTAL_COMPANY_SIZE
                ),

                seed=(
                    BENCHMARK_SEED
                ),
            )
        )

        db.commit()

        print()
        print(
            "SENTINEL canonical company generated."
        )

        print(
            "=" * 68
        )

        print(
            f"Employees created       : "
            f"{result.created_count:,}"
        )

        print(
            f"First employee          : "
            f"{result.first_user_id}"
        )

        print(
            f"Last employee           : "
            f"{result.last_user_id}"
        )

        print(
            f"Benchmark seed          : "
            f"{result.requested_seed}"
        )

        print(
            f"Total employees         : "
            f"{result.total_employee_count:,}"
        )

        print(
            "=" * 68
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    generate_company()