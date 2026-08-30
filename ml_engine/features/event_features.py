from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
import math
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee, Event


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


@dataclass
class HistoricalEvent:
    """
    Lightweight historical event used by rolling feature windows.
    """

    timestamp: datetime
    event_type: str
    destination_ip: str | None
    bytes_sent: int
    bytes_received: int
    success: bool


class EventFeatureBuilder:
    """
    Convert SENTINEL event history into numerical behavioral features.

    Ground-truth simulator labels remain evaluation metadata only.
    """

    def __init__(
        self,
        db: Session,
    ) -> None:
        self.db = db

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

        Events inside normal hours return 0.
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
    ) -> tuple[float, float]:
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
    ) -> dict[str, int]:
        """
        One-hot encode observable event type.
        """

        return {
            f"event_type_{known_type.lower()}": int(
                event_type == known_type
            )
            for known_type in EVENT_TYPES
        }

    @staticmethod
    def _prune_window(
        history: deque[HistoricalEvent],
        current_time: datetime,
        window: timedelta,
    ) -> None:
        cutoff = (
            current_time - window
        )

        while (
            history
            and history[0].timestamp
            < cutoff
        ):
            history.popleft()

    def build_dataframe(
        self,
    ) -> pd.DataFrame:
        statement = (
            select(Event, Employee)
            .join(
                Employee,
                Event.employee_id
                == Employee.id,
            )
            .order_by(
                Event.timestamp,
                Event.created_at,
            )
        )

        rows = self.db.execute(
            statement
        ).all()

        histories_5m: dict[
            str,
            deque[HistoricalEvent],
        ] = defaultdict(deque)

        histories_10m: dict[
            str,
            deque[HistoricalEvent],
        ] = defaultdict(deque)

        histories_30m: dict[
            str,
            deque[HistoricalEvent],
        ] = defaultdict(deque)

        feature_rows: list[
            dict[str, Any]
        ] = []

        for event, employee in rows:
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
                    if previous.destination_ip
                    is not None
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
                employee.typical_data_transfer_bytes,
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
                # Metadata
                "event_id": event.event_id,
                "event_timestamp": event.timestamp,

                "employee_id": str(
                    employee.id
                ),

                "user_id": employee.user_id,
                "department": employee.department,
                "event_type": event.event_type,

                # Core features
                "hour_sin": hour_sin,
                "hour_cos": hour_cos,

                "outside_work_hours": (
                    self._outside_work_hours(
                        event,
                        employee,
                    )
                ),

                "work_hour_deviation": (
                    self._work_hour_deviation(
                        event,
                        employee,
                    )
                ),

                "source_ip_is_baseline": int(
                    event.source_ip
                    == employee.typical_ip
                ),

                "is_remote_context": (
                    is_remote_context
                ),

                "remote_work_probability": float(
                    employee.behavior_profile.get(
                        "remote_work_probability",
                        0.0,
                    )
                ),

                "bytes_sent": event.bytes_sent,
                "bytes_received": (
                    event.bytes_received
                ),

                "total_bytes": total_bytes,

                "data_volume_ratio": (
                    data_volume_ratio
                ),

                "success": int(
                    event.success
                ),

                "failed_logins_10m": (
                    failed_logins_10m
                ),

                "events_5m": (
                    events_5m
                ),

                "file_events_30m": (
                    file_events_30m
                ),

                "network_events_5m": (
                    network_events_5m
                ),

                "unique_destinations_5m": (
                    unique_destinations_5m
                ),

                "bytes_sent_30m": (
                    bytes_sent_30m
                ),

                "bytes_received_30m": (
                    bytes_received_30m
                ),

                # Evaluation metadata ONLY
                "is_injected_anomaly": int(
                    event.is_injected_anomaly
                ),

                "scenario_type": (
                    event.scenario_type
                ),
            }

            feature_row.update(
                self._event_type_features(
                    event.event_type
                )
            )

            feature_rows.append(
                feature_row
            )

            historical_event = HistoricalEvent(
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