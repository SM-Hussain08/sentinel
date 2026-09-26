"""
Verify SENTINEL's promoted production-model governance contract.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys


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


from app.model_governance import (  # noqa: E402
    ModelGovernanceError,
    validate_model_governance,
)


def main() -> int:
    print()
    print(
        "=" * 68
    )
    print(
        "SENTINEL Production Model Governance"
    )
    print(
        "=" * 68
    )

    try:
        report = (
            validate_model_governance()
        )

    except ModelGovernanceError as exc:
        print()
        print(
            "STATUS: FAIL"
        )
        print(
            f"Reason: {exc}"
        )
        print()
        return 1

    print()
    print(
        "STATUS: PASS"
    )

    print()
    print(
        json.dumps(
            report.as_dict(),
            indent=2,
        )
    )

    print()
    print(
        "Governance checks:"
    )
    print(
        "  ✓ selected detector identity"
    )
    print(
        "  ✓ production promotion status"
    )
    print(
        "  ✓ artifact filename"
    )
    print(
        "  ✓ artifact SHA-256 integrity"
    )
    print(
        "  ✓ canonical feature order"
    )
    print(
        "  ✓ preprocessing schema"
    )
    print(
        "  ✓ training configuration"
    )
    print(
        "  ✓ serialized detector identity"
    )
    print(
        "  ✓ fitted training state"
    )
    print(
        "  ✓ sklearn estimator contract"
    )

    print()
    print(
        "=" * 68
    )
    print(
        "SENTINEL MODEL GOVERNANCE: PASS"
    )
    print(
        "=" * 68
    )
    print()

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
