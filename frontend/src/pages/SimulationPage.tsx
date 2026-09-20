import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getOperationsStatus,
} from "../services/api";

import type {
  OperationsStatus,
  RuntimeHealthState,
} from "../types/api";

import {
  formatCount,
  formatHeartbeatAge,
  formatPreset,
  formatRate,
  formatRefreshAge,
  formatRuntimeDuration,
  formatSimulatedDuration,
  formatSpeed,
  formatTimestamp,
} from "../components/simulation/simulationFormatters";


const AUTO_REFRESH_MS =
  10_000;


const SECURITY_SCENARIOS = [
  {
    name: "Brute Force",
    code: "BF",
    description:
      "Repeated authentication attempts model credential-guessing activity.",
  },

  {
    name: "Account Takeover",
    code: "AT",
    description:
      "Compromised access is followed by suspicious post-authentication behavior.",
  },

  {
    name: "Data Exfiltration",
    code: "DX",
    description:
      "Unusual file access and transfer patterns model attempted data removal.",
  },

  {
    name: "Insider Threat",
    code: "IT",
    description:
      "Atypical employee activity models misuse originating from a trusted identity.",
  },

  {
    name: "Network Scan",
    code: "NS",
    description:
      "Repeated network connections model discovery activity across enterprise hosts.",
  },
] as const;


const ENVIRONMENT_CAPABILITIES = [
  {
    code: "ID",
    title: "Employee Activity",
    description:
      "Role and department-aware behavioral activity across the synthetic workforce.",
  },

  {
    code: "AU",
    title: "Authentication",
    description:
      "Login success, failure, logout, and session-oriented employee activity.",
  },

  {
    code: "FI",
    title: "File Activity",
    description:
      "Synthetic file access, download, upload, and transfer behavior.",
  },

  {
    code: "NW",
    title: "Network Activity",
    description:
      "Enterprise-style network connections between employee and infrastructure contexts.",
  },

  {
    code: "DB",
    title: "Database Activity",
    description:
      "Realistic employee database-access events derived from behavioral profiles.",
  },

  {
    code: "TM",
    title: "Temporal Behavior",
    description:
      "Working-hour patterns and natural timing variation across simulated employees.",
  },
] as const;


function healthPresentation(
  health:
    RuntimeHealthState,
  operational = false,
) {
  if (
    health === "HEALTHY"
    && operational
  ) {
    return {
      dot:
        "bg-emerald-400 shadow-[0_0_13px_rgba(52,211,153,0.9)]",
      border:
        "border-emerald-800/40",
      text:
        "text-emerald-300",
      background:
        "bg-emerald-950/25",
    };
  }

  if (
    health === "ERROR"
  ) {
    return {
      dot:
        "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.65)]",
      border:
        "border-rose-900/50",
      text:
        "text-rose-300",
      background:
        "bg-rose-950/20",
    };
  }

  if (
    health === "STALE"
  ) {
    return {
      dot:
        "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]",
      border:
        "border-amber-900/50",
      text:
        "text-amber-300",
      background:
        "bg-amber-950/20",
    };
  }

  return {
    dot:
      "bg-slate-500",
    border:
      "border-slate-700/70",
    text:
      "text-slate-400",
    background:
      "bg-slate-950/40",
  };
}


function simulatorPresentation(
  running: boolean,
  health:
    RuntimeHealthState,
) {
  if (
    running
    && health === "HEALTHY"
  ) {
    return {
      status:
        "Simulator Online",
      supporting:
        "Synthetic enterprise activity is currently being generated.",
      label:
        "Live Run",
      dot:
        "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]",
      title:
        "text-emerald-300",
      border:
        "border-emerald-900/55",
      glow:
        "bg-emerald-400/[0.04]",
      panel:
        "bg-[#101826]/90",
      rail:
        "bg-emerald-400/55",
      badge:
        "border-emerald-800/45 bg-emerald-950/30 text-emerald-300",
    };
  }

  if (
    health === "ERROR"
  ) {
    return {
      status:
        "Simulator Error",
      supporting:
        "The latest simulator runtime reported an operational failure.",
      label:
        "Attention",
      dot:
        "bg-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.7)]",
      title:
        "text-rose-300",
      border:
        "border-rose-900/55",
      glow:
        "bg-rose-400/[0.03]",
      panel:
        "bg-[#101826]/90",
      rail:
        "bg-rose-400/50",
      badge:
        "border-rose-900/50 bg-rose-950/25 text-rose-300",
    };
  }

  if (
    health === "STALE"
  ) {
    return {
      status:
        "Simulator Stale",
      supporting:
        "The simulator heartbeat is older than the expected runtime window.",
      label:
        "Heartbeat Delayed",
      dot:
        "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.65)]",
      title:
        "text-amber-300",
      border:
        "border-amber-900/50",
      glow:
        "bg-amber-400/[0.025]",
      panel:
        "bg-[#101826]/90",
      rail:
        "bg-amber-400/45",
      badge:
        "border-amber-900/45 bg-amber-950/20 text-amber-300",
    };
  }

  return {
    status:
      "Simulator Offline",
    supporting:
      "No live synthetic enterprise activity is currently being generated.",
    label:
      "Last Run",
    dot:
      "bg-slate-500",
    title:
      "text-slate-300",
    border:
      "border-slate-800",
    glow:
      "bg-slate-400/[0.015]",
    panel:
      "bg-[#0b111c]",
    rail:
      "bg-slate-600/45",
    badge:
      "border-slate-700 bg-slate-950/35 text-slate-400",
  };
}


interface MetricCardProps {
  eyebrow: string;
  value: string;
  detail: string;
}


function MetricCard({
  eyebrow,
  value,
  detail,
}: MetricCardProps) {
  return (
    <article
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
        p-5
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-slate-600/70
        hover:bg-[#121c2b]
        hover:shadow-[0_18px_40px_rgba(0,0,0,0.16)]
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-cyan-400/0
          to-transparent
          transition-all
          duration-300
          group-hover:via-cyan-400/35
        "
      />

      <p
        className="
          text-[10px]
          font-semibold
          uppercase
          tracking-[0.15em]
          text-slate-500
        "
      >
        {eyebrow}
      </p>

      <p
        className="
          mt-3
          text-2xl
          font-semibold
          tracking-[-0.025em]
          text-white
        "
      >
        {value}
      </p>

      <p
        className="
          mt-2
          text-[11px]
          leading-5
          text-slate-500
        "
      >
        {detail}
      </p>
    </article>
  );
}


interface SpecificationRowProps {
  label: string;
  value: string;
  detail?: string;
}


function SpecificationRow({
  label,
  value,
  detail,
}: SpecificationRowProps) {
  return (
    <div
      className="
        group
        flex
        flex-col
        gap-2
        border-b
        border-slate-700/45
        py-4
        transition-colors
        last:border-b-0
        sm:flex-row
        sm:items-center
        sm:justify-between
        sm:gap-6
      "
    >
      <div>
        <p
          className="
            text-xs
            font-medium
            text-slate-400
            transition-colors
            group-hover:text-slate-200
          "
        >
          {label}
        </p>

        {detail && (
          <p
            className="
              mt-1
              max-w-xl
              text-[10px]
              leading-4
              text-slate-600
            "
          >
            {detail}
          </p>
        )}
      </div>

      <p
        className="
          shrink-0
          font-mono
          text-xs
          text-slate-100
        "
      >
        {value}
      </p>
    </div>
  );
}


function SimulationPage() {
  const [
    operations,
    setOperations,
  ] = useState<
    OperationsStatus
    | null
  >(null);

  const [
    initialLoading,
    setInitialLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    refreshError,
    setRefreshError,
  ] = useState<
    string
    | null
  >(null);

  const [
    lastRefreshedAt,
    setLastRefreshedAt,
  ] = useState<
    number
    | null
  >(null);

    const [
        nowMs,
        setNowMs,
    ] = useState(0);


    const loadOperations =
        useCallback(
        async () => {
            setRefreshing(
            true,
            );

            try {
            const response =
                await getOperationsStatus();

            setOperations(
                response,
            );

            setLastRefreshedAt(
                Date.now(),
            );

            setRefreshError(
                null,
            );
            } catch {
            setRefreshError(
                "Runtime telemetry could not be refreshed.",
            );
            } finally {
            setRefreshing(
                false,
            );
            }
        },
        [],
        );


    useEffect(
        () => {
        let cancelled =
            false;


        async function loadInitialOperations() {
            try {
            const response =
                await getOperationsStatus();

            if (cancelled) {
                return;
            }

            setOperations(
                response,
            );

            setLastRefreshedAt(
                Date.now(),
            );

            setRefreshError(
                null,
            );
            } catch {
            if (cancelled) {
                return;
            }

            setRefreshError(
                "Runtime telemetry could not be loaded.",
            );
            } finally {
            if (!cancelled) {
                setInitialLoading(
                false,
                );
            }
            }
        }


        void loadInitialOperations();


        return () => {
            cancelled =
            true;
        };
        },
        [],
    );

    useEffect(
        () => {
        const interval =
            window.setInterval(
            () => {
                void loadOperations();
            },
            AUTO_REFRESH_MS,
            );


        return () => {
            window.clearInterval(
            interval,
            );
        };
        },
        [
        loadOperations,
        ],
    );

  useEffect(
    () => {
      const interval =
        window.setInterval(
          () => {
            setNowMs(
              Date.now(),
            );
          },
          1_000,
        );

      return () => {
        window.clearInterval(
          interval,
        );
      };
    },
    [],
  );


  const sentinel =
    operations?.sentinel
    ?? null;

  const simulation =
    operations?.simulation
    ?? null;

  const metrics =
    simulation?.metrics
    ?? null;

  const clock =
    simulation?.clock
    ?? null;

  const configuration =
    simulation?.configuration
    ?? null;


  const sentinelVisual =
    useMemo(
      () =>
        healthPresentation(
          sentinel?.health
          ?? "UNKNOWN",
          sentinel?.operational
          ?? false,
        ),
      [
        sentinel?.health,
        sentinel?.operational,
      ],
    );


  const simulatorVisual =
    useMemo(
      () =>
        simulatorPresentation(
          simulation?.running
          ?? false,
          simulation?.health
          ?? "UNKNOWN",
        ),
      [
        simulation?.health,
        simulation?.running,
      ],
    );


  const sentinelLabel =
    sentinel?.operational
      ? "SENTINEL Operational"
      : (
        `SENTINEL ${
          sentinel?.health
          ?? "Unknown"
        }`
      );


  return (
    <main
      className="
        mx-auto
        w-full
        max-w-[1600px]
        px-5
        pb-20
        pt-6
        sm:px-7
        lg:px-10
      "
    >
      {/* =====================================================
          HEADER
      ====================================================== */}
      <section>
        {/* Upper line */}
        <div
          className="
            flex
            items-center
            justify-between
            gap-5
          "
        >
          <div
            className="
              flex
              items-center
              gap-2.5
            "
          >
            <span
              className="
                h-2
                w-2
                rounded-full
                bg-cyan-400
                shadow-[0_0_14px_rgba(34,211,238,0.8)]
              "
            />

            <p
              className="
                text-[11px]
                font-semibold
                uppercase
                tracking-[0.22em]
                text-cyan-400
              "
            >
              Simulation Environment
            </p>
          </div>

          {/* Live SENTINEL processor status */}
          <div
            title={
              sentinel?.last_heartbeat_at
                ? (
                  `Processor heartbeat ${
                    formatHeartbeatAge(
                      sentinel
                        .last_heartbeat_at,
                      nowMs,
                    )
                  }`
                )
                : (
                  "Processor status unavailable"
                )
            }
            className={[
              "flex shrink-0",
              "items-center gap-2.5",
              "rounded-xl border",
              "px-3.5 py-2.5",
              "shadow-[0_10px_30px_rgba(0,0,0,0.16)]",
              sentinelVisual.border,
              sentinelVisual.background,
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2",
                "rounded-full",
                sentinel?.operational
                  ? "animate-pulse"
                  : "",
                sentinelVisual.dot,
              ].join(" ")}
            />

            <span
              className={[
                "text-[10px]",
                "font-semibold uppercase",
                "tracking-[0.12em]",
                sentinelVisual.text,
              ].join(" ")}
            >
              {sentinelLabel}
            </span>
          </div>
        </div>


        {/* Title + refresh controls */}
        <div
          className="
            mt-5
            flex
            flex-col
            gap-6
            xl:flex-row
            xl:items-end
            xl:justify-between
          "
        >
          <div
            className="
              min-w-0
              max-w-[980px]
            "
          >
            <h1
              className="
                text-3xl
                font-semibold
                tracking-[-0.035em]
                text-white
                sm:text-4xl
              "
            >
              Synthetic Enterprise Simulator
            </h1>

            <p
              className="
                mt-3
                max-w-[980px]
                text-sm
                leading-7
                text-slate-500
                sm:text-[15px]
              "
            >
              Observe SENTINEL&apos;s optional synthetic corporate
              environment used for demonstrations, repeatable testing,
              and realistic enterprise security activity generation.
            </p>
          </div>


          <div
            className="
              flex
              shrink-0
              flex-wrap
              items-center
              gap-2.5
              xl:pb-1
            "
          >
            {/* Refresh age */}
            <div
              className="
                flex
                h-11
                items-center
                gap-2.5
                rounded-xl
                border
                border-slate-800
                bg-[#0a1019]/90
                px-4
              "
            >
              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-emerald-400
                  shadow-[0_0_9px_rgba(52,211,153,0.6)]
                "
              />

              <span
                className="
                  text-[11px]
                  font-medium
                  text-slate-500
                "
              >
                {
                  formatRefreshAge(
                    lastRefreshedAt,
                    nowMs,
                  )
                }
              </span>
            </div>


            {/* Manual refresh */}
            <button
              type="button"
              disabled={
                refreshing
              }
              onClick={() => {
                void loadOperations();
                }}
              className="
                group
                flex
                h-11
                items-center
                gap-2.5
                rounded-xl
                border
                border-slate-700
                bg-[#101722]
                px-4
                text-[11px]
                font-semibold
                text-slate-300
                shadow-[0_10px_30px_rgba(0,0,0,0.16)]
                transition-all
                duration-200
                hover:border-cyan-800/70
                hover:bg-cyan-950/20
                hover:text-cyan-200
                disabled:cursor-wait
                disabled:opacity-60
              "
            >
              <span
                className={[
                  "inline-block",
                  "text-sm",
                  "transition-transform",
                  "duration-300",
                  refreshing
                    ? "animate-spin"
                    : (
                      "group-hover:"
                      + "rotate-180"
                    ),
                ].join(" ")}
              >
                ↻
              </span>

              {refreshing
                ? "Refreshing"
                : "Refresh Runtime"}
            </button>
          </div>
        </div>


        {/* Runtime strip */}
        <div
          className="
            mt-6
            flex
            flex-col
            gap-3
            rounded-2xl
            border
            border-slate-800/90
            bg-[#09111a]/70
            px-5
            py-4
            shadow-[inset_0_1px_0_rgba(255,255,255,0.015)]
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p
            className="
              text-[11px]
              leading-5
              text-slate-600
            "
          >
            Simulator runtime telemetry refreshes silently every
            10 seconds.
          </p>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-cyan-400
                shadow-[0_0_9px_rgba(34,211,238,0.65)]
              "
            />

            <span
              className="
                text-[10px]
                font-medium
                uppercase
                tracking-[0.14em]
                text-cyan-400
              "
            >
              Live Runtime
            </span>
          </div>
        </div>


        {refreshError && (
          <div
            className="
              mt-3
              rounded-xl
              border
              border-amber-900/40
              bg-amber-950/10
              px-4
              py-3
              text-[11px]
              text-amber-300
            "
          >
            {refreshError}
            {" "}
            Existing telemetry remains visible while SENTINEL
            retries automatically.
          </div>
        )}
      </section>


      {/* =====================================================
          INITIAL LOADING
      ====================================================== */}
      {initialLoading
        && !operations ? (
        <section
          className="
            mt-5
            rounded-2xl
            border
            border-slate-800/80
            bg-[#090f18]/75
            p-8
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <span
              className="
                h-2
                w-2
                animate-pulse
                rounded-full
                bg-cyan-400
              "
            />

            <p
              className="
                text-xs
                uppercase
                tracking-[0.14em]
                text-slate-500
              "
            >
              Loading runtime telemetry
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* =================================================
              SIMULATOR RUNTIME HERO
          ================================================== */}
          <section
            className={[
              "group relative mt-4",
              "overflow-hidden",
              "rounded-2xl border",
              "p-6 sm:p-7",
              "shadow-[0_16px_45px_rgba(0,0,0,0.14)]",
              "transition-all duration-300",
              "hover:shadow-[0_22px_60px_rgba(6,182,212,0.06)]",
              simulatorVisual.border,
              simulatorVisual.panel,
            ].join(" ")}
          >
            <span
              className={[
                "absolute",
                "bottom-5",
                "left-0",
                "top-5",
                "w-[3px]",
                "rounded-r-full",
                simulatorVisual.rail,
              ].join(" ")}
            />

            <div
              className={[
                "pointer-events-none",
                "absolute",
                "-right-28",
                "-top-32",
                "h-96",
                "w-96",
                "rounded-full",
                "blur-[110px]",
                simulatorVisual.glow,
                simulation?.running
                  ? "animate-pulse"
                  : "",
              ].join(" ")}
            />

            <div
              className="
                relative
              "
            >
              <div
                className="
                  flex
                  flex-col
                  gap-5
                  sm:flex-row
                  sm:items-start
                  sm:justify-between
                "
              >
                <div>
                  <div
                    className="
                      flex
                      items-center
                      gap-3
                    "
                  >
                    <span
                      className={[
                        "h-2.5 w-2.5",
                        "rounded-full",
                        simulation?.running
                          ? "animate-pulse"
                          : "",
                        simulatorVisual.dot,
                      ].join(" ")}
                    />

                    <p
                      className={[
                        "text-xs",
                        "font-semibold uppercase",
                        "tracking-[0.14em]",
                        simulatorVisual.title,
                      ].join(" ")}
                    >
                      {
                        simulatorVisual
                          .status
                      }
                    </p>
                  </div>

                  <p
                    className="
                      mt-3
                      text-sm
                      leading-6
                      text-slate-500
                    "
                  >
                    {
                      simulatorVisual
                        .supporting
                    }
                  </p>
                </div>

                <span
                  className={[
                    "w-fit",
                    "rounded-lg",
                    "border",
                    "px-3",
                    "py-2",
                    "text-[9px]",
                    "font-semibold",
                    "uppercase",
                    "tracking-[0.14em]",
                    simulatorVisual.badge,
                  ].join(" ")}
                >
                  {
                    simulatorVisual
                      .label
                  }
                </span>
              </div>


              <div
                className="
                  mt-7
                  grid
                  gap-px
                  overflow-hidden
                  rounded-xl
                  border
                  border-slate-800
                  bg-slate-800/50
                  sm:grid-cols-2
                  xl:grid-cols-4
                "
              >
                {[
                  [
                    "Run ID",
                    simulation?.run_id
                      ?? "No run history",
                  ],

                  [
                    "Last Heartbeat",
                    formatHeartbeatAge(
                      simulation
                        ?.last_heartbeat_at,
                      nowMs,
                    ),
                  ],

                  [
                    "Real Runtime",
                    formatRuntimeDuration(
                      clock
                        ?.real_runtime_seconds,
                    ),
                  ],

                  [
                    "Simulated Duration",
                    formatSimulatedDuration(
                      clock
                        ?.simulated_runtime_seconds,
                    ),
                  ],

                  [
                    "Simulation Speed",
                    formatSpeed(
                      clock
                        ?.speed_multiplier,
                    ),
                  ],

                  [
                    "Preset",
                    formatPreset(
                      configuration
                        ?.preset,
                    ),
                  ],

                  [
                    "Seed",
                    simulation?.seed
                      ?.toLocaleString()
                      ?? "—",
                  ],

                  [
                    "Employees Loaded",
                    formatCount(
                      metrics
                        ?.employees_loaded,
                    ),
                  ],
                ].map(
                  ([
                    label,
                    value,
                  ]) => (
                    <div
                      key={label}
                      className={[
                        "px-5",
                        "py-4",
                        "transition-all",
                        "duration-200",
                        simulation?.running
                          ? (
                            "bg-[#0b111c] "
                            + "hover:bg-[#0e1724]"
                          )
                          : (
                            "bg-[#0b111c]/85 "
                            + "hover:bg-[#0e1724]"
                          ),
                      ].join(" ")}
                    >
                      <p
                        className="
                          text-[9px]
                          font-semibold
                          uppercase
                          tracking-[0.13em]
                          text-slate-700
                        "
                      >
                        {label}
                      </p>

                      <p
                        className="
                          mt-2
                          truncate
                          font-mono
                          text-xs
                          text-slate-300
                        "
                        title={value}
                      >
                        {value}
                      </p>
                    </div>
                  ),
                )}
              </div>

              {!simulation
                ?.has_run_history && (
                <p
                  className="
                    mt-5
                    text-[11px]
                    leading-5
                    text-slate-600
                  "
                >
                  No simulator run has been recorded yet.
                  Start the optional simulator service externally
                  when a demonstration or test workload is needed.
                </p>
              )}
            </div>
          </section>


          {/* =================================================
              KPI GRID
          ================================================== */}
          <section
            className="
              mt-4
              grid
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <MetricCard
              eyebrow="Events Generated"
              value={
                formatCount(
                  metrics
                    ?.events_generated,
                )
              }
              detail={
                simulation?.running
                  ? (
                    "Generated during the current live simulation run."
                  )
                  : (
                    "Generated during the most recent simulation run."
                  )
              }
            />

            <MetricCard
              eyebrow="Active Employees"
              value={
                formatCount(
                  metrics
                    ?.active_employees,
                )
              }
              detail={
                simulation?.running
                  ? (
                    "Employees active in the latest simulation window."
                  )
                  : (
                    "Last observed active-employee count."
                  )
              }
            />

            <MetricCard
              eyebrow="Event Throughput"
              value={
                metrics
                  ?.event_throughput_per_real_minute
                === null
                || metrics
                  ?.event_throughput_per_real_minute
                === undefined
                  ? "—"
                  : (
                    `${
                      metrics
                        .event_throughput_per_real_minute
                        .toFixed(2)
                    } / min`
                  )
              }
              detail="Observable synthetic events generated per real minute."
            />

            <MetricCard
              eyebrow="Incidents Observed"
              value={
                formatCount(
                  metrics
                    ?.incidents_observed,
                )
              }
              detail="Incidents observed by SENTINEL during this simulation window."
            />
          </section>


          {/* =================================================
              INCIDENT PROFILE + CONFIGURATION
          ================================================== */}
          <section
            className="
              mt-4
              grid
              gap-5
              xl:grid-cols-[0.9fr_1.1fr]
            "
          >
            {/* Incident profile */}
            <article
              className="
                group
                relative
                overflow-hidden
                rounded-2xl
                border
                border-slate-700/55
                bg-[#101826]/90
                p-6
                shadow-[0_16px_45px_rgba(0,0,0,0.14)]
                transition-all
                duration-300
                hover:border-cyan-900/55
                hover:bg-[#121c2b]
              "
            >
              <span
                className="
                  absolute
                  bottom-5
                  left-0
                  top-5
                  w-[2px]
                  rounded-r-full
                  bg-cyan-400/65
                "
              />

              <div
                className="
                  pointer-events-none
                  absolute
                  right-[-100px]
                  top-[-100px]
                  h-56
                  w-56
                  rounded-full
                  bg-cyan-500/[0.025]
                  blur-[70px]
                "
              />

              <div
                className="
                  relative
                "
              >
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.17em]
                    text-cyan-400
                  "
                >
                  Simulation Profile
                </p>

                <h2
                  className="
                    mt-2
                    text-lg
                    font-semibold
                    text-white
                  "
                >
                  Incident Activity
                </h2>

                <p
                  className="
                    mt-2
                    max-w-xl
                    text-xs
                    leading-6
                    text-slate-600
                  "
                >
                  Compare the simulator&apos;s configured incident
                  generation rate with incidents actually observed
                  during the run.
                </p>


                <div
                  className="
                    mt-6
                    grid
                    gap-3
                    sm:grid-cols-2
                  "
                >
                  <div
                    className="
                      rounded-xl
                      border
                      border-cyan-900/40
                      bg-cyan-950/[0.08]
                      p-4
                      shadow-[0_8px_24px_rgba(0,0,0,0.12)]
                      transition-all
                      duration-200
                      hover:-translate-y-0.5
                      hover:border-cyan-800/55
                      hover:bg-cyan-950/[0.14]
                    "
                  >
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.13em]
                        text-slate-600
                      "
                    >
                      Configured Incident Rate
                    </p>

                    <p
                      className="
                        mt-2
                        text-xl
                        font-semibold
                        text-cyan-200
                      "
                    >
                      {
                        formatRate(
                          configuration
                            ?.attack_campaign_rate_per_simulated_hour,
                        )
                      }
                    </p>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        text-slate-700
                      "
                    >
                      per simulated hour
                    </p>
                  </div>


                  <div
                    className="
                      rounded-xl
                      border
                      border-slate-700/55
                      bg-[#0d1521]/90
                      p-4
                      shadow-[0_8px_24px_rgba(0,0,0,0.12)]
                      transition-all
                      duration-200
                      hover:-translate-y-0.5
                      hover:border-cyan-900/45
                      hover:bg-[#111c29]
                    "
                  >
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.13em]
                        text-slate-600
                      "
                    >
                      Observed Incident Rate
                    </p>

                    <p
                      className="
                        mt-2
                        text-xl
                        font-semibold
                        text-white
                      "
                    >
                      {
                        formatRate(
                          metrics
                            ?.incident_rate_per_simulated_hour,
                        )
                      }
                    </p>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        text-slate-700
                      "
                    >
                      per simulated hour
                    </p>
                  </div>
                </div>


                <div
                  className="
                    mt-5
                    rounded-xl
                    border
                    border-slate-700/50
                    bg-[#0b121d]/85
                    px-4
                    py-3.5
                  "
                >
                  <p
                    className="
                      text-[10px]
                      leading-5
                      text-slate-600
                    "
                  >
                    The configured rate controls how frequently the
                    simulator introduces security scenarios. The
                    observed rate represents incidents correlated
                    during the simulation window; it is not private
                    simulator ground truth.
                  </p>
                </div>


                <div
                  className="
                    mt-5
                    grid
                    gap-3
                    sm:grid-cols-2
                  "
                >
                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.12em]
                        text-slate-700
                      "
                    >
                      Incidents observed
                    </p>

                    <p
                      className="
                        mt-2
                        font-mono
                        text-sm
                        text-slate-300
                      "
                    >
                      {
                        formatCount(
                          metrics
                            ?.incidents_observed,
                        )
                      }
                    </p>
                  </div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.12em]
                        text-slate-700
                      "
                    >
                      Per real hour
                    </p>

                    <p
                      className="
                        mt-2
                        font-mono
                        text-sm
                        text-slate-300
                      "
                    >
                      {
                        formatRate(
                          metrics
                            ?.incident_rate_per_real_hour,
                        )
                      }
                    </p>
                  </div>
                </div>
              </div>
            </article>


            {/* Runtime configuration */}
            <article
              className="
                relative
                overflow-hidden
                rounded-2xl
                border
                border-slate-700/55
                bg-[#101826]/90
                p-6
                shadow-[0_16px_45px_rgba(0,0,0,0.14)]
              "
            >
              <span
                className="
                  absolute
                  bottom-5
                  left-0
                  top-5
                  w-[2px]
                  rounded-r-full
                  bg-indigo-400/55
                "
              />

              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.17em]
                  text-cyan-400
                "
              >
                Runtime Configuration
              </p>

              <h2
                className="
                  mt-2
                  text-lg
                  font-semibold
                  text-white
                "
              >
                Simulation Settings
              </h2>

              <div
                className="
                  mt-4
                "
              >
                <SpecificationRow
                  label="Preset"
                  value={
                    formatPreset(
                      configuration
                        ?.preset,
                    )
                  }
                />

                <SpecificationRow
                  label="Seed"
                  value={
                    simulation?.seed
                      ?.toLocaleString()
                    ?? "—"
                  }
                  detail="Enables repeatable simulator behavior when explicitly configured."
                />

                <SpecificationRow
                  label="Simulation Speed"
                  value={
                    formatSpeed(
                      clock
                        ?.speed_multiplier,
                    )
                  }
                />

                <SpecificationRow
                  label="Heartbeat Interval"
                  value={
                    configuration
                      ?.heartbeat_seconds
                    === null
                    || configuration
                      ?.heartbeat_seconds
                    === undefined
                      ? "—"
                      : (
                        `${configuration.heartbeat_seconds}s`
                      )
                  }
                />

                <SpecificationRow
                  label="Maximum Events / Tick"
                  value={
                    formatCount(
                      configuration
                        ?.max_events_per_tick,
                    )
                  }
                />

                <SpecificationRow
                  label="Employee Event Cap"
                  value={
                    formatCount(
                      configuration
                        ?.max_events_per_employee_per_tick,
                    )
                  }
                  detail="Maximum synthetic events generated for one employee in a single tick."
                />

                <SpecificationRow
                  label="Scenario Cooldown"
                  value={
                    configuration
                      ?.scenario_cooldown_minutes
                    === null
                    || configuration
                      ?.scenario_cooldown_minutes
                    === undefined
                      ? "—"
                      : (
                        `${
                          configuration
                            .scenario_cooldown_minutes
                        } min`
                      )
                  }
                />

                <SpecificationRow
                  label="Run Started"
                  value={
                    formatTimestamp(
                      simulation
                        ?.started_at,
                    )
                  }
                />
              </div>
            </article>
          </section>


          {/* =================================================
              ABOUT SYNTHETIC ENVIRONMENT
          ================================================== */}
          <section
            className="
              relative
              mt-4
              overflow-hidden
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-6
              shadow-[0_16px_45px_rgba(0,0,0,0.14)]
              sm:p-7
            "
          >
            <span
              className="
                absolute
                bottom-7
                left-0
                top-7
                w-[2px]
                rounded-r-full
                bg-gradient-to-b
                from-cyan-300
                to-indigo-500
                opacity-70
              "
            />

            <div
              className="
                max-w-3xl
              "
            >
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.17em]
                  text-cyan-400
                "
              >
                Synthetic Environment
              </p>

              <h2
                className="
                  mt-2
                  text-xl
                  font-semibold
                  text-white
                "
              >
                Realistic enterprise activity without production logs
              </h2>

              <p
                className="
                  mt-3
                  text-xs
                  leading-6
                  text-slate-500
                "
              >
                The optional simulator provides SENTINEL with a
                controlled corporate environment for demonstrations,
                repeatable testing, and security workflow evaluation.
                Employee behavior is generated from stored role,
                department, timing, network, file, and transfer
                baselines rather than arbitrary random events.
              </p>
            </div>


            <div
              className="
                mt-6
                grid
                gap-3
                md:grid-cols-2
                xl:grid-cols-3
              "
            >
              {ENVIRONMENT_CAPABILITIES.map(
                (
                  capability,
                ) => (
                  <article
                    key={
                      capability.title
                    }
                    className="
                      group
                      rounded-xl
                      border
                      relative
                      overflow-hidden
                      border-slate-700/50
                      bg-[#0c1420]
                      p-4
                      shadow-[0_8px_24px_rgba(0,0,0,0.12)]
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:border-cyan-800/55
                      hover:bg-[#111c29]
                      hover:shadow-[0_16px_36px_rgba(0,0,0,0.22)]
                    "
                  >
                    <span
                      className="
                        absolute
                        bottom-3
                        left-0
                        top-3
                        w-[2px]
                        rounded-r-full
                        bg-cyan-500/25
                        transition-all
                        duration-300
                        group-hover:bg-cyan-400/75
                      "
                    />

                    <div
                      className="
                        relative
                        flex
                        items-start
                        gap-3
                      "
                    >
                      <span
                        className="
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          border
                          border-cyan-800/45
                          bg-cyan-950/20
                          font-mono
                          text-[9px]
                          font-semibold
                          text-cyan-400
                          transition-all
                          group-hover:border-cyan-800/60
                          group-hover:bg-cyan-950/20
                        "
                      >
                        {
                          capability.code
                        }
                      </span>

                      <div>
                        <h3
                          className="
                            text-xs
                            font-semibold
                            text-slate-300
                            transition-colors
                            group-hover:text-white
                          "
                        >
                          {
                            capability
                              .title
                          }
                        </h3>

                        <p
                          className="
                            mt-1.5
                            text-[10px]
                            leading-5
                            text-slate-600
                          "
                        >
                          {
                            capability
                              .description
                          }
                        </p>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>


          {/* =================================================
              SUPPORTED SCENARIOS
          ================================================== */}
          <section
            className="
              mt-4
            "
          >
            <div
              className="
                mb-4
              "
            >
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.17em]
                  text-cyan-400
                "
              >
                Scenario Library
              </p>

              <h2
                className="
                  mt-2
                  text-lg
                  font-semibold
                  text-white
                "
              >
                Supported security scenarios
              </h2>

              <p
                className="
                  mt-2
                  text-[11px]
                  leading-5
                  text-slate-500
                "
              >
                These represent simulator capabilities only.
                Active hidden scenarios and private evaluation
                ground truth are never exposed here.
              </p>
            </div>


            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
                xl:grid-cols-5
              "
            >
              {SECURITY_SCENARIOS.map(
                (
                  scenario,
                ) => (
                  <article
                    key={
                      scenario.name
                    }
                    className="
                      group
                      min-h-[150px]
                      rounded-2xl
                      border
                      relative
                      overflow-hidden
                      border-slate-700/55
                      bg-[#101826]/90
                      p-5
                      shadow-[0_10px_30px_rgba(0,0,0,0.14)]
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:border-cyan-800/60
                      hover:bg-[#121c2b]
                      hover:shadow-[0_20px_45px_rgba(0,0,0,0.24),0_0_24px_rgba(34,211,238,0.03)]
                    "
                  >
                    <span
                      className="
                        absolute
                        bottom-4
                        left-0
                        top-4
                        w-[2px]
                        rounded-r-full
                        bg-cyan-500/20
                        transition-all
                        duration-300
                        group-hover:bg-cyan-400/75
                      "
                    />

                    <span
                      className="
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-lg
                        border
                        border-cyan-900/40
                        bg-cyan-950/15
                        font-mono
                        text-[9px]
                        font-semibold
                        text-cyan-400
                        transition
                        group-hover:border-cyan-900/70
                        group-hover:bg-cyan-950/15
                      "
                    >
                      {scenario.code}
                    </span>

                    <h3
                      className="
                        mt-4
                        text-xs
                        font-semibold
                        text-slate-300
                        transition-colors
                        group-hover:text-white
                      "
                    >
                      {scenario.name}
                    </h3>

                    <p
                      className="
                        mt-2
                        text-[10px]
                        leading-5
                        text-slate-600
                      "
                    >
                      {
                        scenario
                          .description
                      }
                    </p>
                  </article>
                ),
              )}
            </div>
          </section>


          {/* =================================================
              OPTIONAL SERVICE CALLOUT
          ================================================== */}
          <section
            className="
              relative
              mt-4
              overflow-hidden
              rounded-2xl
              border
              border-cyan-800/35
              bg-gradient-to-r
              from-cyan-950/20
              via-[#101826]
              to-indigo-950/10
              p-6
              shadow-[0_14px_40px_rgba(0,0,0,0.16)]
            "
          >
            <span
              className="
                absolute
                bottom-4
                left-0
                top-4
                w-[2px]
                rounded-r-full
                bg-cyan-400/70
              "
            />

            <div
              className="
                flex
                flex-col
                gap-4
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div
                className="
                  max-w-3xl
                "
              >
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-cyan-400
                  "
                >
                  Optional by Design
                </p>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-6
                    text-slate-500
                  "
                >
                  The simulator is an auxiliary SENTINEL service
                  intended for demonstration and testing. The core
                  security platform remains operational when simulation
                  is stopped.
                </p>
              </div>

              <div
                className="
                  flex
                  shrink-0
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-800
                  bg-slate-950/30
                  px-4
                  py-3
                "
              >
                <span
                  className="
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-cyan-400
                  "
                />

                <span
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.13em]
                    text-slate-500
                  "
                >
                  Read-only telemetry
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      <footer
        className="
          mt-6
          border-t
          border-slate-800/70
          py-5
          text-[11px]
          leading-5
          text-slate-600
        "
      >
        SENTINEL simulation views expose synthetic
        runtime telemetry and configured environment
        behavior only. Private simulator ground-truth
        labels remain evaluation-only and are never
        exposed to operational detection or analyst
        workflows.
      </footer>
    </main>
  );
}


export default SimulationPage;