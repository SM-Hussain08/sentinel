"""
Build SENTINEL's canonical evaluation registry from generated
evaluation component artifacts.
"""

from pathlib import Path
import sys


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)


if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(
        0,
        str(PROJECT_ROOT),
    )


from ml_engine.evaluation.registry import (  # noqa: E402
    EVALUATION_REGISTRY_PATH,
    build_evaluation_registry,
)


def main() -> None:
    registry = (
        build_evaluation_registry()
    )

    print()
    print(
        "SENTINEL EVALUATION REGISTRY"
    )

    print("=" * 68)

    print(
        "Registry version        : "
        f"{registry['registry_version']}"
    )

    print(
        "Selected model          : "
        f"{registry['selected_model']['detector_name']} "
        f"v{registry['selected_model']['version']}"
    )

    print(
        "Experiments             : "
        f"{len(registry['experiments'])}"
    )

    print(
        "Incident recall         : "
        f"{registry['incident_evaluation']['recall']:.3f}"
    )

    print(
        "Timeline recovery       : "
        f"{registry['incident_evaluation']['timeline_recovery_rate']:.3%}"
    )

    print(
        "Registry path           : "
        f"{EVALUATION_REGISTRY_PATH}"
    )

    print("=" * 68)


if __name__ == "__main__":
    main()