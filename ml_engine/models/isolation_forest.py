from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ml_engine.preprocessing import (
    prepare_model_matrix,
)


class SentinelIsolationForest:
    """
    Versioned SENTINEL Isolation Forest detector.

    Each saved model stores:
    - feature schema
    - preprocessing configuration
    - threshold
    - training configuration

    This prevents future code changes from silently breaking historical
    model artifacts.
    """

    def __init__(
        self,
        *,
        model_version: str,
        feature_columns: list[str],
        log_transform_columns: list[str],
        n_estimators: int = 300,
        threshold_percentile: float = 0.99,
        random_state: int = 42,
    ) -> None:
        self.model_name = (
            "isolation-forest"
        )

        self.model_version = (
            model_version
        )

        self.feature_columns = list(
            feature_columns
        )

        self.log_transform_columns = list(
            log_transform_columns
        )

        self.n_estimators = (
            n_estimators
        )

        self.threshold_percentile = (
            threshold_percentile
        )

        self.random_state = (
            random_state
        )

        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination="auto",
            random_state=random_state,
            n_jobs=-1,
        )

        self.training_scores_sorted: (
            np.ndarray | None
        ) = None

        self.training_sample_count: int = 0

    def _prepare_matrix(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        return prepare_model_matrix(
            dataframe,
            feature_columns=(
                self.feature_columns
            ),
            log_transform_columns=(
                self.log_transform_columns
            ),
        )

    def fit(
        self,
        dataframe: pd.DataFrame,
    ) -> None:
        matrix = self._prepare_matrix(
            dataframe
        )

        self.model.fit(
            matrix
        )

        raw_scores = (
            -self.model.score_samples(
                matrix
            )
        )

        self.training_scores_sorted = (
            np.sort(
                raw_scores
            )
        )

        self.training_sample_count = len(
            dataframe
        )

    def raw_anomaly_scores(
        self,
        dataframe: pd.DataFrame,
    ) -> np.ndarray:
        matrix = self._prepare_matrix(
            dataframe
        )

        return (
            -self.model.score_samples(
                matrix
            )
        )

    def normalized_scores(
        self,
        dataframe: pd.DataFrame,
    ) -> np.ndarray:
        """
        Return historical anomaly percentiles in the range 0-1.

        These scores are anomaly rankings, not probabilities of attack.
        """

        if (
            self.training_scores_sorted
            is None
        ):
            raise RuntimeError(
                "Detector must be fitted "
                "before scoring."
            )

        raw_scores = (
            self.raw_anomaly_scores(
                dataframe
            )
        )

        training_count = len(
            self.training_scores_sorted
        )

        percentiles = np.searchsorted(
            self.training_scores_sorted,
            raw_scores,
            side="right",
        ) / training_count

        return np.clip(
            percentiles,
            0.0,
            1.0,
        )

    def predict(
        self,
        dataframe: pd.DataFrame,
    ) -> np.ndarray:
        scores = self.normalized_scores(
            dataframe
        )

        return (
            scores
            >= self.threshold_percentile
        ).astype(
            int
        )

    def save(
        self,
        path: Path,
    ) -> None:
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        joblib.dump(
            self,
            path,
        )

    @staticmethod
    def load(
        path: Path,
    ) -> "SentinelIsolationForest":
        detector = joblib.load(
            path
        )

        if not isinstance(
            detector,
            SentinelIsolationForest,
        ):
            raise TypeError(
                "Artifact is not a "
                "SentinelIsolationForest."
            )

        return detector