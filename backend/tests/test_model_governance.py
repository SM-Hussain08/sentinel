from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from app.model_governance import (
    ModelGovernanceError,
    validate_model_governance,
)
from app.selected_detector import (
    SELECTED_MODEL_MANIFEST_PATH,
    SELECTED_MODEL_PATH,
)
from ml_engine.models import (
    SentinelIsolationForest,
)


def _baseline_manifest() -> dict:
    return json.loads(
        SELECTED_MODEL_MANIFEST_PATH.read_text(
            encoding="utf-8",
        )
    )


def _copy_selected_release(
    tmp_path: Path,
) -> tuple[Path, Path, dict]:
    artifact_path = (
        tmp_path
        / SELECTED_MODEL_PATH.name
    )

    manifest_path = (
        tmp_path
        / SELECTED_MODEL_MANIFEST_PATH.name
    )

    artifact_path.write_bytes(
        SELECTED_MODEL_PATH.read_bytes()
    )

    manifest = _baseline_manifest()

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
        ),
        encoding="utf-8",
    )

    return (
        artifact_path,
        manifest_path,
        manifest,
    )


def _write_manifest(
    path: Path,
    manifest: dict,
) -> None:
    path.write_text(
        json.dumps(
            manifest,
            indent=2,
        ),
        encoding="utf-8",
    )


def _sha256(
    path: Path,
) -> str:
    return hashlib.sha256(
        path.read_bytes()
    ).hexdigest()


def test_selected_release_passes_governance(
    tmp_path: Path,
) -> None:
    (
        artifact_path,
        manifest_path,
        _,
    ) = _copy_selected_release(
        tmp_path
    )

    report = validate_model_governance(
        artifact_path=artifact_path,
        manifest_path=manifest_path,
    )

    assert (
        report.model_name
        == "isolation-forest"
    )

    assert (
        report.model_version
        == "1.2"
    )

    assert (
        report.promotion_status
        == "production"
    )

    assert report.feature_count == 17


def test_missing_artifact_fails_closed(
    tmp_path: Path,
) -> None:
    manifest_path = (
        tmp_path
        / SELECTED_MODEL_MANIFEST_PATH.name
    )

    _write_manifest(
        manifest_path,
        _baseline_manifest(),
    )

    missing_artifact = (
        tmp_path
        / SELECTED_MODEL_PATH.name
    )

    with pytest.raises(
        ModelGovernanceError,
        match="artifact is missing",
    ):
        validate_model_governance(
            artifact_path=missing_artifact,
            manifest_path=manifest_path,
        )


def test_missing_manifest_fails_closed(
    tmp_path: Path,
) -> None:
    artifact_path = (
        tmp_path
        / SELECTED_MODEL_PATH.name
    )

    artifact_path.write_bytes(
        SELECTED_MODEL_PATH.read_bytes()
    )

    missing_manifest = (
        tmp_path
        / SELECTED_MODEL_MANIFEST_PATH.name
    )

    with pytest.raises(
        ModelGovernanceError,
        match="manifest is missing",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=missing_manifest,
        )


def test_malformed_manifest_fails_closed(
    tmp_path: Path,
) -> None:
    artifact_path = (
        tmp_path
        / SELECTED_MODEL_PATH.name
    )

    artifact_path.write_bytes(
        SELECTED_MODEL_PATH.read_bytes()
    )

    manifest_path = (
        tmp_path
        / SELECTED_MODEL_MANIFEST_PATH.name
    )

    manifest_path.write_text(
        "{not valid json",
        encoding="utf-8",
    )

    with pytest.raises(
        ModelGovernanceError,
        match="valid JSON",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )


def test_wrong_manifest_version_fails_closed(
    tmp_path: Path,
) -> None:
    (
        artifact_path,
        manifest_path,
        manifest,
    ) = _copy_selected_release(
        tmp_path
    )

    manifest["model_version"] = "9.9"

    _write_manifest(
        manifest_path,
        manifest,
    )

    with pytest.raises(
        ModelGovernanceError,
        match="Manifest model version mismatch",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )


def test_non_production_manifest_fails_closed(
    tmp_path: Path,
) -> None:
    (
        artifact_path,
        manifest_path,
        manifest,
    ) = _copy_selected_release(
        tmp_path
    )

    manifest[
        "promotion_status"
    ] = "candidate"

    _write_manifest(
        manifest_path,
        manifest,
    )

    with pytest.raises(
        ModelGovernanceError,
        match="promotion status mismatch",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )


def test_tampered_artifact_checksum_fails_closed(
    tmp_path: Path,
) -> None:
    (
        artifact_path,
        manifest_path,
        _,
    ) = _copy_selected_release(
        tmp_path
    )

    with artifact_path.open(
        "ab",
    ) as handle:
        handle.write(
            b"tampered"
        )

    with pytest.raises(
        ModelGovernanceError,
        match="SHA-256",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )


def test_reordered_feature_schema_fails_closed(
    tmp_path: Path,
) -> None:
    (
        artifact_path,
        manifest_path,
        manifest,
    ) = _copy_selected_release(
        tmp_path
    )

    features = list(
        manifest["feature_columns"]
    )

    features[0], features[1] = (
        features[1],
        features[0],
    )

    manifest["feature_columns"] = (
        features
    )

    _write_manifest(
        manifest_path,
        manifest,
    )

    with pytest.raises(
        ModelGovernanceError,
        match="feature schema mismatch",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )


def test_changed_preprocessing_schema_fails_closed(
    tmp_path: Path,
) -> None:
    (
        artifact_path,
        manifest_path,
        manifest,
    ) = _copy_selected_release(
        tmp_path
    )

    manifest[
        "log_transform_columns"
    ] = manifest[
        "log_transform_columns"
    ][:-1]

    _write_manifest(
        manifest_path,
        manifest,
    )

    with pytest.raises(
        ModelGovernanceError,
        match="preprocessing schema mismatch",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )


def test_wrong_feature_count_fails_closed(
    tmp_path: Path,
) -> None:
    (
        artifact_path,
        manifest_path,
        manifest,
    ) = _copy_selected_release(
        tmp_path
    )

    manifest["feature_count"] = 18

    _write_manifest(
        manifest_path,
        manifest,
    )

    with pytest.raises(
        ModelGovernanceError,
        match="feature count mismatch",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )


def test_artifact_metadata_mismatch_fails_closed(
    tmp_path: Path,
) -> None:
    artifact_path = (
        tmp_path
        / SELECTED_MODEL_PATH.name
    )

    manifest_path = (
        tmp_path
        / SELECTED_MODEL_MANIFEST_PATH.name
    )

    detector = (
        SentinelIsolationForest.load(
            SELECTED_MODEL_PATH
        )
    )

    detector.model_version = "9.9"

    detector.save(
        artifact_path
    )

    manifest = _baseline_manifest()

    # Keep the manifest itself valid and update its checksum
    # so validation reaches the serialized-model metadata check.
    manifest["artifact_sha256"] = (
        _sha256(
            artifact_path
        )
    )

    _write_manifest(
        manifest_path,
        manifest,
    )

    with pytest.raises(
        ModelGovernanceError,
        match="Artifact model version mismatch",
    ):
        validate_model_governance(
            artifact_path=artifact_path,
            manifest_path=manifest_path,
        )
