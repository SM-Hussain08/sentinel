from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Employee, Event


REQUIRED_EVENT_TYPES = {
    "LOGIN_SUCCESS",
    "LOGIN_FAILURE",
    "LOGOUT",
    "FILE_ACCESS",
    "FILE_DOWNLOAD",
    "FILE_UPLOAD",
    "DATABASE_ACCESS",
    "NETWORK_CONNECTION",
}


REQUIRED_SCENARIOS = {
    "BRUTE_FORCE",
    "ACCOUNT_TAKEOVER",
    "DATA_EXFILTRATION",
    "INSIDER_THREAT",
    "NETWORK_SCAN",
}


@dataclass
class ValidationResult:
    """
    Stores one dataset validation check.
    """

    name: str
    passed: bool
    message: str


@dataclass
class DatasetValidationReport:
    """
    Collection of validation checks for one SENTINEL dataset.
    """

    results: list[ValidationResult] = field(
        default_factory=list
    )

    def add(
        self,
        name: str,
        passed: bool,
        message: str,
    ) -> None:
        self.results.append(
            ValidationResult(
                name=name,
                passed=passed,
                message=message,
            )
        )

    @property
    def passed_count(self) -> int:
        return sum(
            result.passed
            for result in self.results
        )

    @property
    def failed_count(self) -> int:
        return (
            len(self.results)
            - self.passed_count
        )

    @property
    def all_passed(self) -> bool:
        return self.failed_count == 0


class DatasetValidator:
    """
    Performs structural and behavioral quality checks against the
    SENTINEL synthetic dataset.
    """

    def __init__(
        self,
        db: Session,
    ) -> None:
        self.db = db

    def _count_employees(self) -> int:
        return int(
            self.db.scalar(
                select(
                    func.count(
                        Employee.id
                    )
                )
            )
            or 0
        )

    def _count_events(self) -> int:
        return int(
            self.db.scalar(
                select(
                    func.count(
                        Event.id
                    )
                )
            )
            or 0
        )

    def _event_types(
        self,
    ) -> set[str]:
        rows = self.db.execute(
            select(
                Event.event_type
            )
            .distinct()
        ).scalars()

        return set(rows)

    def _scenario_types(
        self,
    ) -> set[str]:
        rows = self.db.execute(
            select(
                Event.scenario_type
            )
            .where(
                Event.scenario_type.is_not(
                    None
                )
            )
            .distinct()
        ).scalars()

        return {
            value
            for value in rows
            if value
        }

    def _count_injected(
        self,
    ) -> int:
        return int(
            self.db.scalar(
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

    def _count_normal(
        self,
    ) -> int:
        return int(
            self.db.scalar(
                select(
                    func.count(
                        Event.id
                    )
                )
                .where(
                    Event.is_injected_anomaly.is_(
                        False
                    )
                )
            )
            or 0
        )

    def _count_invalid_ground_truth(
        self,
    ) -> int:
        """
        Normal events should never carry an attack scenario label.
        """

        return int(
            self.db.scalar(
                select(
                    func.count(
                        Event.id
                    )
                )
                .where(
                    Event.is_injected_anomaly.is_(
                        False
                    ),
                    Event.scenario_type.is_not(
                        None
                    ),
                )
            )
            or 0
        )

    def _duplicate_event_ids(
        self,
    ) -> int:
        duplicate_rows = self.db.execute(
            select(
                Event.event_id
            )
            .group_by(
                Event.event_id
            )
            .having(
                func.count(
                    Event.id
                )
                > 1
            )
        ).all()

        return len(
            duplicate_rows
        )

    def _null_employee_events(
        self,
    ) -> int:
        """
        Verify that all events still map to a valid employee.
        """

        count = self.db.scalar(
            select(
                func.count(
                    Event.id
                )
            )
            .outerjoin(
                Employee,
                Event.employee_id
                == Employee.id,
            )
            .where(
                Employee.id.is_(
                    None
                )
            )
        )

        return int(
            count or 0
        )

    def _employee_department_count(
        self,
    ) -> int:
        count = self.db.scalar(
            select(
                func.count(
                    func.distinct(
                        Employee.department
                    )
                )
            )
        )

        return int(
            count or 0
        )

    def validate(
        self,
    ) -> DatasetValidationReport:
        report = (
            DatasetValidationReport()
        )

        employee_count = (
            self._count_employees()
        )

        event_count = (
            self._count_events()
        )

        normal_count = (
            self._count_normal()
        )

        injected_count = (
            self._count_injected()
        )

        event_types = (
            self._event_types()
        )

        scenario_types = (
            self._scenario_types()
        )

        report.add(
            name="employee_count",
            passed=employee_count >= 100,
            message=(
                f"Employees available: "
                f"{employee_count}"
            ),
        )

        report.add(
            name="event_volume",
            passed=event_count >= 5000,
            message=(
                f"Events available: "
                f"{event_count}"
            ),
        )

        report.add(
            name="department_diversity",
            passed=(
                self._employee_department_count()
                >= 5
            ),
            message=(
                "At least five departments "
                "are represented."
            ),
        )

        missing_events = (
            REQUIRED_EVENT_TYPES
            - event_types
        )

        report.add(
            name="required_event_types",
            passed=not missing_events,
            message=(
                "All required event types present."
                if not missing_events
                else (
                    "Missing event types: "
                    + ", ".join(
                        sorted(
                            missing_events
                        )
                    )
                )
            ),
        )

        missing_scenarios = (
            REQUIRED_SCENARIOS
            - scenario_types
        )

        report.add(
            name="attack_scenarios",
            passed=not missing_scenarios,
            message=(
                "All attack scenarios present."
                if not missing_scenarios
                else (
                    "Missing scenarios: "
                    + ", ".join(
                        sorted(
                            missing_scenarios
                        )
                    )
                )
            ),
        )

        total_labeled = (
            normal_count
            + injected_count
        )

        anomaly_rate = (
            injected_count
            / total_labeled
            if total_labeled
            else 0.0
        )

        report.add(
            name="anomaly_prevalence",
            passed=(
                0.005
                <= anomaly_rate
                <= 0.10
            ),
            message=(
                f"Injected anomaly rate: "
                f"{anomaly_rate:.2%}"
            ),
        )

        invalid_ground_truth = (
            self._count_invalid_ground_truth()
        )

        report.add(
            name="ground_truth_integrity",
            passed=(
                invalid_ground_truth == 0
            ),
            message=(
                "Normal events carrying "
                f"scenario labels: "
                f"{invalid_ground_truth}"
            ),
        )

        duplicate_ids = (
            self._duplicate_event_ids()
        )

        report.add(
            name="unique_event_ids",
            passed=(
                duplicate_ids == 0
            ),
            message=(
                f"Duplicate event IDs: "
                f"{duplicate_ids}"
            ),
        )

        orphaned_events = (
            self._null_employee_events()
        )

        report.add(
            name="employee_references",
            passed=(
                orphaned_events == 0
            ),
            message=(
                "Events without valid "
                f"employees: "
                f"{orphaned_events}"
            ),
        )

        return report