"""
Run exactly one controlled SENTINEL live simulation scenario.

This optional one-shot utility is intended for deterministic end-to-end
development, testing, and demonstrations.

It ONLY:
- selects one active employee;
- generates observable Events using SENTINEL's existing scenario classes;
- persists those Events;
- stores simulator-private ground truth separately;
- records a short SimulationRun;
- exits.

It DOES NOT:
- score anomalies;
- invoke the incident correlation engine;
- create or update incidents;
- invoke deterministic investigation;
- invoke Ollama or any generative AI.

The utility is not part of normal SENTINEL startup. When the always-on
SENTINEL event processor is running, it independently discovers the newly
persisted Events and handles the operational pipeline:

    Event
        -> feature engineering
        -> anomaly scoring
        -> incident correlation
        -> deterministic investigation

Simulator-private ground truth remains separate from operational ML scoring
and is never supplied to the operational processing pipeline.
"""

from __future__ import annotations

import argparse
from datetime import (
    datetime,
    timezone,
)
from pathlib import Path
import random
import sys


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


from sqlalchemy import select  # noqa: E402

from app.database.session import (  # noqa: E402
    SessionLocal,
)

from app.models import (  # noqa: E402
    Employee,
)

from app.services.simulation_runtime import (  # noqa: E402
    create_simulation_run,
    generate_scenario_instance_id,
    mark_simulation_run_failed,
    mark_simulation_run_running,
    mark_simulation_run_stopped,
    mark_simulation_run_stopping,
    record_simulation_ground_truth,
    record_simulation_progress,
)

from simulator.runtime.scenario_orchestrator import (  # noqa: E402
    SCENARIO_FACTORIES,
    build_attack_stages,
)


DEFAULT_SEED = 9300


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate exactly one real SENTINEL "
            "attack scenario without invoking detection."
        )
    )

    parser.add_argument(
        "scenario_type",
        choices=sorted(
            SCENARIO_FACTORIES.keys()
        ),
        help="Scenario family to generate.",
    )

    parser.add_argument(
        "--employee",
        dest="employee_user_id",
        default=None,
        help=(
            "Optional employee user_id. "
            "If omitted, one active employee "
            "is selected deterministically."
        ),
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=(
            "Deterministic employee-selection seed. "
            f"Default: {DEFAULT_SEED}"
        ),
    )

    return parser.parse_args()


def select_employee(
    *,
    db,
    requested_user_id: str | None,
    seed: int,
) -> Employee:
    statement = (
        select(
            Employee
        )
        .where(
            Employee.is_active.is_(
                True
            )
        )
        .order_by(
            Employee.user_id.asc()
        )
    )

    employees = list(
        db.scalars(
            statement
        ).all()
    )

    if not employees:
        raise RuntimeError(
            "No active employees are available."
        )

    if requested_user_id is not None:
        for employee in employees:
            if (
                employee.user_id
                == requested_user_id
            ):
                return employee

        raise LookupError(
            (
                "Active employee was not found: "
                f"{requested_user_id}"
            )
        )

    randomizer = random.Random(
        seed
    )

    return randomizer.choice(
        employees
    )


def run_scenario(
    *,
    scenario_type: str,
    requested_user_id: str | None,
    seed: int,
) -> None:
    db = SessionLocal()

    simulation_run = None

    try:
        employee = select_employee(
            db=db,
            requested_user_id=(
                requested_user_id
            ),
            seed=seed,
        )

        scenario_factory = (
            SCENARIO_FACTORIES[
                scenario_type
            ]
        )

        scenario = (
            scenario_factory()
        )

        # Use current UTC time so the generated campaign behaves like
        # newly arriving operational telemetry.
        start_time = datetime.now(
            timezone.utc
        )

        events = list(
            scenario.generate(
                employee=employee,
                start_time=start_time,
            )
        )

        events.sort(
            key=lambda event: (
                event.timestamp
            )
        )

        if not events:
            raise RuntimeError(
                (
                    f"{scenario_type} generated "
                    "no Events."
                )
            )

        stages = build_attack_stages(
            scenario_type=scenario_type,
            event_count=len(
                events
            ),
        )

        if (
            len(stages)
            != len(events)
        ):
            raise RuntimeError(
                (
                    "Attack-stage count does not "
                    "match Event count."
                )
            )

        scenario_instance_id = (
            generate_scenario_instance_id(
                scenario_type
            )
        )

        simulation_run = (
            create_simulation_run(
                db=db,
                mode="live",
                seed=seed,
                worker_id=(
                    "one-shot-scenario"
                ),
                worker_version="1.0",
                configuration={
                    "generator":
                        "one-shot-live-scenario",

                    "scenario_type":
                        scenario_type,

                    "requested_employee":
                        requested_user_id,

                    "seed":
                        seed,
                },
                runtime_metadata={
                    "scenario_instance_id":
                        scenario_instance_id,

                    "scenario_type":
                        scenario_type,

                    "employee_user_id":
                        employee.user_id,

                    "one_shot":
                        True,
                },
            )
        )

        mark_simulation_run_running(
            db=db,
            run_id=(
                simulation_run.run_id
            ),
            employees_loaded=1,
        )

        for (
            sequence_number,
            event,
        ) in enumerate(
            events,
            start=1,
        ):
            # Event is the observable operational record.
            db.add(
                event
            )

            db.flush()

            # Ground truth remains private and separate.
            record_simulation_ground_truth(
                db=db,
                simulation_run=(
                    simulation_run
                ),
                event=event,
                scenario_instance_id=(
                    scenario_instance_id
                ),
                scenario_type=(
                    scenario_type
                ),
                is_injected=True,
                attack_stage=(
                    stages[
                        sequence_number - 1
                    ]
                ),
                sequence_number=(
                    sequence_number
                ),
                metadata={
                    "live_simulation":
                        True,

                    "one_shot":
                        True,

                    "victim_department":
                        employee.department,

                    "victim_job_role":
                        employee.job_role,

                    "generator":
                        "run_live_scenario_once",
                },
            )

        record_simulation_progress(
            db=db,
            run_id=(
                simulation_run.run_id
            ),
            events_generated=len(
                events
            ),
        )

        mark_simulation_run_stopping(
            db=db,
            run_id=(
                simulation_run.run_id
            ),
        )

        mark_simulation_run_stopped(
            db=db,
            run_id=(
                simulation_run.run_id
            ),
        )

        db.commit()

        print()
        print(
            "SENTINEL one-shot scenario generated."
        )

        print(
            "=" * 72
        )

        print(
            f"Scenario           : "
            f"{scenario_type}"
        )

        print(
            f"Scenario instance  : "
            f"{scenario_instance_id}"
        )

        print(
            f"Simulation run     : "
            f"{simulation_run.run_id}"
        )

        print(
            f"Employee           : "
            f"{employee.user_id}"
        )

        print(
            f"Department         : "
            f"{employee.department}"
        )

        print(
            f"Job role           : "
            f"{employee.job_role}"
        )

        print(
            f"Events generated   : "
            f"{len(events)}"
        )

        print(
            f"Start time         : "
            f"{start_time.isoformat()}"
        )

        print(
            "=" * 72
        )

        print()
        print(
            "Only simulator Events and private "
            "ground truth were written."
        )

        print(
            "SENTINEL detection must occur "
            "independently through the processor."
        )

    except Exception as exc:
        db.rollback()

        if simulation_run is not None:
            try:
                mark_simulation_run_failed(
                    db=db,
                    run_id=(
                        simulation_run.run_id
                    ),
                    error_message=str(
                        exc
                    ),
                )

                db.commit()

            except Exception:
                db.rollback()

        raise

    finally:
        db.close()


def main() -> None:
    args = parse_args()

    run_scenario(
        scenario_type=(
            args.scenario_type
        ),
        requested_user_id=(
            args.employee_user_id
        ),
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
