"""
Production selected-detector invariants.

These tests verify SENTINEL's declared production detector contract
without performing database operations.
"""

from __future__ import annotations

import hashlib
import json

import pytest

from app.selected_detector import (
    SELECTED_DETECTOR,
    SELECTED_MODEL_MANIFEST_PATH,
    SELECTED_MODEL_PATH,
)
from ml_engine.models import SentinelIsolationForest


@pytest.mark.unit
@pytest.mark.ml
def test_selected_detector_identity() -> None:
    """
    SENTINEL must continue to point at the promoted detector generation.
    """

    assert SELECTED_DETECTOR.name == "isolation-forest"
    assert SELECTED_DETECTOR.version == "1.2"


@pytest.mark.unit
@pytest.mark.ml
def test_selected_model_artifact_exists() -> None:
    """
    A clean checkout must contain both production model files.
    """

    assert SELECTED_MODEL_PATH.is_file()
    assert SELECTED_MODEL_MANIFEST_PATH.is_file()


@pytest.mark.unit
@pytest.mark.ml
def test_selected_model_manifest_matches_artifact() -> None:
    """
    The promoted artifact must match its checked-in governance manifest.
    """

    manifest = json.loads(
        SELECTED_MODEL_MANIFEST_PATH.read_text(
            encoding="utf-8"
        )
    )

    actual_sha256 = hashlib.sha256(
        SELECTED_MODEL_PATH.read_bytes()
    ).hexdigest()

    assert manifest["promotion_status"] == "production"

    assert manifest["model_name"] == SELECTED_DETECTOR.name
    assert manifest["model_version"] == SELECTED_DETECTOR.version

    assert manifest["feature_count"] == 17

    assert (
        manifest["artifact_filename"]
        == SELECTED_MODEL_PATH.name
    )

    assert (
        manifest["artifact_sha256"]
        == actual_sha256
    )


@pytest.mark.unit
@pytest.mark.ml
def test_selected_model_can_be_deserialized() -> None:
    """
    The promoted model must actually be loadable by the runtime class.
    """

    detector = SentinelIsolationForest.load(
        SELECTED_MODEL_PATH
    )

    assert detector.model_name == SELECTED_DETECTOR.name
    assert detector.model_version == SELECTED_DETECTOR.version


# ============================================================
# Additional manifest / artifact failure invariants
# ============================================================

from pathlib import Path

import joblib

import app.selected_detector as selected_detector_module

from app.selected_detector import (
    load_selected_model_manifest,
)


@pytest.mark.unit
@pytest.mark.ml
def test_selected_model_manifest_missing_is_rejected(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    missing_manifest = (
        tmp_path
        / "missing_manifest.json"
    )

    monkeypatch.setattr(
        selected_detector_module,
        "SELECTED_MODEL_MANIFEST_PATH",
        missing_manifest,
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "Selected model manifest "
            "was not found"
        ),
    ):
        load_selected_model_manifest()


@pytest.mark.unit
@pytest.mark.ml
def test_selected_model_manifest_malformed_json_is_rejected(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manifest_path = (
        tmp_path
        / "manifest.json"
    )

    manifest_path.write_text(
        "{not-valid-json",
        encoding="utf-8",
    )

    monkeypatch.setattr(
        selected_detector_module,
        "SELECTED_MODEL_MANIFEST_PATH",
        manifest_path,
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "Selected model manifest "
            "could not be read"
        ),
    ):
        load_selected_model_manifest()


@pytest.mark.unit
@pytest.mark.ml
@pytest.mark.parametrize(
    (
        "model_name",
        "model_version",
    ),
    [
        (
            "different-detector",
            "1.2",
        ),
        (
            "isolation-forest",
            "9.9",
        ),
    ],
)
def test_selected_model_manifest_identity_mismatch_is_rejected(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    model_name: str,
    model_version: str,
) -> None:
    manifest_path = (
        tmp_path
        / "manifest.json"
    )

    manifest_path.write_text(
        json.dumps(
            {
                "model_name":
                    model_name,

                "model_version":
                    model_version,
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        selected_detector_module,
        "SELECTED_MODEL_MANIFEST_PATH",
        manifest_path,
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "Selected model manifest identity "
            "does not match"
        ),
    ):
        load_selected_model_manifest()


@pytest.mark.unit
@pytest.mark.ml
def test_isolation_forest_load_rejects_wrong_artifact_type(
    tmp_path: Path,
) -> None:
    artifact_path = (
        tmp_path
        / "not_a_detector.joblib"
    )

    joblib.dump(
        {
            "unexpected":
                "artifact"
        },
        artifact_path,
    )

    with pytest.raises(
        TypeError,
        match=(
            "Artifact is not a "
            "SentinelIsolationForest"
        ),
    ):
        SentinelIsolationForest.load(
            artifact_path
        )


@pytest.mark.unit
@pytest.mark.ml
@pytest.mark.parametrize(
    (
        "version",
        "expected",
    ),
    [
        (
            "1.2",
            "1_2",
        ),
        (
            "2.0.1",
            "2_0_1",
        ),
        (
            "10",
            "10",
        ),
    ],
)
def test_version_tag_is_stable_for_artifact_naming(
    version: str,
    expected: str,
) -> None:
    assert (
        selected_detector_module
        ._version_tag(
            version
        )
        == expected
    )
