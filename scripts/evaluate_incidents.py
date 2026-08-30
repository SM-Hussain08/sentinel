"""
Evaluate SENTINEL's incident-correlation layer against hidden
simulator ground truth.

IMPORTANT
---------
Ground-truth fields are used ONLY here for evaluation.

The correlation and investigation engines never access:
- is_injected_anomaly
- scenario_type
- simulation_batch
"""

from collections import defaultdict
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
    Event,
    Incident,
    IncidentEvent,
)

from ml_engine.evaluation import (  # noqa: E402
    calculate_incident_metrics,
)


EVALUATION_BATCH = (
    "phase3_attack_batch_01"
)


def evaluate_incidents() -> None:
    db = SessionLocal()

    try:
        # -------------------------------------------------
        # Load controlled ground-truth attack events
        # -------------------------------------------------

        attack_events = list(
            db.scalars(
                select(
                    Event
                )
                .where(
                    Event.is_injected_anomaly.is_(
                        True
                    ),

                    Event.event_metadata[
                        "simulation_batch"
                    ].astext
                    == EVALUATION_BATCH,
                )
                .order_by(
                    Event.timestamp
                )
            ).all()
        )

        if not attack_events:
            raise RuntimeError(
                "No controlled Phase 3 attack "
                "events were found."
            )

        # One controlled attack instance exists per scenario
        # in phase3_attack_batch_01.
        ground_truth_by_scenario: dict[
            str,
            set,
        ] = defaultdict(set)

        for event in attack_events:
            if event.scenario_type:
                ground_truth_by_scenario[
                    event.scenario_type
                ].add(
                    event.id
                )

        # -------------------------------------------------
        # Formal evaluation window
        # -------------------------------------------------

        evaluation_start = min(
            event.timestamp
            for event in attack_events
        )

        evaluation_end = max(
            event.timestamp
            for event in attack_events
        )

        # Give the incident window some surrounding normal
        # context so legitimate correlated incidents during
        # the attack period count as false positives.
        evaluation_incidents = list(
            db.scalars(
                select(
                    Incident
                )
                .where(
                    Incident.first_seen
                    <= evaluation_end,

                    Incident.last_seen
                    >= evaluation_start,
                )
                .order_by(
                    Incident.first_seen
                )
            ).all()
        )

        # -------------------------------------------------
        # Load incident → event relationships
        # -------------------------------------------------

        links = db.execute(
            select(
                IncidentEvent.incident_uuid,
                IncidentEvent.event_uuid,
            )
        ).all()

        incident_event_map: dict[
            object,
            set,
        ] = defaultdict(set)

        for (
            incident_uuid,
            event_uuid,
        ) in links:
            incident_event_map[
                incident_uuid
            ].add(
                event_uuid
            )

        # -------------------------------------------------
        # Compare incidents to hidden ground truth
        # -------------------------------------------------

        incident_matches: dict[
            str,
            list[
                dict
            ],
        ] = {}

        detected_scenarios: set[
            str
        ] = set()

        true_positive_incidents = 0
        false_positive_incidents = 0

        for incident in (
            evaluation_incidents
        ):
            incident_event_ids = (
                incident_event_map[
                    incident.id
                ]
            )

            matches = []

            for (
                scenario,
                scenario_event_ids,
            ) in (
                ground_truth_by_scenario
                .items()
            ):
                overlap = (
                    incident_event_ids
                    & scenario_event_ids
                )

                if not overlap:
                    continue

                coverage = (
                    len(overlap)
                    / len(
                        scenario_event_ids
                    )
                )

                incident_coverage = (
                    len(overlap)
                    / len(
                        incident_event_ids
                    )
                    if incident_event_ids
                    else 0.0
                )

                matches.append(
                    {
                        "scenario":
                            scenario,

                        "matched_events":
                            len(overlap),

                        "scenario_events":
                            len(
                                scenario_event_ids
                            ),

                        "scenario_coverage":
                            coverage,

                        "incident_purity":
                            incident_coverage,
                    }
                )

                detected_scenarios.add(
                    scenario
                )

            incident_matches[
                incident.incident_id
            ] = matches

            if matches:
                true_positive_incidents += 1
            else:
                false_positive_incidents += 1

        metrics = (
            calculate_incident_metrics(
                true_positive_incidents=(
                    true_positive_incidents
                ),

                false_positive_incidents=(
                    false_positive_incidents
                ),

                detected_attack_instances=len(
                    detected_scenarios
                ),

                total_attack_instances=len(
                    ground_truth_by_scenario
                ),
            )
        )

        # -------------------------------------------------
        # Console report
        # -------------------------------------------------

        print()
        print(
            "SENTINEL INCIDENT-LEVEL EVALUATION"
        )

        print("=" * 78)

        print()
        print(
            "Evaluation Scope"
        )

        print("-" * 78)

        print(
            f"Ground-truth batch      : "
            f"{EVALUATION_BATCH}"
        )

        print(
            f"Attack event rows       : "
            f"{len(attack_events)}"
        )

        print(
            f"Attack instances        : "
            f"{len(ground_truth_by_scenario)}"
        )

        print(
            f"Incidents evaluated     : "
            f"{len(evaluation_incidents)}"
        )

        print()
        print(
            "Incident Metrics"
        )

        print("-" * 78)

        print(
            f"True-positive incidents : "
            f"{metrics.true_positive_incidents}"
        )

        print(
            f"False-positive incidents: "
            f"{metrics.false_positive_incidents}"
        )

        print(
            f"Attack instances found  : "
            f"{metrics.detected_attack_instances}"
            f"/"
            f"{metrics.total_attack_instances}"
        )

        print()

        print(
            f"Incident Precision      : "
            f"{metrics.precision:.3f}"
        )

        print(
            f"Incident Recall         : "
            f"{metrics.recall:.3f}"
        )

        print(
            f"Incident F1             : "
            f"{metrics.f1_score:.3f}"
        )

        # -------------------------------------------------
        # Scenario recovery
        # -------------------------------------------------

        print()
        print(
            "Controlled Scenario Recovery"
        )

        print("-" * 78)

        for scenario in sorted(
            ground_truth_by_scenario
        ):
            matched_incidents = []

            for incident in (
                evaluation_incidents
            ):
                for match in (
                    incident_matches[
                        incident.incident_id
                    ]
                ):
                    if (
                        match[
                            "scenario"
                        ]
                        == scenario
                    ):
                        matched_incidents.append(
                            (
                                incident,
                                match,
                            )
                        )

            if not matched_incidents:
                print(
                    f"{scenario:<24}"
                    f"{'MISSED':>12}"
                )

                continue

            # Normally one incident should dominate one scenario.
            best_incident, best_match = max(
                matched_incidents,
                key=lambda pair:
                    pair[1][
                        "matched_events"
                    ],
            )

            print(
                f"{scenario:<24}"
                f"{best_incident.incident_id:<16}"
                f"{best_incident.incident_type:<32}"
                f"{best_match['matched_events']:>3}"
                f"/"
                f"{best_match['scenario_events']:<3}"
                f" "
                f"coverage="
                f"{best_match['scenario_coverage']:>6.1%}"
            )

        # -------------------------------------------------
        # Incident classification review
        # -------------------------------------------------

        print()
        print(
            "Incident Review"
        )

        print("-" * 78)

        for incident in (
            evaluation_incidents
        ):
            matches = (
                incident_matches[
                    incident.incident_id
                ]
            )

            if matches:
                match_text = ", ".join(
                    (
                        f"{match['scenario']} "
                        f"({match['scenario_coverage']:.0%})"
                    )
                    for match in matches
                )

                result = (
                    f"MATCH: {match_text}"
                )

            else:
                result = (
                    "NO CONTROLLED ATTACK OVERLAP"
                )

            print(
                f"{incident.incident_id:<16}"
                f"{incident.incident_type:<32}"
                f"{incident.severity:<10}"
                f"{result}"
            )

        # -------------------------------------------------
        # Event-level recovery through correlation
        # -------------------------------------------------

        total_attack_events = len(
            attack_events
        )

        covered_attack_event_ids = set()

        for incident in (
            evaluation_incidents
        ):
            incident_event_ids = (
                incident_event_map[
                    incident.id
                ]
            )

            for event in attack_events:
                if (
                    event.id
                    in incident_event_ids
                ):
                    covered_attack_event_ids.add(
                        event.id
                    )

        event_recovery_rate = (
            len(
                covered_attack_event_ids
            )
            / total_attack_events
            if total_attack_events
            else 0.0
        )

        print()
        print(
            "Correlation Recovery"
        )

        print("-" * 78)

        print(
            f"Attack events represented "
            f"in incidents : "
            f"{len(covered_attack_event_ids)}"
            f"/"
            f"{total_attack_events}"
        )

        print(
            f"Attack timeline recovery     : "
            f"{event_recovery_rate:.3%}"
        )

        print("=" * 78)

    finally:
        db.close()


if __name__ == "__main__":
    evaluate_incidents()