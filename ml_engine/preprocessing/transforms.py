import numpy as np
import pandas as pd


V1_LOG_TRANSFORM_COLUMNS = [
    "bytes_sent",
    "bytes_received",
    "total_bytes",
    "data_volume_ratio",
    "bytes_sent_30m",
    "bytes_received_30m",
]


V2_LOG_TRANSFORM_COLUMNS = [
    "work_hour_deviation",
    "bytes_sent",
    "bytes_received",
    "total_bytes",
    "data_volume_ratio",
    "failed_logins_10m",
    "events_5m",
    "file_events_30m",
    "network_events_5m",
    "unique_destinations_5m",
    "bytes_sent_30m",
    "bytes_received_30m",
]


def prepare_model_matrix(
    dataframe: pd.DataFrame,
    *,
    feature_columns: list[str],
    log_transform_columns: list[str],
) -> pd.DataFrame:
    """
    Create the numerical matrix required by one specific model version.

    Every model explicitly supplies its own feature schema and preprocessing
    configuration so historical model artifacts remain reproducible.
    """

    missing_columns = [
        column
        for column in feature_columns
        if column not in dataframe.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing model features: "
            + ", ".join(
                missing_columns
            )
        )

    matrix = dataframe[
        feature_columns
    ].copy()

    for column in log_transform_columns:
        if column in matrix.columns:
            matrix[column] = np.log1p(
                matrix[column].clip(
                    lower=0
                )
            )

    if matrix.isnull().any().any():
        raise ValueError(
            "Model matrix contains null values."
        )

    return matrix.astype(
        float
    )


def parse_event_timestamps(
    dataframe: pd.DataFrame,
) -> pd.DataFrame:
    """
    Parse all SENTINEL event timestamp formats consistently.
    """

    dataframe = dataframe.copy()

    dataframe[
        "event_timestamp"
    ] = pd.to_datetime(
        dataframe[
            "event_timestamp"
        ],
        format="mixed",
        utc=True,
    )

    return dataframe