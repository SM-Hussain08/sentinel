"""
Public operational-runtime schemas for SENTINEL.

These schemas expose safe runtime intelligence for:

- the always-on SENTINEL event processor;
- the optional synthetic corporate simulator;
- the combined operations-status endpoint.

Important
---------
These responses intentionally expose operational state only.

They MUST NOT expose simulator ground truth such as:
- injected attack labels;
- scenario event membership;
- attack-stage labels;
- future ground-truth information.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
)


# ============================================================
# Shared runtime types
# ============================================================


RuntimeHealth = Literal[
    "HEALTHY",
    "STALE",
    "STOPPED",
    "ERROR",
    "UNKNOWN",
]


class RuntimeErrorInfo(
    BaseModel
):
    """
    Safe public runtime failure information.

    Internal tracebacks are deliberately not exposed.
    """

    message: str

    occurred_at: datetime | None = None


# ============================================================
# Event processor
# ============================================================


class ProcessorDetectorInfo(
    BaseModel
):
    """
    Detector generation currently owned by the processor.
    """

    name: str

    version: str


class ProcessorRuntimeCounters(
    BaseModel
):
    """
    Persistent and derived operational processor counters.
    """

    events_processed: int = Field(
        default=0,
        ge=0,
    )

    scores_created: int = Field(
        default=0,
        ge=0,
    )

    incidents_created: int = Field(
        default=0,
        ge=0,
    )

    incidents_updated: int = Field(
        default=0,
        ge=0,
    )

    live_backlog: int = Field(
        default=0,
        ge=0,
        description=(
            "Eligible post-activation events "
            "that do not yet have a score from "
            "the selected detector generation."
        ),
    )


class ProcessorRuntimeStatus(
    BaseModel
):
    """
    Public health and runtime status of the always-on
    SENTINEL event processor.
    """

    service: Literal[
        "event-processor"
    ] = "event-processor"

    operational: bool

    health: RuntimeHealth

    status: str

    processor_name: str

    worker_id: str | None = None

    worker_version: str | None = None

    activated_at: datetime | None = None

    last_heartbeat_at: datetime | None = None

    heartbeat_age_seconds: float | None = Field(
        default=None,
        ge=0,
    )

    stopped_at: datetime | None = None

    detector: ProcessorDetectorInfo | None = None

    counters: ProcessorRuntimeCounters

    last_error: RuntimeErrorInfo | None = None


# ============================================================
# Simulation runtime
# ============================================================


class SimulationRuntimeClock(
    BaseModel
):
    """
    Wall-clock and synthetic-clock information for one run.
    """

    real_runtime_seconds: float = Field(
        default=0,
        ge=0,
    )

    simulated_runtime_seconds: float | None = Field(
        default=None,
        ge=0,
    )

    simulated_hours_elapsed: float | None = Field(
        default=None,
        ge=0,
    )

    simulation_minutes_per_real_second: float | None = Field(
        default=None,
        ge=0,
    )

    speed_multiplier: float | None = Field(
        default=None,
        ge=0,
        description=(
            "Synthetic seconds advanced per "
            "real-world second."
        ),
    )

    simulated_now: datetime | None = None

    simulated_start_time: datetime | None = None


class SimulationRuntimeConfiguration(
    BaseModel
):
    """
    Public, non-ground-truth simulator configuration.
    """

    preset: str | None = None

    heartbeat_seconds: float | None = Field(
        default=None,
        ge=0,
    )

    attack_campaign_rate_per_simulated_hour: float | None = Field(
        default=None,
        ge=0,
    )

    simulation_minutes_per_real_second: float | None = Field(
        default=None,
        ge=0,
    )

    max_events_per_tick: int | None = Field(
        default=None,
        ge=0,
    )

    max_events_per_employee_per_tick: int | None = Field(
        default=None,
        ge=0,
    )

    scenario_cooldown_minutes: float | None = Field(
        default=None,
        ge=0,
    )

    max_concurrent_attacks: int | None = Field(
        default=None,
        ge=0,
    )


class SimulationObservedMetrics(
    BaseModel
):
    """
    Public runtime metrics for one simulation run.

    Incident metrics describe incidents observed by SENTINEL
    during the run's operational time window. They do not
    claim that the simulator caused those incidents.
    """

    employees_loaded: int = Field(
        default=0,
        ge=0,
    )

    active_employees: int = Field(
        default=0,
        ge=0,
    )

    events_generated: int = Field(
        default=0,
        ge=0,
    )

    event_throughput_per_real_minute: float | None = Field(
        default=None,
        ge=0,
    )

    incidents_observed: int = Field(
        default=0,
        ge=0,
    )

    incident_rate_per_real_hour: float | None = Field(
        default=None,
        ge=0,
    )

    incident_rate_per_simulated_hour: float | None = Field(
        default=None,
        ge=0,
    )


class SimulationRuntimeStatus(
    BaseModel
):
    """
    Public state of the synthetic corporate environment.
    """

    service: Literal[
        "simulator"
    ] = "simulator"

    running: bool

    health: RuntimeHealth

    status: str

    has_run_history: bool = True

    run_id: str | None = None

    mode: str | None = None

    worker_id: str | None = None

    worker_version: str | None = None

    seed: int | None = None

    started_at: datetime | None = None

    stopped_at: datetime | None = None

    last_heartbeat_at: datetime | None = None

    heartbeat_age_seconds: float | None = Field(
        default=None,
        ge=0,
    )

    clock: SimulationRuntimeClock | None = None

    configuration: SimulationRuntimeConfiguration | None = None

    metrics: SimulationObservedMetrics | None = None

    last_error: RuntimeErrorInfo | None = None


# ============================================================
# Combined operations response
# ============================================================


class OperationsStatus(
    BaseModel
):
    """
    Combined read-only runtime view consumed by the SOC frontend.

    It intentionally keeps SENTINEL processing health separate
    from simulator health because the platform can remain
    operational while simulation is stopped.
    """

    generated_at: datetime

    sentinel: ProcessorRuntimeStatus

    simulation: SimulationRuntimeStatus
