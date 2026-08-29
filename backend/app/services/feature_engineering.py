from typing import Any

from app.models import Employee, Event


def extract_behavioral_features(
    event: Event,
    employee: Employee,
) -> dict[str, Any]:
    """
    Convert one event and the employee's behavioral baseline into a
    small explainable feature vector.

    This is the first version of SENTINEL feature engineering.

    Later versions will add rolling-window and historical features such as:
    - failed logins in the previous 10 minutes
    - events in the previous 5 minutes
    - files accessed in the previous 30 minutes
    - user-specific historical deviations

    IMPORTANT:
    Simulator ground-truth labels are intentionally not used here.
    """

    event_hour = event.timestamp.hour

    outside_work_hours = not (
        employee.normal_start_hour
        <= event_hour
        < employee.normal_end_hour
    )

    unusual_source_ip = (
        event.source_ip != employee.typical_ip
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
        total_bytes / typical_daily_bytes
    )

    failed_operation = not event.success

    return {
        "event_hour": event_hour,
        "outside_work_hours": outside_work_hours,
        "unusual_source_ip": unusual_source_ip,
        "total_bytes": total_bytes,
        "typical_daily_bytes": typical_daily_bytes,
        "data_volume_ratio": round(data_volume_ratio, 6),
        "failed_operation": failed_operation,
        "event_type": event.event_type,
    }