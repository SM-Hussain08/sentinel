import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.schemas.evaluation import (
    EvaluationSummary,
)


router = APIRouter(
    prefix="/evaluation",
    tags=[
        "Evaluation Intelligence",
    ],
)


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[3]
)

REGISTRY_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "evaluation"
    / "evaluation_registry.json"
)


@router.get(
    "/summary",
    response_model=EvaluationSummary,
)
def get_evaluation_summary() -> EvaluationSummary:
    """
    Return the version-controlled evaluation results used by
    SENTINEL's portfolio and model-intelligence views.

    These metrics are evaluation metadata only. They are never
    consumed by the operational ML or incident inference engines.
    """

    if not REGISTRY_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "SENTINEL evaluation registry "
                "is unavailable."
            ),
        )

    try:
        with REGISTRY_PATH.open(
            "r",
            encoding="utf-8",
        ) as registry_file:
            data = json.load(
                registry_file
            )

    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "SENTINEL evaluation registry "
                "could not be loaded."
            ),
        ) from exc

    return EvaluationSummary(
        **data
    )