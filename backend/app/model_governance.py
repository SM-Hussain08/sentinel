"""
Canonical governance validation for SENTINEL's promoted anomaly detector.

This module defines the reusable production-model contract shared by:

- explicit governance verification
- automated tests
- runtime model loading
- Docker build preflight
- CI release gates

The validator deliberately verifies the artifact checksum before
deserializing the joblib artifact.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
from typing import Any

from sklearn.ensemble import IsolationForest

from app.selected_detector import (
    SELECTED_DETECTOR,
    SELECTED_MODEL_MANIFEST_PATH,
    SELECTED_MODEL_PATH,
)
from ml_engine.features import V1_FEATURE_COLUMNS
from ml_engine.models import SentinelIsolationForest
from ml_engine.preprocessing import (
    V1_LOG_TRANSFORM_COLUMNS,
)


EXPECTED_ALGORITHM = "IsolationForest"
EXPECTED_PROMOTION_STATUS = "production"
EXPECTED_EXPERIMENT = "V1"
EXPECTED_FEATURE_SCHEMA_VERSION = "1.0"

_SHA256_PATTERN = re.compile(
    r"^[0-9a-f]{64}$"
)


class ModelGovernanceError(RuntimeError):
    """
    Raised when the promoted production-model contract is invalid.
    """


@dataclass(
    frozen=True,
)
class ModelGovernanceReport:
    model_name: str
    model_version: str
    promotion_status: str
    algorithm: str

    feature_schema_version: str
    feature_count: int

    artifact_path: Path
    manifest_path: Path
    artifact_sha256: str

    training_rows: int
    n_estimators: int
    threshold_percentile: float
    random_state: int

    def as_dict(
        self,
    ) -> dict[str, Any]:
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "promotion_status": self.promotion_status,
            "algorithm": self.algorithm,
            "feature_schema_version": (
                self.feature_schema_version
            ),
            "feature_count": self.feature_count,
            "artifact_path": str(
                self.artifact_path
            ),
            "manifest_path": str(
                self.manifest_path
            ),
            "artifact_sha256": (
                self.artifact_sha256
            ),
            "training_rows": (
                self.training_rows
            ),
            "n_estimators": (
                self.n_estimators
            ),
            "threshold_percentile": (
                self.threshold_percentile
            ),
            "random_state": (
                self.random_state
            ),
        }


def _fail(
    message: str,
) -> None:
    raise ModelGovernanceError(
        message
    )


def _load_manifest(
    manifest_path: Path,
) -> dict[str, Any]:
    if not manifest_path.exists():
        _fail(
            "Selected model manifest is missing: "
            f"{manifest_path}"
        )

    if not manifest_path.is_file():
        _fail(
            "Selected model manifest path is not a file: "
            f"{manifest_path}"
        )

    try:
        manifest = json.loads(
            manifest_path.read_text(
                encoding="utf-8",
            )
        )

    except (
        OSError,
        json.JSONDecodeError,
    ) as exc:
        raise ModelGovernanceError(
            "Selected model manifest could not be read "
            "as valid JSON."
        ) from exc

    if not isinstance(
        manifest,
        dict,
    ):
        _fail(
            "Selected model manifest must contain "
            "a JSON object."
        )

    return manifest


def _required_value(
    manifest: dict[str, Any],
    key: str,
) -> Any:
    if key not in manifest:
        _fail(
            "Selected model manifest is missing "
            f"required field: {key}"
        )

    return manifest[key]


def _require_equal(
    *,
    label: str,
    actual: Any,
    expected: Any,
) -> None:
    if actual != expected:
        _fail(
            f"{label} mismatch: "
            f"expected {expected!r}, "
            f"found {actual!r}."
        )


def _require_integer(
    *,
    label: str,
    value: Any,
    minimum: int | None = None,
) -> int:
    if (
        isinstance(
            value,
            bool,
        )
        or not isinstance(
            value,
            int,
        )
    ):
        _fail(
            f"{label} must be an integer."
        )

    if (
        minimum is not None
        and value < minimum
    ):
        _fail(
            f"{label} must be at least "
            f"{minimum}."
        )

    return value


def _require_probability(
    *,
    label: str,
    value: Any,
) -> float:
    if (
        isinstance(
            value,
            bool,
        )
        or not isinstance(
            value,
            (
                int,
                float,
            ),
        )
    ):
        _fail(
            f"{label} must be numeric."
        )

    numeric = float(
        value
    )

    if not (
        0.0
        < numeric
        < 1.0
    ):
        _fail(
            f"{label} must be greater than 0 "
            "and less than 1."
        )

    return numeric


def calculate_sha256(
    artifact_path: Path,
) -> str:
    if not artifact_path.exists():
        _fail(
            "Selected model artifact is missing: "
            f"{artifact_path}"
        )

    if not artifact_path.is_file():
        _fail(
            "Selected model artifact path is not a file: "
            f"{artifact_path}"
        )

    digest = hashlib.sha256()

    try:
        with artifact_path.open(
            "rb",
        ) as handle:
            for chunk in iter(
                lambda: handle.read(
                    1024 * 1024
                ),
                b"",
            ):
                digest.update(
                    chunk
                )

    except OSError as exc:
        raise ModelGovernanceError(
            "Selected model artifact could not be read."
        ) from exc

    return digest.hexdigest()


def _validate_model_governance_with_detector(
    *,
    artifact_path: Path = SELECTED_MODEL_PATH,
    manifest_path: Path = (
        SELECTED_MODEL_MANIFEST_PATH
    ),
) -> tuple[
    ModelGovernanceReport,
    SentinelIsolationForest,
]:
    """
    Validate SENTINEL's complete promoted-model contract.

    The checksum is verified before joblib deserialization.
    """

    artifact_path = Path(
        artifact_path
    )

    manifest_path = Path(
        manifest_path
    )

    manifest = _load_manifest(
        manifest_path
    )

    model_name = _required_value(
        manifest,
        "model_name",
    )

    model_version = _required_value(
        manifest,
        "model_version",
    )

    algorithm = _required_value(
        manifest,
        "algorithm",
    )

    promotion_status = _required_value(
        manifest,
        "promotion_status",
    )

    experiment = _required_value(
        manifest,
        "experiment",
    )

    feature_schema_version = (
        _required_value(
            manifest,
            "feature_schema_version",
        )
    )

    feature_count = _require_integer(
        label="Manifest feature count",
        value=_required_value(
            manifest,
            "feature_count",
        ),
        minimum=1,
    )

    feature_columns = _required_value(
        manifest,
        "feature_columns",
    )

    log_transform_columns = (
        _required_value(
            manifest,
            "log_transform_columns",
        )
    )

    artifact_filename = _required_value(
        manifest,
        "artifact_filename",
    )

    manifest_sha256 = _required_value(
        manifest,
        "artifact_sha256",
    )

    training_rows = _require_integer(
        label="Manifest training rows",
        value=_required_value(
            manifest,
            "training_rows",
        ),
        minimum=1,
    )

    n_estimators = _require_integer(
        label="Manifest n_estimators",
        value=_required_value(
            manifest,
            "n_estimators",
        ),
        minimum=1,
    )

    threshold_percentile = (
        _require_probability(
            label=(
                "Manifest threshold_percentile"
            ),
            value=_required_value(
                manifest,
                "threshold_percentile",
            ),
        )
    )

    random_state = _require_integer(
        label="Manifest random_state",
        value=_required_value(
            manifest,
            "random_state",
        ),
    )

    _require_equal(
        label="Manifest model name",
        actual=model_name,
        expected=(
            SELECTED_DETECTOR.name
        ),
    )

    _require_equal(
        label="Manifest model version",
        actual=model_version,
        expected=(
            SELECTED_DETECTOR.version
        ),
    )

    _require_equal(
        label="Manifest algorithm",
        actual=algorithm,
        expected=EXPECTED_ALGORITHM,
    )

    _require_equal(
        label="Manifest promotion status",
        actual=promotion_status,
        expected=(
            EXPECTED_PROMOTION_STATUS
        ),
    )

    _require_equal(
        label="Manifest experiment",
        actual=experiment,
        expected=EXPECTED_EXPERIMENT,
    )

    _require_equal(
        label="Manifest feature schema version",
        actual=feature_schema_version,
        expected=(
            EXPECTED_FEATURE_SCHEMA_VERSION
        ),
    )

    canonical_features = list(
        V1_FEATURE_COLUMNS
    )

    canonical_log_columns = list(
        V1_LOG_TRANSFORM_COLUMNS
    )

    _require_equal(
        label="Manifest feature count",
        actual=feature_count,
        expected=len(
            canonical_features
        ),
    )

    _require_equal(
        label="Manifest feature schema",
        actual=feature_columns,
        expected=canonical_features,
    )

    _require_equal(
        label=(
            "Manifest preprocessing schema"
        ),
        actual=log_transform_columns,
        expected=canonical_log_columns,
    )

    _require_equal(
        label="Manifest artifact filename",
        actual=artifact_filename,
        expected=artifact_path.name,
    )

    if (
        not isinstance(
            manifest_sha256,
            str,
        )
        or _SHA256_PATTERN.fullmatch(
            manifest_sha256
        )
        is None
    ):
        _fail(
            "Manifest artifact_sha256 must be "
            "a lowercase 64-character SHA-256 "
            "hex digest."
        )

    actual_sha256 = calculate_sha256(
        artifact_path
    )

    _require_equal(
        label="Selected model SHA-256",
        actual=actual_sha256,
        expected=manifest_sha256,
    )

    # --------------------------------------------------------
    # Deserialize only after the byte-level integrity check.
    # --------------------------------------------------------

    try:
        detector = (
            SentinelIsolationForest.load(
                artifact_path
            )
        )

    except Exception as exc:
        raise ModelGovernanceError(
            "Selected model artifact could not be "
            "loaded as a SentinelIsolationForest."
        ) from exc

    _require_equal(
        label="Artifact model name",
        actual=detector.model_name,
        expected=(
            SELECTED_DETECTOR.name
        ),
    )

    _require_equal(
        label="Artifact model version",
        actual=detector.model_version,
        expected=(
            SELECTED_DETECTOR.version
        ),
    )

    _require_equal(
        label="Artifact feature schema",
        actual=list(
            detector.feature_columns
        ),
        expected=canonical_features,
    )

    _require_equal(
        label=(
            "Artifact preprocessing schema"
        ),
        actual=list(
            detector.log_transform_columns
        ),
        expected=canonical_log_columns,
    )

    _require_equal(
        label="Artifact n_estimators",
        actual=detector.n_estimators,
        expected=n_estimators,
    )

    _require_equal(
        label="Artifact threshold percentile",
        actual=(
            detector.threshold_percentile
        ),
        expected=threshold_percentile,
    )

    _require_equal(
        label="Artifact random state",
        actual=detector.random_state,
        expected=random_state,
    )

    _require_equal(
        label=(
            "Artifact training sample count"
        ),
        actual=(
            detector.training_sample_count
        ),
        expected=training_rows,
    )

    if (
        detector.training_scores_sorted
        is None
    ):
        _fail(
            "Selected model artifact has no fitted "
            "training-score distribution."
        )

    _require_equal(
        label=(
            "Artifact training-score count"
        ),
        actual=len(
            detector.training_scores_sorted
        ),
        expected=training_rows,
    )

    if not isinstance(
        detector.model,
        IsolationForest,
    ):
        _fail(
            "Selected model artifact does not contain "
            "a sklearn IsolationForest estimator."
        )

    _require_equal(
        label=(
            "Underlying estimator n_estimators"
        ),
        actual=detector.model.n_estimators,
        expected=n_estimators,
    )

    _require_equal(
        label=(
            "Underlying estimator random_state"
        ),
        actual=detector.model.random_state,
        expected=random_state,
    )

    report = ModelGovernanceReport(
        model_name=model_name,
        model_version=model_version,
        promotion_status=promotion_status,
        algorithm=algorithm,
        feature_schema_version=(
            feature_schema_version
        ),
        feature_count=feature_count,
        artifact_path=artifact_path,
        manifest_path=manifest_path,
        artifact_sha256=actual_sha256,
        training_rows=training_rows,
        n_estimators=n_estimators,
        threshold_percentile=(
            threshold_percentile
        ),
        random_state=random_state,
    )

    return (
        report,
        detector,
    )


def validate_model_governance(
    *,
    artifact_path: Path = SELECTED_MODEL_PATH,
    manifest_path: Path = (
        SELECTED_MODEL_MANIFEST_PATH
    ),
) -> ModelGovernanceReport:
    """
    Validate SENTINEL's complete promoted-model contract.
    """

    report, _ = (
        _validate_model_governance_with_detector(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )
    )

    return report


def load_governed_selected_model(
) -> SentinelIsolationForest:
    """
    Validate and return SENTINEL's promoted production detector.

    Runtime consumers use the exact artifact instance that passed
    the governance checks, avoiding a second deserialization step.
    """

    _, detector = (
        _validate_model_governance_with_detector()
    )

    return detector
