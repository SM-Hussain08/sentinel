from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from uuid import uuid4

from sqlalchemy import select


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


E2E_USER_ID = "e2e_user_001"

EVENT_PREFIX = "E2E-EVT-"


def build_event(
    *,
    employee: Employee,
    event_id: str,
    timestamp: datetime,
    event_type: str,
    success: bool,
    source_ip: str,
    source_location: str,
    resource_type: str,
    resource_name: str,
    bytes_sent: int = 0,
    bytes_received: int = 0,
    metadata: dict | None = None,
) -> Event:
    return Event(
        event_id=event_id,
        employee_id=employee.id,
        timestamp=timestamp,
        session_id="e2e-session-account-compromise",
        event_type=event_type,
        source_ip=source_ip,
        destination_ip="10.20.0.10",
        source_location=source_location,
        resource_type=resource_type,
        resource_name=resource_name,
        bytes_sent=bytes_sent,
        bytes_received=bytes_received,
        success=success,
        event_metadata=metadata or {},
    )


def seed_e2e() -> None:
    db = SessionLocal()

    try:
        existing_employee = db.scalar(
            select(Employee).where(
                Employee.user_id == E2E_USER_ID
            )
        )

        if existing_employee is not None:
            print(
                "E2E seed already exists. "
                "Use a fresh E2E database for a clean run."
            )
            return

        employee = Employee(
            user_id=E2E_USER_ID,
            name="E2E Security Analyst",
            department="Engineering",
            job_role="Platform Engineer",
            normal_start_hour=9,
            normal_end_hour=18,
            typical_ip="10.20.30.40",
            typical_location="Karachi HQ",
            typical_login_frequency=3,
            typical_files_accessed=20,
            typical_data_transfer_bytes=50_000_000,
            behavior_profile={
                "e2e_fixture": True,
                "typical_device": "E2E-WS-001",
            },
            is_active=True,
        )

        db.add(employee)
        db.flush()

        now = datetime.now(timezone.utc)

        events = [
            build_event(
                employee=employee,
                event_id=f"{EVENT_PREFIX}001",
                timestamp=now,
                event_type="LOGIN_FAILURE",
                success=False,
                source_ip="203.0.113.50",
                source_location="Unknown External Network",
                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",
                metadata={
                    "device": "UNKNOWN-E2E",
                    "protocol": "HTTPS",
                    "authentication_method": "PASSWORD",
                },
            ),
            build_event(
                employee=employee,
                event_id=f"{EVENT_PREFIX}002",
                timestamp=now + timedelta(seconds=30),
                event_type="LOGIN_FAILURE",
                success=False,
                source_ip="203.0.113.50",
                source_location="Unknown External Network",
                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",
                metadata={
                    "device": "UNKNOWN-E2E",
                    "protocol": "HTTPS",
                    "authentication_method": "PASSWORD",
                },
            ),
            build_event(
                employee=employee,
                event_id=f"{EVENT_PREFIX}003",
                timestamp=now + timedelta(seconds=60),
                event_type="LOGIN_FAILURE",
                success=False,
                source_ip="203.0.113.50",
                source_location="Unknown External Network",
                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",
                metadata={
                    "device": "UNKNOWN-E2E",
                    "protocol": "HTTPS",
                    "authentication_method": "PASSWORD",
                },
            ),
            build_event(
                employee=employee,
                event_id=f"{EVENT_PREFIX}004",
                timestamp=now + timedelta(seconds=90),
                event_type="LOGIN_SUCCESS",
                success=True,
                source_ip="203.0.113.50",
                source_location="Unknown External Network",
                resource_type="AUTH_SERVER",
                resource_name="corp-auth-01",
                metadata={
                    "device": "UNKNOWN-E2E",
                    "protocol": "HTTPS",
                    "authentication_method": "PASSWORD",
                },
            ),
            build_event(
                employee=employee,
                event_id=f"{EVENT_PREFIX}005",
                timestamp=now + timedelta(seconds=120),
                event_type="FILE_ACCESS",
                success=True,
                source_ip="203.0.113.50",
                source_location="Unknown External Network",
                resource_type="FILE_SHARE",
                resource_name="finance-payroll.xlsx",
                bytes_sent=2_000_000,
                bytes_received=25_000_000,
                metadata={
                    "classification": "RESTRICTED",
                    "device": "UNKNOWN-E2E",
                    "protocol": "SMB",
                },
            ),
        ]

        db.add_all(events)
        db.commit()

        print()
        print("SENTINEL E2E seed completed.")
        print("=" * 60)
        print(f"Employee     : {employee.user_id}")
        print(f"Events       : {len(events)}")
        print(f"First Event  : {events[0].event_id}")
        print(f"Last Event   : {events[-1].event_id}")
        print("=" * 60)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_e2e()