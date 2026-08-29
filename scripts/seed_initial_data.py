"""
Seed SENTINEL with a minimal development dataset.

This script creates:
1. One simulated employee.
2. One normal login event.

It exists only to verify the first complete database write path.
The full synthetic company generator will replace this later.
"""

from datetime import datetime, timezone
from pathlib import Path
import sys
from uuid import uuid4


# ---------------------------------------------------------
# Allow this script to import the backend application.
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"

sys.path.insert(0, str(BACKEND_ROOT))


from app.database.session import SessionLocal  # noqa: E402
from app.models import Employee, Event  # noqa: E402


def seed_initial_data() -> None:
    """
    Insert SENTINEL's first simulated employee and security event.
    """

    db = SessionLocal()

    try:
        existing_employee = (
            db.query(Employee)
            .filter(Employee.user_id == "user_001")
            .first()
        )

        if existing_employee:
            print("Seed data already exists.")
            print(f"Employee: {existing_employee.user_id}")
            return

        # -------------------------------------------------
        # Simulated employee behavioral baseline
        # -------------------------------------------------

        employee = Employee(
            user_id="user_001",
            name="Ayesha Khan",
            department="Engineering",
            job_role="Backend Engineer",
            normal_start_hour=9,
            normal_end_hour=18,
            typical_ip="10.20.3.44",
            typical_location="Karachi HQ",
            typical_login_frequency=3,
            typical_files_accessed=65,
            typical_data_transfer_bytes=850_000_000,
            behavior_profile={
                "remote_work_probability": 0.18,
                "late_work_probability": 0.08,
                "common_protocols": [
                    "HTTPS",
                    "SSH",
                ],
                "typical_device": "ENG-WS-001",
            },
        )

        db.add(employee)
        db.flush()

        # -------------------------------------------------
        # First normal SENTINEL security event
        # -------------------------------------------------

        event = Event(
            event_id="EVT-2026-000001",
            employee_id=employee.id,
            timestamp=datetime.now(timezone.utc),
            session_id=f"session-{uuid4().hex[:12]}",
            event_type="LOGIN_SUCCESS",
            source_ip=employee.typical_ip,
            destination_ip="10.20.0.10",
            source_location=employee.typical_location,
            resource_type="AUTH_SERVER",
            resource_name="corp-auth-01",
            bytes_sent=4_800,
            bytes_received=12_400,
            success=True,
            event_metadata={
                "device": "ENG-WS-001",
                "protocol": "HTTPS",
                "authentication_method": "PASSWORD",
            },
            is_injected_anomaly=False,
            scenario_type=None,
        )

        db.add(event)

        db.commit()

        print()
        print("SENTINEL initial seed completed successfully.")
        print("---------------------------------------------")
        print(f"Employee : {employee.user_id} - {employee.name}")
        print(f"Department: {employee.department}")
        print(f"Event    : {event.event_id}")
        print(f"Type     : {event.event_type}")
        print(f"Source IP: {event.source_ip}")
        print("---------------------------------------------")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_initial_data()