"""
Inject SENTINEL's five initial controlled attack scenarios.

The scenario generators produce realistic ordinary event types rather than
explicit attack events. Hidden simulator ground-truth labels are stored only
for later model evaluation.

This script should currently be run ONCE.
"""

from collections import Counter
from datetime import datetime, timezone
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

from simulator.scenarios import (  # noqa: E402
    AccountTakeoverScenario,
    BruteForceScenario,
    DataExfiltrationScenario,
    InsiderThreatScenario,
    NetworkScanScenario,
)


SCENARIO_TARGETS = {
    "BRUTE_FORCE": "user_021",
    "ACCOUNT_TAKEOVER": "user_037",
    "DATA_EXFILTRATION": "user_052",
    "INSIDER_THREAT": "user_068",
    "NETWORK_SCAN": "user_084",
}


def get_employee(
    db,
    user_id: str,
) -> Employee:
    employee = db.scalar(
        select(Employee).where(
            Employee.user_id == user_id
        )
    )

    if employee is None:
        raise RuntimeError(
            f"{user_id} was not found."
        )

    return employee


def inject_attack_scenarios() -> None:
    db = SessionLocal()

    try:
        # Protect against accidental duplicate injection.
        existing_scenario_events = list(
            db.scalars(
                select(Event).where(
                    Event.is_injected_anomaly.is_(True),
                    Event.event_metadata[
                        "simulation_batch"
                    ].astext
                    == "phase3_attack_batch_01",
                )
            ).all()
        )

        if existing_scenario_events:
            print(
                "Phase 3 attack batch already exists."
            )

            print(
                "No duplicate attack events were created."
            )

            return

        scenario_runs = [
            (
                BruteForceScenario(),
                SCENARIO_TARGETS[
                    "BRUTE_FORCE"
                ],
                datetime(
                    2026,
                    8,
                    25,
                    2,
                    10,
                    tzinfo=timezone.utc,
                ),
            ),

            (
                AccountTakeoverScenario(),
                SCENARIO_TARGETS[
                    "ACCOUNT_TAKEOVER"
                ],
                datetime(
                    2026,
                    8,
                    25,
                    3,
                    20,
                    tzinfo=timezone.utc,
                ),
            ),

            (
                DataExfiltrationScenario(),
                SCENARIO_TARGETS[
                    "DATA_EXFILTRATION"
                ],
                datetime(
                    2026,
                    8,
                    26,
                    19,
                    40,
                    tzinfo=timezone.utc,
                ),
            ),

            (
                InsiderThreatScenario(),
                SCENARIO_TARGETS[
                    "INSIDER_THREAT"
                ],
                datetime(
                    2026,
                    8,
                    26,
                    20,
                    15,
                    tzinfo=timezone.utc,
                ),
            ),

            (
                NetworkScanScenario(),
                SCENARIO_TARGETS[
                    "NETWORK_SCAN"
                ],
                datetime(
                    2026,
                    8,
                    26,
                    23,
                    5,
                    tzinfo=timezone.utc,
                ),
            ),
        ]

        generated_events: list[Event] = []

        scenario_counts: Counter[str] = (
            Counter()
        )

        for (
            scenario,
            user_id,
            start_time,
        ) in scenario_runs:

            employee = get_employee(
                db,
                user_id,
            )

            events = scenario.generate(
                employee=employee,
                start_time=start_time,
            )

            for event in events:
                event.event_metadata[
                    "simulation_batch"
                ] = "phase3_attack_batch_01"

                scenario_counts[
                    scenario.scenario_type
                ] += 1

            generated_events.extend(
                events
            )

        db.add_all(
            generated_events
        )

        db.commit()

        print()
        print(
            "SENTINEL attack injection completed."
        )

        print("=" * 62)

        print(
            f"Injected events : "
            f"{len(generated_events)}"
        )

        print()
        print("Scenario Distribution")
        print("-" * 62)

        for scenario, count in sorted(
            scenario_counts.items()
        ):
            print(
                f"{scenario:<24}"
                f"{count:>6}"
            )

        print("=" * 62)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    inject_attack_scenarios()