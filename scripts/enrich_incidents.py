"""
Generate structured investigation intelligence for SENTINEL incidents.

This enriches existing correlated incidents with:
- severity rationale
- key findings
- investigation workflow
- analyst questions
- containment guidance
"""

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
from app.models import Incident  # noqa: E402

from app.services.investigation_engine import (  # noqa: E402
    InvestigationEngine,
)


def enrich_incidents() -> None:
    db = SessionLocal()

    try:
        incidents = list(
            db.scalars(
                select(
                    Incident
                )
                .order_by(
                    Incident.first_seen
                )
            ).all()
        )

        if not incidents:
            raise RuntimeError(
                "No incidents were found. "
                "Run generate_incidents.py first."
            )

        engine = (
            InvestigationEngine()
        )

        updated = 0

        for incident in incidents:
            result = engine.analyze(
                incident
            )

            incident.investigation_steps = (
                result.investigation_steps
            )

            evidence = dict(
                incident.evidence
                or {}
            )

            evidence[
                "investigation"
            ] = {
                "engine": (
                    "structured-investigation"
                ),

                "version": "1.0",

                "severity_rationale": (
                    result
                    .severity_rationale
                ),

                "key_findings": (
                    result.key_findings
                ),

                "analyst_questions": (
                    result
                    .analyst_questions
                ),

                "containment_actions": (
                    result
                    .containment_actions
                ),
            }

            incident.evidence = (
                evidence
            )

            updated += 1

        db.commit()

        print()
        print(
            "SENTINEL investigation enrichment complete."
        )

        print("=" * 72)

        print(
            f"Incidents processed     : "
            f"{len(incidents)}"
        )

        print(
            f"Incidents enriched      : "
            f"{updated}"
        )

        print(
            "Investigation engine    : "
            "structured-investigation v1.0"
        )

        print("=" * 72)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    enrich_incidents()