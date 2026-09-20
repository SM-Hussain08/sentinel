"""
Read-only operational status API.

These endpoints expose runtime health for:

- the always-on SENTINEL event processor;
- the optional synthetic corporate simulator;
- the combined operations view used by the frontend.

The API is observational only.

It does not:
- start or stop workers;
- access Docker control;
- expose simulator ground truth;
- invoke local AI.
"""

from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
)

from sqlalchemy.orm import Session

from app.database.dependencies import (
    get_db,
)

from app.schemas import (
    OperationsStatus,
    ProcessorRuntimeStatus,
    SimulationRuntimeStatus,
)

from app.services.runtime_status import (
    build_operations_status,
    build_processor_status,
    build_simulation_status,
)


router = APIRouter(
    prefix="/operations",
    tags=[
        "Operations",
    ],
)


@router.get(
    "/processor",
    response_model=ProcessorRuntimeStatus,
)
def get_processor_runtime_status(
    db: Session = Depends(
        get_db
    ),
) -> ProcessorRuntimeStatus:
    """
    Return current SENTINEL event-processor health.

    This answers:

        Is SENTINEL operational?

    Health is derived from persistent processor lifecycle
    state and heartbeat freshness, not Docker container state.
    """

    return build_processor_status(
        db=db
    )


@router.get(
    "/simulation",
    response_model=SimulationRuntimeStatus,
)
def get_simulation_runtime_status(
    db: Session = Depends(
        get_db
    ),
) -> SimulationRuntimeStatus:
    """
    Return current or latest simulator runtime status.

    This answers:

        Is the synthetic corporate environment running?

    If no simulation is currently active, the most recent
    run is returned so the frontend can still show last-run
    information.
    """

    return build_simulation_status(
        db=db
    )


@router.get(
    "/status",
    response_model=OperationsStatus,
)
def get_operations_status(
    db: Session = Depends(
        get_db
    ),
) -> OperationsStatus:
    """
    Return the combined read-only operations view.

    SENTINEL processor state and simulation state remain
    intentionally independent.
    """

    return build_operations_status(
        db=db
    )
