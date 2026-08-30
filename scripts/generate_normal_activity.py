"""
Generate several days of normal SENTINEL corporate activity.

This is the first bulk event simulation used to create historical
behavior for later feature engineering and Isolation Forest training.
"""

from collections import Counter
from datetime import date, timedelta
from pathlib import Path
import sys

from sqlalchemy import select


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

sys.path.insert(
    0,
    str(PROJECT_ROOT),
)

sys.path.insert(
    0,
    str(BACKEND_ROOT),
)


from app.database.session import SessionLocal  # noqa: E402
from app.models import Employee, Event  # noqa: E402
from simulator.generators import NormalActivityGenerator  # noqa: E402


SIMULATION_DAYS = 3

START_DATE = date(
    2026,
    8,
    24,
)


def generate_normal_activity() -> None:
    db = SessionLocal()

    try:
        employees = list(
            db.scalars(
                select(Employee).where(
                    Employee.is_active.is_(True)
                )
                .order_by(
                    Employee.user_id
                )
            ).all()
        )

        if not employees:
            raise RuntimeError(
                "No employees found. "
                "Generate the synthetic company first."
            )

        generator = (
            NormalActivityGenerator(
                seed=2026,
            )
        )

        generated_events: list[Event] = []

        event_types: Counter[str] = (
            Counter()
        )

        for day_offset in range(
            SIMULATION_DAYS
        ):
            simulation_date = (
                START_DATE
                + timedelta(
                    days=day_offset,
                )
            )

            for employee in employees:
                events = (
                    generator.generate_employee_day(
                        employee=employee,
                        simulation_date=simulation_date,
                    )
                )

                generated_events.extend(
                    events
                )

                event_types.update(
                    event.event_type
                    for event in events
                )

        db.add_all(
            generated_events
        )

        db.commit()

        print()
        print(
            "SENTINEL normal activity simulation complete."
        )

        print("=" * 60)

        print(
            f"Employees simulated : "
            f"{len(employees)}"
        )

        print(
            f"Simulation days     : "
            f"{SIMULATION_DAYS}"
        )

        print(
            f"Events generated    : "
            f"{len(generated_events)}"
        )

        print()
        print("Event Distribution")
        print("-" * 60)

        for event_type, count in sorted(
            event_types.items()
        ):
            print(
                f"{event_type:<24}"
                f"{count:>6}"
            )

        print("=" * 60)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    generate_normal_activity()