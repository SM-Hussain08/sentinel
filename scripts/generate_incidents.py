"""
Generate correlated SENTINEL security incidents.

The incident engine uses observable event data and Isolation Forest scores.
Simulator ground-truth labels are never used during incident generation.
"""

from collections import Counter
from pathlib import Path
import sys

from sqlalchemy import select


PROJECT_ROOT = (
    Path(__file__).resolve().parents[1]
)

BACKEND_ROOT = (
    PROJECT_ROOT / "backend"
)


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

from app.models import (  # noqa: E402
    Incident,
    IncidentEvent,
)

from app.services.incident_correlation import (  # noqa: E402
    IncidentCorrelationEngine,
)


def generate_incident_id(
    sequence_number: int,
) -> str:
    return (
        f"INC-2026-"
        f"{sequence_number:04d}"
    )


def generate_incidents() -> None:
    db = SessionLocal()

    try:
        engine = (
            IncidentCorrelationEngine(
                db=db,
            )
        )

        candidates = (
            engine.correlate()
        )

        existing_incidents = list(
            db.scalars(
                select(
                    Incident
                )
                .order_by(
                    Incident.incident_id
                )
            ).all()
        )

        existing_keys = {
            (
                incident.primary_employee_id,
                incident.incident_type,
                incident.first_seen,
                incident.last_seen,
            )
            for incident
            in existing_incidents
        }

        next_sequence = (
            len(existing_incidents)
            + 1
        )

        inserted = 0
        skipped = 0

        incident_type_counts: Counter[
            str
        ] = Counter()

        severity_counts: Counter[
            str
        ] = Counter()

        for candidate in candidates:
            incident_key = (
                candidate
                .primary_employee
                .id,

                candidate
                .incident_type,

                candidate
                .first_seen,

                candidate
                .last_seen,
            )

            if (
                incident_key
                in existing_keys
            ):
                skipped += 1
                continue

            incident = Incident(
                incident_id=(
                    generate_incident_id(
                        next_sequence
                    )
                ),

                title=candidate.title,

                incident_type=(
                    candidate
                    .incident_type
                ),

                severity=(
                    candidate.severity
                ),

                status="OPEN",

                primary_employee_id=(
                    candidate
                    .primary_employee
                    .id
                ),

                first_seen=(
                    candidate.first_seen
                ),

                last_seen=(
                    candidate.last_seen
                ),

                event_count=len(
                    candidate.events
                ),

                anomaly_count=(
                    candidate
                    .anomaly_count
                ),

                max_anomaly_score=(
                    candidate
                    .max_anomaly_score
                ),

                summary=(
                    candidate.summary
                ),

                correlation_reason=(
                    candidate
                    .correlation_reason
                ),

                indicators=(
                    candidate.indicators
                ),

                evidence=(
                    candidate.evidence
                ),

                # Phase 5.3 will populate this.
                investigation_steps=[],
            )

            db.add(
                incident
            )

            db.flush()

            for (
                sequence,
                item,
            ) in enumerate(
                candidate.events,
                start=1,
            ):
                link = IncidentEvent(
                    incident_uuid=(
                        incident.id
                    ),

                    event_uuid=(
                        item.event.id
                    ),

                    sequence_number=(
                        sequence
                    ),

                    correlation_score=float(
                        item.anomaly
                        .anomaly_score
                    ),

                    correlation_reason=(
                        "Identity, temporal "
                        "proximity, and behavioral "
                        "risk correlation."
                    ),
                )

                db.add(
                    link
                )

            existing_keys.add(
                incident_key
            )

            incident_type_counts[
                candidate.incident_type
            ] += 1

            severity_counts[
                candidate.severity
            ] += 1

            inserted += 1
            next_sequence += 1

        db.commit()

        print()
        print(
            "SENTINEL incident correlation complete."
        )

        print("=" * 72)

        print(
            f"Incident candidates     : "
            f"{len(candidates)}"
        )

        print(
            f"New incidents           : "
            f"{inserted}"
        )

        print(
            f"Existing incidents      : "
            f"{skipped}"
        )

        print()
        print(
            "Incident Type Distribution"
        )

        print("-" * 72)

        for (
            incident_type,
            count,
        ) in sorted(
            incident_type_counts.items()
        ):
            print(
                f"{incident_type:<38}"
                f"{count:>6}"
            )

        print()
        print(
            "Severity Distribution"
        )

        print("-" * 72)

        for (
            severity,
            count,
        ) in sorted(
            severity_counts.items()
        ):
            print(
                f"{severity:<16}"
                f"{count:>6}"
            )

        print("=" * 72)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    generate_incidents()