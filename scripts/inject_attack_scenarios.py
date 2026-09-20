"""
Inject SENTINEL's five controlled benchmark attack scenarios.

Ground-truth architecture
-------------------------
Scenario generators create ordinary observable Event records.

This orchestration layer separately records private evaluation truth in:

    simulation_ground_truth

Benchmark provenance is represented by benchmark_batch_id and does not
create a SimulationRun.

Event contains no authoritative simulator attack label.

The controlled benchmark therefore evaluates SENTINEL without supplying
attack truth to the operational detection pipeline.
"""

from __future__ import annotations

from collections import Counter
from datetime import (
    datetime,
    timezone,
)
from pathlib import Path
import sys

from sqlalchemy import select


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


# ============================================================
# Application imports
# ============================================================

from app.database.session import SessionLocal  # noqa: E402

from app.models import (  # noqa: E402
    Employee,
    Event,
    SimulationGroundTruth,
)

from app.services.simulation_runtime import (  # noqa: E402
    generate_scenario_instance_id,
    record_simulation_ground_truth,
)

from simulator.scenarios import (  # noqa: E402
    AccountTakeoverScenario,
    BruteForceScenario,
    DataExfiltrationScenario,
    InsiderThreatScenario,
    NetworkScanScenario,
)


# ============================================================
# Canonical benchmark configuration
# ============================================================

SIMULATION_BATCH = (
    "phase3_attack_batch_01"
)


SCENARIO_TARGETS = {
    "BRUTE_FORCE":
        "user_021",

    "ACCOUNT_TAKEOVER":
        "user_037",

    "DATA_EXFILTRATION":
        "user_052",

    "INSIDER_THREAT":
        "user_068",

    "NETWORK_SCAN":
        "user_084",
}


# ============================================================
# Helpers
# ============================================================

def get_employee(
    db,
    user_id: str,
) -> Employee:
    """
    Load one canonical scenario target employee.
    """

    employee = db.scalar(
        select(
            Employee
        )
        .where(
            Employee.user_id
            == user_id
        )
    )

    if employee is None:
        raise RuntimeError(
            f"{user_id} was not found."
        )

    return employee


def _private_attack_batch_exists(
    db,
) -> bool:
    """
    Detect whether the controlled benchmark batch already exists.

    Dedicated benchmark provenance is authoritative.
    Event metadata is not used for duplicate protection.
    """

    existing = db.scalar(
        select(
            SimulationGroundTruth.id
        )
        .where(
            SimulationGroundTruth
            .benchmark_batch_id
            == SIMULATION_BATCH
        )
        .limit(1)
    )

    return (
        existing is not None
    )


def _scenario_runs():
    """
    Return SENTINEL's fixed canonical benchmark attack schedule.

    These timestamps and employee targets are part of the reproducible
    benchmark contract and must remain unchanged.
    """

    return [
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


# ============================================================
# Injection
# ============================================================

def inject_attack_scenarios() -> None:
    db = SessionLocal()

    try:
        # ----------------------------------------------------
        # Authoritative duplicate protection
        # ----------------------------------------------------

        if _private_attack_batch_exists(
            db
        ):
            print(
                "Controlled attack batch already exists "
                "in private ground truth."
            )

            print(
                "No duplicate attack events were created."
            )

            return


        # ----------------------------------------------------
        # Generate canonical observable events
        # ----------------------------------------------------

        generated_events: list[
            Event
        ] = []

        scenario_counts: Counter[
            str
        ] = Counter()

        generated_scenarios: list[
            tuple[
                object,
                str,
                list[Event],
                str,
            ]
        ] = []

        for (
            scenario,
            user_id,
            start_time,
        ) in _scenario_runs():

            employee = get_employee(
                db,
                user_id,
            )

            events = (
                scenario.generate(
                    employee=employee,
                    start_time=start_time,
                )
            )

            scenario_instance_id = (
                generate_scenario_instance_id(
                    scenario.scenario_type
                )
            )

            for event in events:
                scenario_counts[
                    scenario.scenario_type
                ] += 1

            generated_events.extend(
                events
            )

            generated_scenarios.append(
                (
                    scenario,
                    user_id,
                    events,
                    scenario_instance_id,
                )
            )

        # ----------------------------------------------------
        # Persist Events first
        # ----------------------------------------------------
        #
        # flush() assigns Event UUIDs while retaining a single
        # transaction for Event + private truth.
        # ----------------------------------------------------

        db.add_all(
            generated_events
        )

        db.flush()

        # ----------------------------------------------------
        # Persist authoritative private truth
        # ----------------------------------------------------

        private_truth_count = 0

        for (
            scenario,
            user_id,
            events,
            scenario_instance_id,
        ) in generated_scenarios:

            for (
                sequence_number,
                event,
            ) in enumerate(
                events,
                start=1,
            ):
                record_simulation_ground_truth(
                    db=db,

                    benchmark_batch_id=(
                        SIMULATION_BATCH
                    ),

                    event=event,

                    scenario_instance_id=(
                        scenario_instance_id
                    ),

                    scenario_type=(
                        scenario.scenario_type
                    ),

                    is_injected=True,

                    attack_stage=None,

                    sequence_number=(
                        sequence_number
                    ),

                    metadata={
                        "target_user_id":
                            user_id,

                        "benchmark":
                            True,
                    },
                )

                private_truth_count += 1


        # Observable Events and private benchmark truth
        # are committed atomically.
        db.commit()

        # ----------------------------------------------------
        # Report
        # ----------------------------------------------------

        print()

        print(
            "SENTINEL attack injection completed."
        )

        print(
            "=" * 62
        )

        print(
            f"Injected scenario events: "
            f"{len(generated_events)}"
        )

        print(
            f"Private truth records    : "
            f"{private_truth_count}"
        )

        print(
            f"Benchmark batch          : "
            f"{SIMULATION_BATCH}"
        )

        print()

        print(
            "Scenario Distribution"
        )

        print(
            "-" * 62
        )

        for (
            scenario,
            count,
        ) in sorted(
            scenario_counts.items()
        ):
            print(
                f"{scenario:<24}"
                f"{count:>6}"
            )

        print(
            "=" * 62
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    inject_attack_scenarios()