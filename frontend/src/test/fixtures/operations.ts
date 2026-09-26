import type {
  OperationsStatus,
  ProcessorRuntimeStatus,
  SimulationRuntimeStatus,
} from "../../types/api";


export function makeProcessorRuntimeStatus(
  overrides:
    Partial<ProcessorRuntimeStatus> = {},
): ProcessorRuntimeStatus {
  return {
    service:
      "event-processor",

    operational:
      true,

    health:
      "HEALTHY",

    status:
      "running",

    processor_name:
      "sentinel-event-processor",

    worker_id:
      "processor-001",

    worker_version:
      "1.0",

    activated_at:
      "2026-09-23T08:00:00Z",

    last_heartbeat_at:
      "2026-09-23T09:30:00Z",

    heartbeat_age_seconds:
      2,

    stopped_at:
      null,

    detector: {
      name:
        "isolation-forest",

      version:
        "1.2",
    },

    counters: {
      events_processed:
        12_612,

      scores_created:
        12_612,

      incidents_created:
        26,

      incidents_updated:
        41,

      live_backlog:
        0,
    },

    last_error:
      null,

    ...overrides,
  };
}


export function makeSimulationRuntimeStatus(
  overrides:
    Partial<SimulationRuntimeStatus> = {},
): SimulationRuntimeStatus {
  return {
    service:
      "simulator",

    running:
      false,

    health:
      "STOPPED",

    status:
      "stopped",

    has_run_history:
      true,

    run_id:
      "SIM-RUN-001",

    mode:
      "continuous",

    worker_id:
      "simulator-001",

    worker_version:
      "1.0",

    seed:
      42,

    started_at:
      "2026-09-23T08:00:00Z",

    stopped_at:
      "2026-09-23T09:00:00Z",

    last_heartbeat_at:
      "2026-09-23T09:00:00Z",

    heartbeat_age_seconds:
      1800,

    clock: {
      real_runtime_seconds:
        3600,

      simulated_runtime_seconds:
        21_600,

      simulated_hours_elapsed:
        6,

      simulation_minutes_per_real_second:
        0.1,

      speed_multiplier:
        6,

      simulated_now:
        "2026-09-23T14:00:00Z",

      simulated_start_time:
        "2026-09-23T08:00:00Z",
    },

    configuration: {
      preset:
        "enterprise",

      heartbeat_seconds:
        5,

      attack_campaign_rate_per_simulated_hour:
        0.5,

      simulation_minutes_per_real_second:
        0.1,

      max_events_per_tick:
        100,

      max_events_per_employee_per_tick:
        5,

      scenario_cooldown_minutes:
        30,

      max_concurrent_attacks:
        3,
    },

    metrics: {
      employees_loaded:
        300,

      active_employees:
        284,

      events_generated:
        13_066,

      event_throughput_per_real_minute:
        217.8,

      incidents_observed:
        26,

      incident_rate_per_real_hour:
        26,

      incident_rate_per_simulated_hour:
        4.33,
    },

    last_error:
      null,

    ...overrides,
  };
}


export function makeOperationsStatus(
  overrides:
    Partial<OperationsStatus> = {},
): OperationsStatus {
  return {
    generated_at:
      "2026-09-23T09:30:02Z",

    sentinel:
      makeProcessorRuntimeStatus(),

    simulation:
      makeSimulationRuntimeStatus(),

    ...overrides,
  };
}
