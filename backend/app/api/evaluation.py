import json
from pathlib import Path

from fastapi import (
    APIRouter,
    HTTPException,
)

from app.schemas.evaluation import (
    EvaluationSummary,
)


router = APIRouter(
    prefix="/evaluation",
    tags=[
        "Evaluation Intelligence",
    ],
)


# ============================================================
# Evaluation artifact paths
# ============================================================

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


BENCHMARK_REPORT_PATH = (
    PROJECT_ROOT
    / "ml_engine"
    / "evaluation"
    / "results"
    / "benchmark_report.json"
)


# ============================================================
# Helpers
# ============================================================

def load_json_artifact(
    path: Path,
    label: str,
) -> dict:
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                f"SENTINEL {label} "
                "is unavailable."
            ),
        )

    try:
        return json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )

    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"SENTINEL {label} "
                "could not be loaded."
            ),
        ) from exc


# ============================================================
# Evaluation API
# ============================================================

@router.get(
    "/summary",
    response_model=EvaluationSummary,
)
def get_evaluation_summary(
) -> EvaluationSummary:
    """
    Return SENTINEL's complete controlled evaluation
    and benchmark intelligence.

    The endpoint combines:

    - canonical evaluation registry
    - selected-model evaluation
    - experiment comparison
    - incident-level evaluation
    - evaluation provenance
    - reproducible benchmark metadata

    These values are reporting/evaluation metadata only.

    They are never consumed by the operational ML,
    anomaly-scoring or incident-correlation engines.
    """

    registry = load_json_artifact(
        REGISTRY_PATH,
        "evaluation registry",
    )

    benchmark_report = (
        load_json_artifact(
            BENCHMARK_REPORT_PATH,
            "benchmark report",
        )
    )

    benchmark_metadata = (
        benchmark_report.get(
            "benchmark",
            {},
        )
    )

    benchmark = {
        "name":
            benchmark_metadata.get(
                "name"
            ),

        "status":
            benchmark_metadata.get(
                "status"
            ),

        "seed":
            benchmark_metadata.get(
                "seed"
            ),

        "reproducible":
            benchmark_metadata.get(
                "reproducible"
            ),

        "database_isolation":
            benchmark_metadata.get(
                "database_isolation"
            ),

        "generated_at":
            benchmark_metadata.get(
                "generated_at"
            ),

        "elapsed_seconds":
            benchmark_metadata.get(
                "elapsed_seconds"
            ),

        "dataset":
            benchmark_report.get(
                "dataset",
                {},
            ),

        "operational_scoring":
            benchmark_report.get(
                "operational_scoring",
                {},
            ),

        "incident_correlation":
            benchmark_report.get(
                "incident_correlation",
                {},
            ),

        "canonical_signature":
            benchmark_report.get(
                "canonical_signature",
                {},
            ),
    }

    return EvaluationSummary(
        **registry,
        benchmark=benchmark,
    )