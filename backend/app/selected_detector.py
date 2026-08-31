"""
Canonical selected-detector configuration for SENTINEL.

This module is the single source of truth for the detector that is
currently promoted for operational scoring, APIs, correlation, and
incident investigation.

If a future model is promoted, update the detector identity/version
here and retrain the selected model. Consumer modules should not
hard-code model names or versions independently.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json


# ============================================================
# Project paths
# ============================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

ARTIFACT_DIRECTORY = (
    PROJECT_ROOT
    / "ml_engine"
    / "models"
    / "artifacts"
)


# ============================================================
# Canonical selected detector
# ============================================================

SELECTED_DETECTOR_NAME = (
    "isolation-forest"
)

SELECTED_DETECTOR_VERSION = (
    "1.1"
)

SELECTED_DETECTOR_TYPE = (
    "unsupervised-ml"
)


def _version_tag(
    version: str,
) -> str:
    """
    Convert versions such as '1.1' into artifact-safe tags
    such as '1_1'.
    """

    return version.replace(
        ".",
        "_",
    )


_VERSION_TAG = _version_tag(
    SELECTED_DETECTOR_VERSION
)


SELECTED_MODEL_PATH = (
    ARTIFACT_DIRECTORY
    / (
        "sentinel_iforest_v"
        f"{_VERSION_TAG}.joblib"
    )
)


SELECTED_MODEL_MANIFEST_PATH = (
    ARTIFACT_DIRECTORY
    / (
        "sentinel_iforest_v"
        f"{_VERSION_TAG}_manifest.json"
    )
)


@dataclass(
    frozen=True,
)
class SelectedDetectorConfig:
    name: str
    version: str
    detector_type: str

    model_path: Path
    manifest_path: Path


SELECTED_DETECTOR = (
    SelectedDetectorConfig(
        name=(
            SELECTED_DETECTOR_NAME
        ),
        version=(
            SELECTED_DETECTOR_VERSION
        ),
        detector_type=(
            SELECTED_DETECTOR_TYPE
        ),
        model_path=(
            SELECTED_MODEL_PATH
        ),
        manifest_path=(
            SELECTED_MODEL_MANIFEST_PATH
        ),
    )
)


# ============================================================
# Manifest helpers
# ============================================================

def load_selected_model_manifest(
) -> dict[str, Any]:
    """
    Load and validate the selected model manifest.
    """

    if (
        not SELECTED_MODEL_MANIFEST_PATH.exists()
    ):
        raise RuntimeError(
            "Selected model manifest was not found. "
            "Run scripts/train_selected_model.py first."
        )

    try:
        data = json.loads(
            SELECTED_MODEL_MANIFEST_PATH.read_text(
                encoding="utf-8",
            )
        )

    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        raise RuntimeError(
            "Selected model manifest could not be read."
        ) from exc

    manifest_name = (
        data.get(
            "model_name"
        )
    )

    manifest_version = (
        data.get(
            "model_version"
        )
    )

    if (
        manifest_name
        != SELECTED_DETECTOR_NAME
        or manifest_version
        != SELECTED_DETECTOR_VERSION
    ):
        raise RuntimeError(
            "Selected model manifest identity does not "
            "match SENTINEL's selected detector configuration. "
            f"Expected "
            f"{SELECTED_DETECTOR_NAME} "
            f"v{SELECTED_DETECTOR_VERSION}; "
            f"found "
            f"{manifest_name} "
            f"v{manifest_version}."
        )

    return data