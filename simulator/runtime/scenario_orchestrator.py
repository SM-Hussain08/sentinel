"""
Live attack-scenario orchestration for SENTINEL.

This module decides:

- whether automatic attack injection is enabled;
- when the next simulated attack begins;
- which scenario family is used;
- which employee becomes the affected identity.

It does NOT:

- score anomalies;
- create incidents;
- decide whether SENTINEL detected anything.

Those responsibilities belong to SENTINEL's independent processing
pipeline.

Automatic attack arrivals use an exponential inter-arrival model.

SENTINEL_SIM_ATTACK_RATE represents the expected number of attack
campaigns per simulated hour.

A rate of zero completely disables automatic attack injection.
"""

from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
)
import math
import random
from uuid import UUID

from app.models import Employee

from app.services.simulation_runtime import (
    generate_scenario_instance_id,
)

from simulator.runtime.config import (
    LiveSimulationConfig,
)

from simulator.runtime.state import (
    LiveRuntimeState,
    ScenarioEpisode,
)

from simulator.scenarios import (
    AccountTakeoverScenario,
    BruteForceScenario,
    DataExfiltrationScenario,
    InsiderThreatScenario,
    NetworkScanScenario,
)


# ============================================================
# Scenario registry
# ============================================================

SCENARIO_FACTORIES = {
    "BRUTE_FORCE": BruteForceScenario,
    "ACCOUNT_TAKEOVER": AccountTakeoverScenario,
    "DATA_EXFILTRATION": DataExfiltrationScenario,
    "INSIDER_THREAT": InsiderThreatScenario,
    "NETWORK_SCAN": NetworkScanScenario,
}


SCENARIO_WEIGHTS = {
    "BRUTE_FORCE": 0.24,
    "ACCOUNT_TAKEOVER": 0.22,
    "DATA_EXFILTRATION": 0.18,
    "INSIDER_THREAT": 0.14,
    "NETWORK_SCAN": 0.22,
}


# ============================================================
# Attack stages
# ============================================================

def build_attack_stages(
    *,
    scenario_type: str,
    event_count: int,
) -> list[str]:
    """
    Build simulator-private attack-stage labels.

    These labels are never written to the observable Event record.
    """

    if event_count <= 0:
        return []

    if scenario_type == "BRUTE_FORCE":
        return [
            "CREDENTIAL_ACCESS"
            for _ in range(
                event_count
            )
        ]

    if scenario_type == "ACCOUNT_TAKEOVER":
        stages = [
            "CREDENTIAL_ACCESS",
            "CREDENTIAL_ACCESS",
            "CREDENTIAL_ACCESS",
            "CREDENTIAL_ACCESS",
            "CREDENTIAL_ACCESS",
            "INITIAL_ACCESS",
            "DISCOVERY",
            "COLLECTION",
        ]

        return stages[
            :event_count
        ]

    if scenario_type == "DATA_EXFILTRATION":
        stages = [
            "COLLECTION"
            for _ in range(
                max(
                    event_count - 1,
                    0,
                )
            )
        ]

        stages.append(
            "EXFILTRATION"
        )

        return stages[
            :event_count
        ]

    if scenario_type == "INSIDER_THREAT":
        stages = [
            "VALID_ACCESS"
        ]

        if event_count > 2:
            stages.extend(
                [
                    "COLLECTION"
                    for _ in range(
                        event_count - 2
                    )
                ]
            )

        if event_count > 1:
            stages.append(
                "STAGING"
            )

        return stages[
            :event_count
        ]

    if scenario_type == "NETWORK_SCAN":
        return [
            "DISCOVERY"
            for _ in range(
                event_count
            )
        ]

    return [
        "UNKNOWN"
        for _ in range(
            event_count
        )
    ]


# ============================================================
# Orchestrator
# ============================================================

class LiveScenarioOrchestrator:
    """
    Schedule optional multi-event attack campaigns.

    Arrival frequency is controlled by:

        config.attack_rate_per_simulated_hour

    A value of zero means normal-only simulation.
    """

    def __init__(
        self,
        *,
        config: LiveSimulationConfig,
        seed: int,
    ) -> None:
        self.config = config

        # Attack randomness remains independent from normal employee
        # behavior so changing employee simulation does not silently
        # alter attack scheduling for a fixed seed.
        self.random = random.Random(  # nosec B311
            seed
        )

    # ========================================================
    # Attack timing
    # ========================================================

    def schedule_next_attack(
        self,
        *,
        runtime_state: LiveRuntimeState,
        after: datetime,
    ) -> datetime | None:
        """
        Schedule the next automatic attack using an exponential
        inter-arrival distribution.

        attack_rate_per_simulated_hour is interpreted as the expected
        number of campaigns per simulated hour.

        Examples:
            0.25 -> mean interval approximately 240 minutes
            1.0  -> mean interval approximately 60 minutes
            2.0  -> mean interval approximately 30 minutes

        A rate of zero disables automatic attacks.
        """

        attack_rate = (
            self.config
            .attack_rate_per_simulated_hour
        )

        if attack_rate <= 0.0:
            runtime_state.next_attack_at = (
                None
            )

            return None

        # Convert campaigns/hour to campaigns/minute.
        rate_per_minute = (
            attack_rate
            / 60.0
        )

        sampled_delay = (
            self.random.expovariate(
                rate_per_minute
            )
        )

        # Avoid effectively instantaneous campaigns while preserving the
        # stochastic arrival model.
        delay_minutes = max(
            1,
            math.ceil(
                sampled_delay
            ),
        )

        next_attack = (
            after
            + timedelta(
                minutes=delay_minutes
            )
        )

        runtime_state.next_attack_at = (
            next_attack
        )

        return next_attack

    def attack_is_due(
        self,
        *,
        runtime_state: LiveRuntimeState,
    ) -> bool:
        """
        Return True only when an enabled attack is scheduled and due.
        """

        if not self.config.attacks_enabled:
            return False

        if runtime_state.next_attack_at is None:
            return False

        if (
            runtime_state.active_scenario_count()
            >= self.config.max_concurrent_attack_episodes
        ):
            return False

        return (
            runtime_state.simulated_now
            >= runtime_state.next_attack_at
        )

    # ========================================================
    # Scenario selection
    # ========================================================

    def available_scenario_types(
        self,
        *,
        runtime_state: LiveRuntimeState,
    ) -> list[str]:
        """
        Return scenario families not currently under cooldown.
        """

        available: list[str] = []

        for scenario_type in SCENARIO_FACTORIES:
            last_started = (
                runtime_state
                .scenario_last_started_at
                .get(
                    scenario_type
                )
            )

            if last_started is None:
                available.append(
                    scenario_type
                )

                continue

            cooldown_until = (
                last_started
                + timedelta(
                    minutes=(
                        self.config
                        .scenario_cooldown_minutes
                    )
                )
            )

            if (
                runtime_state.simulated_now
                >= cooldown_until
            ):
                available.append(
                    scenario_type
                )

        return available

    def choose_scenario_type(
        self,
        *,
        runtime_state: LiveRuntimeState,
    ) -> str | None:
        """
        Choose one eligible scenario family using configured weights.
        """

        available = (
            self.available_scenario_types(
                runtime_state=runtime_state,
            )
        )

        if not available:
            return None

        weights = [
            SCENARIO_WEIGHTS[
                scenario_type
            ]
            for scenario_type
            in available
        ]

        return self.random.choices(
            available,
            weights=weights,
            k=1,
        )[0]

    # ========================================================
    # Victim/source selection
    # ========================================================

    def _employees_already_in_attack(
        self,
        runtime_state: LiveRuntimeState,
    ) -> set[UUID]:
        """
        Prevent one identity from simultaneously belonging to multiple
        active attack episodes.
        """

        return {
            episode.employee_id
            for episode
            in runtime_state.active_scenarios
            if not episode.is_complete
        }

    def choose_employee(
        self,
        *,
        scenario_type: str,
        employees: list[Employee],
        runtime_state: LiveRuntimeState,
    ) -> Employee | None:
        """
        Choose a plausible employee for the attack scenario.

        Compromised-endpoint and insider scenarios preferentially use an
        employee with an active session.

        Authentication attacks may target any active corporate identity.
        """

        busy_ids = (
            self._employees_already_in_attack(
                runtime_state
            )
        )

        eligible = [
            employee
            for employee
            in employees
            if (
                employee.is_active
                and employee.id
                not in busy_ids
            )
        ]

        if not eligible:
            return None

        logged_in = [
            employee
            for employee
            in eligible
            if (
                runtime_state.employees.get(
                    employee.id
                )
                is not None
                and runtime_state.employees[
                    employee.id
                ].is_logged_in
            )
        ]

        scenario_prefers_active_session = (
            scenario_type
            in {
                "DATA_EXFILTRATION",
                "INSIDER_THREAT",
                "NETWORK_SCAN",
            }
        )

        if (
            scenario_prefers_active_session
            and logged_in
        ):
            eligible = logged_in

        elif (
            scenario_type
            == "ACCOUNT_TAKEOVER"
            and logged_in
            and self.random.random() < 0.70
        ):
            eligible = logged_in

        return self.random.choice(
            eligible
        )

    # ========================================================
    # Episode construction
    # ========================================================

    def start_episode(
        self,
        *,
        scenario_type: str,
        employee: Employee,
        runtime_state: LiveRuntimeState,
    ) -> ScenarioEpisode:
        """
        Construct one attack campaign.

        No events are persisted here.
        """

        scenario_factory = (
            SCENARIO_FACTORIES.get(
                scenario_type
            )
        )

        if scenario_factory is None:
            raise ValueError(
                (
                    "Unknown scenario type: "
                    f"{scenario_type}"
                )
            )

        scenario = (
            scenario_factory()
        )

        scheduled_events = (
            scenario.generate(
                employee=employee,
                start_time=(
                    runtime_state
                    .simulated_now
                ),
            )
        )

        if not scheduled_events:
            raise RuntimeError(
                (
                    f"{scenario_type} "
                    "generated no events."
                )
            )

        scheduled_events = sorted(
            scheduled_events,
            key=lambda event: (
                event.timestamp
            ),
        )

        attack_stages = (
            build_attack_stages(
                scenario_type=scenario_type,
                event_count=len(
                    scheduled_events
                ),
            )
        )

        if (
            len(
                attack_stages
            )
            != len(
                scheduled_events
            )
        ):
            raise RuntimeError(
                (
                    "Scenario stage metadata does not "
                    "match generated event count."
                )
            )

        episode = ScenarioEpisode(
            scenario_instance_id=(
                generate_scenario_instance_id(
                    scenario_type
                )
            ),
            scenario_type=scenario_type,
            employee_id=employee.id,
            employee_user_id=(
                employee.user_id
            ),
            started_at=(
                runtime_state
                .simulated_now
            ),
            scheduled_events=(
                scheduled_events
            ),
            attack_stages=(
                attack_stages
            ),
            metadata={
                "victim_department": (
                    employee.department
                ),
                "victim_job_role": (
                    employee.job_role
                ),
                "automatic": True,
                "attack_rate_per_simulated_hour": (
                    self.config
                    .attack_rate_per_simulated_hour
                ),
            },
        )

        runtime_state.active_scenarios.append(
            episode
        )

        runtime_state.scenario_last_started_at[
            scenario_type
        ] = (
            runtime_state
            .simulated_now
        )

        self.schedule_next_attack(
            runtime_state=runtime_state,
            after=(
                runtime_state
                .simulated_now
            ),
        )

        return episode

    def maybe_start_episode(
        self,
        *,
        employees: list[Employee],
        runtime_state: LiveRuntimeState,
    ) -> ScenarioEpisode | None:
        """
        Start an automatic attack when its stochastic arrival time is due.

        A zero attack rate exits immediately and creates no attack
        scenarios.
        """

        if not self.config.attacks_enabled:
            runtime_state.next_attack_at = (
                None
            )

            return None

        if runtime_state.next_attack_at is None:
            self.schedule_next_attack(
                runtime_state=runtime_state,
                after=(
                    runtime_state
                    .simulated_now
                ),
            )

            return None

        if not self.attack_is_due(
            runtime_state=runtime_state,
        ):
            return None

        scenario_type = (
            self.choose_scenario_type(
                runtime_state=runtime_state,
            )
        )

        if scenario_type is None:
            # Every scenario family is cooling down.
            # Retry later without discarding future attack injection.
            runtime_state.next_attack_at = (
                runtime_state.simulated_now
                + timedelta(
                    minutes=15
                )
            )

            return None

        employee = self.choose_employee(
            scenario_type=scenario_type,
            employees=employees,
            runtime_state=runtime_state,
        )

        if employee is None:
            runtime_state.next_attack_at = (
                runtime_state.simulated_now
                + timedelta(
                    minutes=10
                )
            )

            return None

        return self.start_episode(
            scenario_type=scenario_type,
            employee=employee,
            runtime_state=runtime_state,
        )