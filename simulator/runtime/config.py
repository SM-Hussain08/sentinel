"""
Configuration for SENTINEL's live corporate simulation runtime.

The live simulator is intentionally separate from SENTINEL's detection
pipeline.

It generates a synthetic corporate world containing normal employee
activity and, optionally, injected attack campaigns.

The simulator never decides whether an event is anomalous.

Attack frequency
----------------
SENTINEL_SIM_ATTACK_RATE controls the expected number of injected attack
campaigns per simulated hour.

Examples:

    0       normal activity only
    0.25    approximately one campaign every four simulated hours
    0.5     approximately one campaign every two simulated hours
    1.0     approximately one campaign per simulated hour
    2.0     approximately two campaigns per simulated hour

The value is a long-run average, not a fixed interval.

If no attack rate or preset is supplied, the default is zero:
normal corporate activity only.

Optional presets remain available as convenience aliases:

    normal      attack rate 0
    realistic   attack rate 0.25
    demo        attack rate 1.0

An explicit SENTINEL_SIM_ATTACK_RATE always overrides the preset.
"""

from __future__ import annotations

from dataclasses import (
    asdict,
    dataclass,
)
import os
import secrets
import socket
from typing import Any


# ============================================================
# Simulation presets
# ============================================================

SIMULATION_PRESET_NORMAL = "normal"
SIMULATION_PRESET_REALISTIC = "realistic"
SIMULATION_PRESET_DEMO = "demo"

SUPPORTED_SIMULATION_PRESETS = {
    SIMULATION_PRESET_NORMAL,
    SIMULATION_PRESET_REALISTIC,
    SIMULATION_PRESET_DEMO,
}


PRESET_DEFAULTS: dict[
    str,
    dict[str, float | int],
] = {
    SIMULATION_PRESET_NORMAL: {
        "attack_rate_per_simulated_hour": 0.0,
        "scenario_cooldown_minutes": 360,
    },

    SIMULATION_PRESET_REALISTIC: {
        "attack_rate_per_simulated_hour": 0.25,
        "scenario_cooldown_minutes": 360,
    },

    SIMULATION_PRESET_DEMO: {
        "attack_rate_per_simulated_hour": 1.0,
        "scenario_cooldown_minutes": 60,
    },
}


# ============================================================
# Environment helpers
# ============================================================

def _env_string(
    name: str,
    default: str,
) -> str:
    value = os.getenv(
        name
    )

    if value is None:
        return default

    value = value.strip()

    return (
        value
        if value
        else default
    )


def _env_int(
    name: str,
    default: int,
    *,
    minimum: int | None = None,
) -> int:
    raw = os.getenv(
        name
    )

    value = (
        default
        if raw is None
        else int(
            raw.strip()
        )
    )

    if (
        minimum is not None
        and value < minimum
    ):
        raise ValueError(
            f"{name} must be >= {minimum}."
        )

    return value


def _env_float(
    name: str,
    default: float,
    *,
    minimum: float | None = None,
) -> float:
    raw = os.getenv(
        name
    )

    value = (
        default
        if raw is None
        else float(
            raw.strip()
        )
    )

    if (
        minimum is not None
        and value < minimum
    ):
        raise ValueError(
            f"{name} must be >= {minimum}."
        )

    return value


def _env_optional_int(
    name: str,
) -> int | None:
    raw = os.getenv(
        name
    )

    if raw is None:
        return None

    raw = raw.strip()

    if not raw:
        return None

    return int(
        raw
    )


def _env_optional_float(
    name: str,
) -> float | None:
    raw = os.getenv(
        name
    )

    if raw is None:
        return None

    raw = raw.strip()

    if not raw:
        return None

    return float(
        raw
    )


# ============================================================
# Preset resolution
# ============================================================

def _load_simulation_preset(
) -> str:
    """
    Load and validate the requested convenience preset.

    No explicit preset means normal-only simulation.
    """

    preset = _env_string(
        "SENTINEL_SIM_PRESET",
        SIMULATION_PRESET_NORMAL,
    ).lower()

    if (
        preset
        not in SUPPORTED_SIMULATION_PRESETS
    ):
        supported = ", ".join(
            sorted(
                SUPPORTED_SIMULATION_PRESETS
            )
        )

        raise ValueError(
            (
                "SENTINEL_SIM_PRESET must be one of: "
                f"{supported}. "
                f"Received: {preset!r}."
            )
        )

    return preset


# ============================================================
# Live simulation configuration
# ============================================================

@dataclass(
    frozen=True,
)
class LiveSimulationConfig:
    """
    Immutable settings for one live simulation worker.

    attack_rate_per_simulated_hour is the expected number of injected
    attack campaigns per simulated hour.

    A rate of zero disables automatic attacks completely.
    """

    preset: str

    seed: int

    worker_id: str
    worker_version: str

    tick_seconds: float

    simulation_minutes_per_real_second: float

    heartbeat_seconds: float

    employee_refresh_seconds: float

    max_events_per_tick: int

    max_events_per_employee_per_tick: int

    attack_rate_per_simulated_hour: float

    scenario_cooldown_minutes: int

    max_concurrent_attack_episodes: int

    initial_simulated_hour: int

    @property
    def simulated_seconds_per_real_second(
        self,
    ) -> float:
        return (
            self.simulation_minutes_per_real_second
            * 60.0
        )

    @property
    def attacks_enabled(
        self,
    ) -> bool:
        return (
            self.attack_rate_per_simulated_hour
            > 0.0
        )

    @property
    def is_demo(
        self,
    ) -> bool:
        return (
            self.preset
            == SIMULATION_PRESET_DEMO
        )

    @property
    def is_realistic(
        self,
    ) -> bool:
        return (
            self.preset
            == SIMULATION_PRESET_REALISTIC
        )

    @property
    def is_normal_only(
        self,
    ) -> bool:
        return not self.attacks_enabled

    def as_dict(
        self,
    ) -> dict[str, Any]:
        """
        JSON-safe representation for SimulationRun.configuration.
        """

        return asdict(
            self
        )


# ============================================================
# Configuration loader
# ============================================================

def load_live_simulation_config(
) -> LiveSimulationConfig:
    """
    Load and validate live simulation settings.

    Resolution order:

        preset default
            ↓
        explicit environment override
            ↓
        final immutable configuration

    SENTINEL_SIM_ATTACK_RATE always wins over preset defaults.
    """

    # --------------------------------------------------------
    # Preset
    # --------------------------------------------------------

    preset = (
        _load_simulation_preset()
    )

    preset_defaults = (
        PRESET_DEFAULTS[
            preset
        ]
    )

    # --------------------------------------------------------
    # Attack rate
    # --------------------------------------------------------

    explicit_attack_rate = (
        _env_optional_float(
            "SENTINEL_SIM_ATTACK_RATE"
        )
    )

    attack_rate = (
        explicit_attack_rate
        if explicit_attack_rate is not None
        else float(
            preset_defaults[
                "attack_rate_per_simulated_hour"
            ]
        )
    )

    if attack_rate < 0:
        raise ValueError(
            "SENTINEL_SIM_ATTACK_RATE must be >= 0."
        )

    scenario_cooldown = _env_int(
        "SENTINEL_SIM_SCENARIO_COOLDOWN_MINUTES",
        int(
            preset_defaults[
                "scenario_cooldown_minutes"
            ]
        ),
        minimum=1,
    )

    # --------------------------------------------------------
    # Seed
    # --------------------------------------------------------

    requested_seed = (
        _env_optional_int(
            "SENTINEL_SIM_SEED"
        )
    )

    effective_seed = (
        requested_seed
        if requested_seed is not None
        else secrets.randbelow(
            2_147_483_647
        )
    )

    # --------------------------------------------------------
    # Worker identity
    # --------------------------------------------------------

    hostname = socket.gethostname()

    worker_id = _env_string(
        "SENTINEL_SIM_WORKER_ID",
        f"simulator-{hostname}",
    )

    worker_version = _env_string(
        "SENTINEL_SIM_WORKER_VERSION",
        "1.0",
    )

    # --------------------------------------------------------
    # Simulated workday
    # --------------------------------------------------------

    initial_hour = _env_int(
        "SENTINEL_SIM_INITIAL_HOUR",
        8,
        minimum=0,
    )

    if initial_hour > 23:
        raise ValueError(
            "SENTINEL_SIM_INITIAL_HOUR must be <= 23."
        )

    # --------------------------------------------------------
    # Final configuration
    # --------------------------------------------------------

    return LiveSimulationConfig(
        preset=preset,

        seed=effective_seed,

        worker_id=worker_id,

        worker_version=worker_version,

        tick_seconds=_env_float(
            "SENTINEL_SIM_TICK_SECONDS",
            1.0,
            minimum=0.1,
        ),

        simulation_minutes_per_real_second=(
            _env_float(
                "SENTINEL_SIM_SPEED",
                1.0,
                minimum=0.1,
            )
        ),

        heartbeat_seconds=_env_float(
            "SENTINEL_SIM_HEARTBEAT_SECONDS",
            5.0,
            minimum=1.0,
        ),

        employee_refresh_seconds=_env_float(
            "SENTINEL_SIM_EMPLOYEE_REFRESH_SECONDS",
            30.0,
            minimum=5.0,
        ),

        max_events_per_tick=_env_int(
            "SENTINEL_SIM_MAX_EVENTS_PER_TICK",
            100,
            minimum=1,
        ),

        max_events_per_employee_per_tick=_env_int(
            "SENTINEL_SIM_MAX_EVENTS_PER_EMPLOYEE_PER_TICK",
            3,
            minimum=1,
        ),

        attack_rate_per_simulated_hour=(
            attack_rate
        ),

        scenario_cooldown_minutes=(
            scenario_cooldown
        ),

        max_concurrent_attack_episodes=_env_int(
            "SENTINEL_SIM_MAX_CONCURRENT_ATTACKS",
            1,
            minimum=1,
        ),

        initial_simulated_hour=(
            initial_hour
        ),
    )