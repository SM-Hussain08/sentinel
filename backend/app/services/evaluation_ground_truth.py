"""
Private evaluation-ground-truth access for SENTINEL.

This module is the ONLY shared read abstraction for simulator truth used
by offline validation and benchmark evaluation.

Operational detection code must not depend on this module.

Ground truth is stored separately from Event so that observable security
events remain free of labels telling the detector which rows are attacks.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from app.models import (
    Event,
    SimulationGroundTruth,
)


# ============================================================
# Public evaluation label
# ============================================================

@dataclass(
    frozen=True,
)
class EvaluationGroundTruth:
    """
    Evaluation-only label associated with one Event.
    """

    event_uuid: UUID

    is_injected: bool

    scenario_type: str | None

    scenario_instance_id: str | None

    sequence_number: int | None

    metadata: dict[str, Any]


# ============================================================
# Session-local cache
# ============================================================

_TRUTH_CACHE_KEY = (
    "sentinel_private_ground_truth_map"
)


def clear_ground_truth_cache(
    db: Session,
) -> None:
    """
    Remove cached private truth from one SQLAlchemy session.

    Normally unnecessary because benchmark stages use fresh sessions,
    but useful after writing truth and reading it in the same session.
    """

    db.info.pop(
        _TRUTH_CACHE_KEY,
        None,
    )


def load_ground_truth_map(
    db: Session,
) -> dict[
    UUID,
    EvaluationGroundTruth,
]:
    """
    Load all private event truth once per SQLAlchemy session.

    Normal events intentionally have no SimulationGroundTruth row.
    Missing event UUIDs therefore evaluate as normal.
    """

    cached = db.info.get(
        _TRUTH_CACHE_KEY
    )

    if cached is not None:
        return cached

    rows = db.execute(
        select(
            SimulationGroundTruth.event_uuid,
            SimulationGroundTruth.is_injected,
            SimulationGroundTruth.scenario_type,
            SimulationGroundTruth.scenario_instance_id,
            SimulationGroundTruth.sequence_number,
            SimulationGroundTruth.ground_truth_metadata,
        )
    ).all()

    result: dict[
        UUID,
        EvaluationGroundTruth,
    ] = {}

    for (
        event_uuid,
        is_injected,
        scenario_type,
        scenario_instance_id,
        sequence_number,
        metadata,
    ) in rows:
        result[
            event_uuid
        ] = EvaluationGroundTruth(
            event_uuid=event_uuid,
            is_injected=bool(
                is_injected
            ),
            scenario_type=(
                scenario_type
            ),
            scenario_instance_id=(
                scenario_instance_id
            ),
            sequence_number=(
                sequence_number
            ),
            metadata=dict(
                metadata or {}
            ),
        )

    db.info[
        _TRUTH_CACHE_KEY
    ] = result

    return result


def get_event_ground_truth(
    *,
    db: Session,
    event_uuid: UUID,
) -> EvaluationGroundTruth | None:
    """
    Return private truth for an event.

    None means the event has no simulator attack label and is therefore
    treated as normal for controlled evaluation.
    """

    return (
        load_ground_truth_map(
            db
        )
        .get(
            event_uuid
        )
    )


def get_event_evaluation_label(
    *,
    db: Session,
    event_uuid: UUID,
) -> tuple[int, str | None]:
    """
    Return benchmark-compatible evaluation metadata.

    The returned names intentionally match the historical CSV contract:

        is_injected_anomaly
        scenario_type

    Those names remain useful evaluation labels even though they no longer
    originate from Event columns.
    """

    truth = (
        get_event_ground_truth(
            db=db,
            event_uuid=event_uuid,
        )
    )

    if (
        truth is None
        or not truth.is_injected
    ):
        return (
            0,
            None,
        )

    return (
        1,
        truth.scenario_type,
    )


# ============================================================
# Aggregate helpers
# ============================================================

def count_injected_events(
    db: Session,
) -> int:
    """
    Count events carrying private injected ground truth.
    """

    return int(
        db.scalar(
            select(
                func.count(
                    SimulationGroundTruth.id
                )
            )
            .where(
                SimulationGroundTruth
                .is_injected
                .is_(True)
            )
        )
        or 0
    )


def scenario_types(
    db: Session,
) -> set[str]:
    """
    Return private injected scenario types.
    """

    rows = db.scalars(
        select(
            SimulationGroundTruth
            .scenario_type
        )
        .where(
            SimulationGroundTruth
            .is_injected
            .is_(True),

            SimulationGroundTruth
            .scenario_type
            .is_not(None),
        )
        .distinct()
    ).all()

    return {
        value
        for value in rows
        if value
    }


def scenario_counts(
    db: Session,
) -> list[
    tuple[
        str,
        int,
    ]
]:
    """
    Return injected event counts grouped by private scenario type.
    """

    rows = db.execute(
        select(
            SimulationGroundTruth
            .scenario_type,

            func.count(
                SimulationGroundTruth.id
            ),
        )
        .where(
            SimulationGroundTruth
            .is_injected
            .is_(True)
        )
        .group_by(
            SimulationGroundTruth
            .scenario_type
        )
        .order_by(
            func.count(
                SimulationGroundTruth.id
            ).desc()
        )
    ).all()

    return [
        (
            str(
                scenario
            ),
            int(
                count
            ),
        )
        for (
            scenario,
            count,
        ) in rows
        if scenario
    ]


def count_invalid_ground_truth(
    db: Session,
) -> int:
    """
    Count logically invalid private truth records.

    Injected truth requires a scenario type by DB constraint. We also
    reject non-injected records that incorrectly carry an attack scenario.
    """

    return int(
        db.scalar(
            select(
                func.count(
                    SimulationGroundTruth.id
                )
            )
            .where(
                SimulationGroundTruth
                .is_injected
                .is_(False),

                SimulationGroundTruth
                .scenario_type
                .is_not(None),
            )
        )
        or 0
    )


# ============================================================
# Controlled benchmark batch helpers
# ============================================================

def controlled_attack_rows(
    *,
    db: Session,
    simulation_batch: str,
) -> list[
    tuple[
        Event,
        SimulationGroundTruth,
    ]
]:
    """
    Load observable Events joined to their private controlled truth.

    Used only by offline evaluation.
    """

    return list(
        db.execute(
            select(
                Event,
                SimulationGroundTruth,
            )
            .join(
                SimulationGroundTruth,
                SimulationGroundTruth.event_uuid
                == Event.id,
            )
            .where(
                SimulationGroundTruth
                .is_injected
                .is_(True),

                SimulationGroundTruth
                .benchmark_batch_id
                == simulation_batch,
            )
            .order_by(
                Event.timestamp,
                Event.created_at,
                Event.event_id,
            )
        ).all()
    )


def count_controlled_attack_events(
    *,
    db: Session,
    simulation_batch: str,
) -> int:
    """
    Count injected private truth rows for one controlled batch.
    """

    return int(
        db.scalar(
            select(
                func.count(
                    SimulationGroundTruth.id
                )
            )
            .where(
                SimulationGroundTruth
                .is_injected
                .is_(True),

                SimulationGroundTruth
                .benchmark_batch_id
                == simulation_batch,
            )
        )
        or 0
    )
