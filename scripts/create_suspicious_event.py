"""
Create SENTINEL's first intentionally suspicious security event.

The event simulates account misuse followed by unusually large data transfer.

Ground-truth fields are recorded for future model evaluation, but the anomaly
detector itself does not use those fields.
"""

from datetime import datetime, timezone
from pathlib import Path
import sys
from uuid import uuid4

from sqlalchemy import select


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

sys.path.insert(0, str(BACKEND_ROOT))


from app.database.session import SessionLocal  # noqa: E402
from app.models import Employee, Event  # noqa: E402
from app.services.anomaly_scoring import analyze_event  # noqa: E402


EVENT_ID = "EVT-2026-000002"


def create_suspicious_event() -> None:
    db = SessionLocal()

    try:
        existing_event = db.scalar(
            select(Event).where(
                Event.event_id == EVENT_ID
            )
        )

        if existing_event is not None:
            print(
                f"{EVENT_ID} already exists. "
                "The script will not create a duplicate."
            )
            return

        employee = db.scalar(
            select(Employee).where(
                Employee.user_id == "user_001"
            )
        )

        if employee is None:
            raise RuntimeError(
                "user_001 was not found. "
                "Run seed_initial_data.py first."
            )

        # Use 02:15 UTC deliberately so the event occurs far outside
        # this employee's configured 09:00-18:00 behavioral baseline.
        suspicious_timestamp = datetime(
            2026,
            8,
            30,
            2,
            15,
            tzinfo=timezone.utc,
        )

        event = Event(
            event_id=EVENT_ID,
            employee_id=employee.id,
            timestamp=suspicious_timestamp,
            session_id=f"session-{uuid4().hex[:12]}",
            event_type="FILE_DOWNLOAD",

            # Deliberately outside the employee's normal IP baseline.
            source_ip="185.220.101.44",

            destination_ip="203.0.113.45",
            source_location="Unknown External Network",

            resource_type="FILE_SERVER",
            resource_name="finance-archive-2026.zip",

            # About 8 GB transferred in one event.
            bytes_sent=8_000_000_000,
            bytes_received=25_000,

            success=True,

            event_metadata={
                "device": "UNKNOWN-DEVICE",
                "protocol": "HTTPS",
                "destination_type": "EXTERNAL",
            },

            # Simulator-only evaluation ground truth.
            is_injected_anomaly=True,
            scenario_type="DATA_EXFILTRATION",
        )

        db.add(event)
        db.commit()
        db.refresh(event)

        anomaly = analyze_event(
            db=db,
            event=event,
            employee=employee,
        )

        print()
        print("SENTINEL suspicious event created.")
        print("---------------------------------------------")
        print(f"Event       : {event.event_id}")
        print(f"Employee    : {employee.user_id}")
        print(f"Type        : {event.event_type}")
        print(f"Source IP   : {event.source_ip}")
        print(f"Bytes Sent  : {event.bytes_sent:,}")
        print(f"Score       : {anomaly.anomaly_score:.2f}")
        print(f"Risk Level  : {anomaly.risk_level}")
        print("---------------------------------------------")

        print()
        print("Detection Reasons:")

        for reason in anomaly.explanation.get(
            "reasons",
            [],
        ):
            print(f"  - {reason}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    create_suspicious_event()