"""
SENTINEL behavioral event feature engineering.

This module supports two execution paths:

1. Historical/batch feature generation
   Used by reproducible benchmark and batch workflows.

2. Incremental event feature generation
   Used by the live SENTINEL processing pipeline.

Operational feature generation never requires simulator ground-truth labels.
Ground truth can optionally be attached to historical benchmark datasets for
evaluation only.
"""

from __future__ import annotations

from collections import (
    defaultdict,
    deque,
)
from dataclasses import dataclass
from datetime import (
    datetime,
    timedelta,
)
import math
from typing import Any

import pandas as pd
from sqlalchemy import (
    and_,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.services.evaluation_ground_truth import get_event_evaluation_label

from app.models import (
    Employee,
    Event,
)


# ============================================================
# Event vocabulary
# ============================================================

EVENT_TYPES = [
    "LOGIN_SUCCESS",
    "LOGIN_FAILURE",
    "LOGOUT",
    "FILE_ACCESS",
    "FILE_DOWNLOAD",
    "FILE_UPLOAD",
    "DATABASE_ACCESS",
    "NETWORK_CONNECTION",
]


# ============================================================
# Feature schema
# ============================================================

BASE_FEATURE_COLUMNS = [
    "hour_sin",
    "hour_cos",
    "outside_work_hours",
    "work_hour_deviation",
    "source_ip_is_baseline",
    "is_remote_context",
    "remote_work_probability",
    "bytes_sent",
    "bytes_received",
    "total_bytes",
    "data_volume_ratio",
    "success",
    "failed_logins_10m",
    "events_5m",
    "file_events_30m",
    "network_events_5m",
    "unique_destinations_5m",
    "bytes_sent_30m",
    "bytes_received_30m",
]


EVENT_TYPE_FEATURE_COLUMNS = [
    f"event_type_{event_type.lower()}"
    for event_type in EVENT_TYPES
]


FEATURE_COLUMNS = (
    BASE_FEATURE_COLUMNS
    + EVENT_TYPE_FEATURE_COLUMNS
)


# ============================================================
# Rolling-history representation
# ============================================================

@dataclass(frozen=True)
class HistoricalEvent:
    """
    Lightweight event representation used by rolling feature windows.

    Only observable telemetry is retained here.
    Simulator ground-truth metadata is deliberately excluded.
    """

    timestamp: datetime
    event_type: str
    destination_ip: str | None
    bytes_sent: int
    bytes_received: int
    success: bool


class EventFeatureBuilder:
    """
    Build SENTINEL's numerical behavioral feature representation.

    Two public workflows are supported:

    build_dataframe()
        Reconstruct features chronologically for the complete event history.

    build_event_row()
        Build features for one already-persisted event using only events that
        occurred before it.

    Simulator ground-truth values are optional evaluation metadata and are
    never required for operational scoring.
    """

    MAX_HISTORY_WINDOW = timedelta(
        minutes=30,
    )

    def __init__(
        self,
        db: Session,
    ) -> None:
        self.db = db

    # ========================================================
    # Stateless behavioral helpers
    # ========================================================

    @staticmethod
    def _outside_work_hours(
        event: Event,
        employee: Employee,
    ) -> int:
        hour = event.timestamp.hour

        return int(
            not (
                employee.normal_start_hour
                <= hour
                < employee.normal_end_hour
            )
        )

    @staticmethod
    def _work_hour_deviation(
        event: Event,
        employee: Employee,
    ) -> float:
        """
        Measure how far an event occurs outside the configured work window.

        Events inside normal hours return zero.
        """

        event_minutes = (
            event.timestamp.hour
            * 60
            + event.timestamp.minute
        )

        start_minutes = (
            employee.normal_start_hour
            * 60
        )

        end_minutes = (
            employee.normal_end_hour
            * 60
        )

        if (
            start_minutes
            <= event_minutes
            < end_minutes
        ):
            return 0.0

        if event_minutes < start_minutes:
            deviation_minutes = (
                start_minutes
                - event_minutes
            )

        else:
            deviation_minutes = (
                event_minutes
                - end_minutes
            )

        return round(
            deviation_minutes / 60,
            3,
        )

    @staticmethod
    def _cyclical_hour(
        timestamp: datetime,
    ) -> tuple[
        float,
        float,
    ]:
        """
        Encode clock time on a circular 24-hour scale.
        """

        fractional_hour = (
            timestamp.hour
            + timestamp.minute / 60
            + timestamp.second / 3600
        )

        angle = (
            2
            * math.pi
            * fractional_hour
            / 24
        )

        return (
            math.sin(angle),
            math.cos(angle),
        )

    @staticmethod
    def _event_type_features(
        event_type: str,
    ) -> dict[
        str,
        int,
    ]:
        """
        One-hot encode the observable event type.
        """

        return {
            (
                f"event_type_"
                f"{known_type.lower()}"
            ):
                int(
                    event_type
                    == known_type
                )
            for known_type
            in EVENT_TYPES
        }

    @staticmethod
    def _historical_event(
        event: Event,
    ) -> HistoricalEvent:
        """
        Convert a database Event into the rolling-history representation.
        """

        return HistoricalEvent(
            timestamp=event.timestamp,
            event_type=event.event_type,
            destination_ip=(
                event.destination_ip
            ),
            bytes_sent=(
                event.bytes_sent
            ),
            bytes_received=(
                event.bytes_received
            ),
            success=event.success,
        )

    @staticmethod
    def _prune_window(
        history: deque[
            HistoricalEvent
        ],
        current_time: datetime,
        window: timedelta,
    ) -> None:
        cutoff = (
            current_time
            - window
        )

        while (
            history
            and history[0].timestamp
            < cutoff
        ):
            history.popleft()

    # ========================================================
    # Shared row construction
    # ========================================================

    def _build_feature_row(
        self,
        *,
        event: Event,
        employee: Employee,
        history_5m: deque[
            HistoricalEvent
        ],
        history_10m: deque[
            HistoricalEvent
        ],
        history_30m: deque[
            HistoricalEvent
        ],
        include_evaluation_metadata: bool,
    ) -> dict[
        str,
        Any,
    ]:
        """
        Build one feature row from observable event history.

        The supplied history containers must contain only events occurring
        before the current event.
        """

        self._prune_window(
            history_5m,
            event.timestamp,
            timedelta(
                minutes=5,
            ),
        )

        self._prune_window(
            history_10m,
            event.timestamp,
            timedelta(
                minutes=10,
            ),
        )

        self._prune_window(
            history_30m,
            event.timestamp,
            timedelta(
                minutes=30,
            ),
        )

        failed_logins_10m = sum(
            1
            for previous
            in history_10m
            if (
                previous.event_type
                == "LOGIN_FAILURE"
                and not previous.success
            )
        )

        events_5m = len(
            history_5m
        )

        file_events_30m = sum(
            1
            for previous
            in history_30m
            if previous.event_type
            in {
                "FILE_ACCESS",
                "FILE_DOWNLOAD",
                "FILE_UPLOAD",
            }
        )

        network_events_5m = sum(
            1
            for previous
            in history_5m
            if (
                previous.event_type
                == "NETWORK_CONNECTION"
            )
        )

        unique_destinations_5m = len(
            {
                previous.destination_ip
                for previous
                in history_5m
                if (
                    previous.destination_ip
                    is not None
                )
            }
        )

        bytes_sent_30m = sum(
            previous.bytes_sent
            for previous
            in history_30m
        )

        bytes_received_30m = sum(
            previous.bytes_received
            for previous
            in history_30m
        )

        total_bytes = (
            event.bytes_sent
            + event.bytes_received
        )

        typical_daily_bytes = max(
            employee
            .typical_data_transfer_bytes,
            1,
        )

        data_volume_ratio = (
            total_bytes
            / typical_daily_bytes
        )

        hour_sin, hour_cos = (
            self._cyclical_hour(
                event.timestamp
            )
        )

        is_remote_context = int(
            event.source_location
            == "Remote / VPN"
        )

        feature_row: dict[
            str,
            Any,
        ] = {
            # ---------------------------------------------
            # Observable metadata
            # ---------------------------------------------
            "event_id":
                event.event_id,

            "event_timestamp":
                event.timestamp,

            "employee_id":
                str(
                    employee.id
                ),

            "user_id":
                employee.user_id,

            "department":
                employee.department,

            "event_type":
                event.event_type,

            # ---------------------------------------------
            # Behavioral features
            # ---------------------------------------------
            "hour_sin":
                hour_sin,

            "hour_cos":
                hour_cos,

            "outside_work_hours":
                self._outside_work_hours(
                    event,
                    employee,
                ),

            "work_hour_deviation":
                self._work_hour_deviation(
                    event,
                    employee,
                ),

            "source_ip_is_baseline":
                int(
                    event.source_ip
                    == employee.typical_ip
                ),

            "is_remote_context":
                is_remote_context,

            "remote_work_probability":
                float(
                    employee
                    .behavior_profile
                    .get(
                        "remote_work_probability",
                        0.0,
                    )
                ),

            "bytes_sent":
                event.bytes_sent,

            "bytes_received":
                event.bytes_received,

            "total_bytes":
                total_bytes,

            "data_volume_ratio":
                data_volume_ratio,

            "success":
                int(
                    event.success
                ),

            "failed_logins_10m":
                failed_logins_10m,

            "events_5m":
                events_5m,

            "file_events_30m":
                file_events_30m,

            "network_events_5m":
                network_events_5m,

            "unique_destinations_5m":
                unique_destinations_5m,

            "bytes_sent_30m":
                bytes_sent_30m,

            "bytes_received_30m":
                bytes_received_30m,
        }

        feature_row.update(
            self._event_type_features(
                event.event_type
            )
        )

        # ---------------------------------------------
        # Evaluation metadata
        # ---------------------------------------------
        #
        # IMPORTANT:
        # These fields are intentionally optional.
        #
        # Operational scoring calls this method with:
        #
        #     include_evaluation_metadata=False
        #
        # so the live detector does not even receive simulator
        # ground-truth values in its working feature row.
        #
        if include_evaluation_metadata:
            (
                is_injected_anomaly,
                scenario_type,
            ) = get_event_evaluation_label(
                db=self.db,
                event_uuid=event.id,
            )

            feature_row[
                "is_injected_anomaly"
            ] = (
                is_injected_anomaly
            )

            feature_row[
                "scenario_type"
            ] = (
                scenario_type
            )

        return feature_row

    # ========================================================
    # Historical / benchmark dataframe
    # ========================================================

    def build_dataframe(
        self,
        *,
        include_evaluation_metadata: bool = True,
    ) -> pd.DataFrame:
        """
        Reconstruct the complete event feature history chronologically.

        Evaluation metadata is included by default to preserve the benchmark
        workflow used by SENTINEL's controlled model evaluation.

        Operational callers should explicitly pass:

            include_evaluation_metadata=False
        """

        statement = (
            select(
                Event,
                Employee,
            )
            .join(
                Employee,
                Event.employee_id
                == Employee.id,
            )
            .order_by(
                Event.timestamp,
                Event.created_at,
                Event.event_id,
            )
        )

        rows = self.db.execute(
            statement
        ).all()

        histories_5m: dict[
            str,
            deque[
                HistoricalEvent
            ],
        ] = defaultdict(
            deque
        )

        histories_10m: dict[
            str,
            deque[
                HistoricalEvent
            ],
        ] = defaultdict(
            deque
        )

        histories_30m: dict[
            str,
            deque[
                HistoricalEvent
            ],
        ] = defaultdict(
            deque
        )

        feature_rows: list[
            dict[
                str,
                Any,
            ]
        ] = []

        for (
            event,
            employee,
        ) in rows:
            employee_key = str(
                employee.id
            )

            history_5m = (
                histories_5m[
                    employee_key
                ]
            )

            history_10m = (
                histories_10m[
                    employee_key
                ]
            )

            history_30m = (
                histories_30m[
                    employee_key
                ]
            )

            feature_row = (
                self._build_feature_row(
                    event=event,
                    employee=employee,
                    history_5m=(
                        history_5m
                    ),
                    history_10m=(
                        history_10m
                    ),
                    history_30m=(
                        history_30m
                    ),
                    include_evaluation_metadata=(
                        include_evaluation_metadata
                    ),
                )
            )

            feature_rows.append(
                feature_row
            )

            historical_event = (
                self._historical_event(
                    event
                )
            )

            history_5m.append(
                historical_event
            )

            history_10m.append(
                historical_event
            )

            history_30m.append(
                historical_event
            )

        return pd.DataFrame(
            feature_rows
        )

    # ========================================================
    # Incremental / live event feature generation
    # ========================================================

    def build_event_row(
        self,
        *,
        event: Event,
        employee: Employee | None = None,
        include_evaluation_metadata: bool = False,
    ) -> dict[
        str,
        Any,
    ]:
        """
        Build features for one persisted event.

        Only earlier events belonging to the same employee are used.

        The event must already have been flushed to PostgreSQL so that
        created_at is available and chronological ordering is unambiguous.

        This is the feature-generation path intended for SENTINEL's live
        simulator worker and other incremental processing workflows.
        """

        if event.id is None:
            raise RuntimeError(
                "Event must be added and flushed "
                "before incremental feature generation."
            )

        if event.created_at is None:
            raise RuntimeError(
                "Event created_at is unavailable. "
                "Flush the event before scoring it."
            )

        if employee is None:
            employee = self.db.get(
                Employee,
                event.employee_id,
            )

        if employee is None:
            raise RuntimeError(
                "Employee could not be resolved "
                f"for event {event.event_id}."
            )

        cutoff = (
            event.timestamp
            - self.MAX_HISTORY_WINDOW
        )

        earlier_than_current = or_(
            Event.timestamp
            < event.timestamp,

            and_(
                Event.timestamp
                == event.timestamp,

                Event.created_at
                < event.created_at,
            ),

            and_(
                Event.timestamp
                == event.timestamp,

                Event.created_at
                == event.created_at,

                Event.event_id
                < event.event_id,
            ),
        )

        statement = (
            select(
                Event
            )
            .where(
                Event.employee_id
                == event.employee_id,

                Event.id
                != event.id,

                Event.timestamp
                >= cutoff,

                earlier_than_current,
            )
            .order_by(
                Event.timestamp,
                Event.created_at,
                Event.event_id,
            )
        )

        previous_events = list(
            self.db.scalars(
                statement
            ).all()
        )

        history_5m: deque[
            HistoricalEvent
        ] = deque()

        history_10m: deque[
            HistoricalEvent
        ] = deque()

        history_30m: deque[
            HistoricalEvent
        ] = deque()

        for previous_event in (
            previous_events
        ):
            historical_event = (
                self._historical_event(
                    previous_event
                )
            )

            history_5m.append(
                historical_event
            )

            history_10m.append(
                historical_event
            )

            history_30m.append(
                historical_event
            )

        return self._build_feature_row(
            event=event,
            employee=employee,
            history_5m=history_5m,
            history_10m=history_10m,
            history_30m=history_30m,
            include_evaluation_metadata=(
                include_evaluation_metadata
            ),
        )