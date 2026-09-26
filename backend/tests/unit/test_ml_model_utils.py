"""
Unit tests for SENTINEL model preprocessing and Isolation Forest wrapper.

These tests protect the versioned preprocessing contract used by persisted
model artifacts.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ml_engine.models.isolation_forest import (
    SentinelIsolationForest,
)
from ml_engine.preprocessing.transforms import (
    parse_event_timestamps,
    prepare_model_matrix,
)


# ============================================================
# Preprocessing
# ============================================================


@pytest.mark.unit
@pytest.mark.ml
def test_prepare_model_matrix_preserves_requested_feature_order() -> None:
    dataframe = pd.DataFrame(
        {
            "feature_b": [2, 4],
            "feature_a": [1, 3],
            "unused": [99, 99],
        }
    )

    matrix = prepare_model_matrix(
        dataframe,
        feature_columns=[
            "feature_a",
            "feature_b",
        ],
        log_transform_columns=[],
    )

    assert list(
        matrix.columns
    ) == [
        "feature_a",
        "feature_b",
    ]

    assert matrix.shape == (
        2,
        2,
    )

    assert all(
        dtype.kind == "f"
        for dtype
        in matrix.dtypes
    )


@pytest.mark.unit
@pytest.mark.ml
def test_prepare_model_matrix_rejects_missing_features() -> None:
    dataframe = pd.DataFrame(
        {
            "feature_a": [1.0],
        }
    )

    with pytest.raises(
        ValueError,
        match=(
            "Missing model features: "
            "feature_b"
        ),
    ):
        prepare_model_matrix(
            dataframe,
            feature_columns=[
                "feature_a",
                "feature_b",
            ],
            log_transform_columns=[],
        )


@pytest.mark.unit
@pytest.mark.ml
def test_prepare_model_matrix_applies_log_transform_after_clipping_negative_values() -> None:
    dataframe = pd.DataFrame(
        {
            "bytes_sent": [
                -100.0,
                0.0,
                9.0,
            ],
            "feature": [
                1.0,
                2.0,
                3.0,
            ],
        }
    )

    matrix = prepare_model_matrix(
        dataframe,
        feature_columns=[
            "bytes_sent",
            "feature",
        ],
        log_transform_columns=[
            "bytes_sent",
        ],
    )

    expected = np.log1p(
        np.array(
            [
                0.0,
                0.0,
                9.0,
            ]
        )
    )

    assert np.allclose(
        matrix["bytes_sent"].to_numpy(),
        expected,
    )

    assert np.allclose(
        matrix["feature"].to_numpy(),
        np.array(
            [
                1.0,
                2.0,
                3.0,
            ]
        ),
    )


@pytest.mark.unit
@pytest.mark.ml
def test_prepare_model_matrix_ignores_log_columns_not_in_selected_schema() -> None:
    dataframe = pd.DataFrame(
        {
            "feature_a": [
                1.0,
                2.0,
            ],
        }
    )

    matrix = prepare_model_matrix(
        dataframe,
        feature_columns=[
            "feature_a",
        ],
        log_transform_columns=[
            "not_selected",
        ],
    )

    assert np.allclose(
        matrix["feature_a"].to_numpy(),
        np.array(
            [
                1.0,
                2.0,
            ]
        ),
    )


@pytest.mark.unit
@pytest.mark.ml
def test_prepare_model_matrix_rejects_null_values() -> None:
    dataframe = pd.DataFrame(
        {
            "feature_a": [
                1.0,
                np.nan,
            ],
        }
    )

    with pytest.raises(
        ValueError,
        match=(
            "Model matrix contains "
            "null values"
        ),
    ):
        prepare_model_matrix(
            dataframe,
            feature_columns=[
                "feature_a",
            ],
            log_transform_columns=[],
        )


@pytest.mark.unit
@pytest.mark.ml
def test_parse_event_timestamps_handles_mixed_formats_as_utc() -> None:
    dataframe = pd.DataFrame(
        {
            "event_timestamp": [
                "2026-08-24T10:00:00Z",
                "2026-08-24 11:30:00+00:00",
                "2026-08-24T12:45:00.123456+00:00",
            ]
        }
    )

    parsed = parse_event_timestamps(
        dataframe
    )

    timestamp_dtype = parsed[
        "event_timestamp"
    ].dtype

    assert (
        str(
            timestamp_dtype.tz
        )
        == "UTC"
    )

    assert (
        timestamp_dtype.kind
        == "M"
    )

    assert (
        parsed[
            "event_timestamp"
        ].iloc[0].hour
        == 10
    )

    # Original DataFrame remains untouched.
    assert isinstance(
        dataframe[
            "event_timestamp"
        ].iloc[0],
        str,
    )


# ============================================================
# Isolation Forest wrapper
# ============================================================


def _training_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "feature_a": [
                0.0,
                0.1,
                0.2,
                0.3,
                0.4,
                5.0,
                6.0,
                7.0,
            ],
            "feature_b": [
                1.0,
                1.1,
                0.9,
                1.2,
                1.0,
                8.0,
                9.0,
                10.0,
            ],
        }
    )


def _detector(
    *,
    threshold_percentile: float = 0.75,
) -> SentinelIsolationForest:
    return SentinelIsolationForest(
        model_version="pytest-1.0",
        feature_columns=[
            "feature_a",
            "feature_b",
        ],
        log_transform_columns=[],
        n_estimators=20,
        threshold_percentile=(
            threshold_percentile
        ),
        random_state=42,
    )


@pytest.mark.unit
@pytest.mark.ml
def test_normalized_scores_require_fitted_detector() -> None:
    detector = _detector()

    with pytest.raises(
        RuntimeError,
        match=(
            "Detector must be fitted "
            "before scoring"
        ),
    ):
        detector.normalized_scores(
            _training_dataframe()
        )


@pytest.mark.unit
@pytest.mark.ml
def test_fit_records_training_distribution_and_sample_count() -> None:
    dataframe = _training_dataframe()

    detector = _detector()

    detector.fit(
        dataframe
    )

    assert (
        detector.training_sample_count
        == len(
            dataframe
        )
    )

    assert (
        detector.training_scores_sorted
        is not None
    )

    assert len(
        detector.training_scores_sorted
    ) == len(
        dataframe
    )

    assert np.all(
        np.diff(
            detector.training_scores_sorted
        )
        >= 0
    )


@pytest.mark.unit
@pytest.mark.ml
def test_normalized_scores_are_historical_percentiles_between_zero_and_one() -> None:
    dataframe = _training_dataframe()

    detector = _detector()

    detector.fit(
        dataframe
    )

    scores = detector.normalized_scores(
        dataframe
    )

    assert scores.shape == (
        len(
            dataframe
        ),
    )

    assert np.all(
        scores >= 0.0
    )

    assert np.all(
        scores <= 1.0
    )


@pytest.mark.unit
@pytest.mark.ml
def test_predict_applies_configured_percentile_threshold() -> None:
    dataframe = _training_dataframe()

    detector = _detector(
        threshold_percentile=0.75
    )

    detector.fit(
        dataframe
    )

    scores = detector.normalized_scores(
        dataframe
    )

    predictions = detector.predict(
        dataframe
    )

    expected = (
        scores
        >= 0.75
    ).astype(
        int
    )

    assert np.array_equal(
        predictions,
        expected,
    )

    assert set(
        predictions.tolist()
    ).issubset(
        {
            0,
            1,
        }
    )


@pytest.mark.unit
@pytest.mark.ml
def test_raw_anomaly_scores_return_one_score_per_row() -> None:
    dataframe = _training_dataframe()

    detector = _detector()

    detector.fit(
        dataframe
    )

    scores = detector.raw_anomaly_scores(
        dataframe
    )

    assert isinstance(
        scores,
        np.ndarray,
    )

    assert scores.shape == (
        len(
            dataframe
        ),
    )


@pytest.mark.unit
@pytest.mark.ml
def test_detector_save_load_round_trip_preserves_model_contract(
    tmp_path: Path,
) -> None:
    dataframe = _training_dataframe()

    detector = _detector(
        threshold_percentile=0.80
    )

    detector.fit(
        dataframe
    )

    path = (
        tmp_path
        / "pytest_iforest.joblib"
    )

    detector.save(
        path
    )

    assert path.is_file()

    loaded = (
        SentinelIsolationForest.load(
            path
        )
    )

    assert (
        loaded.model_name
        == "isolation-forest"
    )

    assert (
        loaded.model_version
        == "pytest-1.0"
    )

    assert loaded.feature_columns == [
        "feature_a",
        "feature_b",
    ]

    assert (
        loaded.log_transform_columns
        == []
    )

    assert (
        loaded.threshold_percentile
        == pytest.approx(
            0.80
        )
    )

    assert (
        loaded.training_sample_count
        == len(
            dataframe
        )
    )

    original_scores = (
        detector.normalized_scores(
            dataframe
        )
    )

    loaded_scores = (
        loaded.normalized_scores(
            dataframe
        )
    )

    assert np.allclose(
        original_scores,
        loaded_scores,
    )
