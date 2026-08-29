"""
Analyze SENTINEL's first stored security event.

This script validates the complete anomaly-analysis path:

PostgreSQL event
    -> employee baseline
    -> feature engineering
    -> behavioral detector
    -> anomaly score
    -> PostgreSQL
"""

from pathlib import Path
import sys

from sqlalchemy import select


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

sys.path.insert(0, str(BACKEND_ROOT))


from app.database.session import SessionLocal  # noqa: E402
from app.models import Employee, Event  # noqa: E402
from app.services.anomaly_scoring import analyze_event  # noqa: E402


def run_analysis() -> None:
    db = SessionLocal()

    try:
        statement = (
            select(Event, Employee)
            .join(
                Employee,
                Event.employee_id == Employee.id,
            )
            .where(
                Event.event_id == "EVT-2026-000001"
            )
        )

        result = db.execute(statement).first()

        if result is None:
            raise RuntimeError(
                "EVT-2026-000001 was not found. "
                "Run the initial seed script first."
            )

        event, employee = result

        anomaly = analyze_event(
            db=db,
            event=event,
            employee=employee,
        )

        print()
        print("SENTINEL anomaly analysis completed.")
        print("---------------------------------------------")
        print(f"Event       : {event.event_id}")
        print(f"Employee    : {employee.user_id}")
        print(f"Event Type  : {event.event_type}")
        print(f"Score       : {anomaly.anomaly_score:.2f}")
        print(f"Risk Level  : {anomaly.risk_level}")
        print(f"Detector    : {anomaly.detector_name}")
        print(f"Version     : {anomaly.detector_version}")
        print("---------------------------------------------")

        print()
        print("Features:")

        for key, value in anomaly.feature_snapshot.items():
            print(f"  {key}: {value}")

        print()
        print("Explanation:")

        for reason in anomaly.explanation.get(
            "reasons",
            [],
        ):
            print(f"  - {reason}")

    finally:
        db.close()


if __name__ == "__main__":
    run_analysis()