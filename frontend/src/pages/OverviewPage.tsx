import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getEmployees,
  getIncidents,
  getIncidentSummary,
  getMLModelInfo,
  getMLSummary,
  getEvaluationSummary,
} from "../services/api";

import type {
  EvaluationSummary,
  IncidentListItem,
  IncidentSeverity,
  IncidentSummary,
  MLModelInfo,
  MLSummary,
} from "../types/api";


const SEVERITY_STYLES: Record<
  IncidentSeverity,
  {
    badge: string;
    dot: string;
    bar: string;
  }
> = {
  CRITICAL: {
    badge:
      "border-red-800/70 bg-red-950/45 text-red-300",

    dot:
      "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]",

    bar:
      "bg-red-500",
  },

  HIGH: {
    badge:
      "border-orange-800/70 bg-orange-950/35 text-orange-300",

    dot:
      "bg-orange-400",

    bar:
      "bg-orange-500",
  },

  MEDIUM: {
    badge:
      "border-amber-800/60 bg-amber-950/30 text-amber-300",

    dot:
      "bg-amber-400",

    bar:
      "bg-amber-500",
  },
};


function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
  ).format(value);
}


function formatPercent(
  value: number,
  decimals = 1,
): string {
  return `${(
    value * 100
  ).toFixed(decimals)}%`;
}


function formatIncidentType(
  value: string,
): string {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0)
        + word
          .slice(1)
          .toLowerCase(),
    )
    .join(" ");
}


function formatTimestamp(
  timestamp: string,
): string {
  return new Date(
    timestamp,
  ).toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


function SeverityBadge({
  severity,
}: {
  severity: IncidentSeverity;
}) {
  return (
    <span
      className={[
        "inline-flex items-center",
        "rounded-full border",
        "px-2.5 py-1",
        "text-[10px] font-semibold",
        "tracking-[0.12em]",
        SEVERITY_STYLES[
          severity
        ].badge,
      ].join(" ")}
    >
      {severity}
    </span>
  );
}


function MetricCard({
  eyebrow,
  value,
  label,
  helper,
  tone = "default",
}: {
  eyebrow: string;
  value: string;
  label: string;
  helper: string;

  tone?:
    | "default"
    | "critical"
    | "cyan";
}) {
  return (
    <div
      className={[
        "group relative",
        "overflow-hidden",
        "rounded-2xl border",
        "border-slate-700/55",
        "bg-[#101826]/90",
        "p-5",
        "shadow-[0_12px_35px_rgba(0,0,0,0.12)]",
        "transition-all duration-300",
        "hover:-translate-y-1",
        "hover:border-slate-600/70",
        "hover:bg-[#121c2b]",
        "hover:shadow-[0_18px_45px_rgba(0,0,0,0.2)]",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-x-0 top-0",
          "h-px",
          tone === "critical"
            ? "bg-gradient-to-r from-transparent via-red-500 to-transparent"
            : tone === "cyan"
              ? "bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
              : "bg-gradient-to-r from-transparent via-slate-500/60 to-transparent",
        ].join(" ")}
      />

      <p
        className="
          text-[10px]
          font-medium uppercase
          tracking-[0.17em]
          text-slate-500
        "
      >
        {eyebrow}
      </p>

      <div
        className="
          mt-4 flex
          items-end justify-between
          gap-4
        "
      >
        <div>
          <p
            className={[
              "text-3xl",
              "font-semibold",
              "tracking-tight",
              tone === "critical"
                ? "text-red-300"
                : "text-white",
            ].join(" ")}
          >
            {value}
          </p>

          <p
            className="
              mt-1 text-sm
              font-medium
              text-slate-300
            "
          >
            {label}
          </p>
        </div>

        <div
          className={[
            "h-9 w-9",
            "rounded-xl border",
            "transition-all duration-300",
            "group-hover:scale-105",
            tone === "critical"
              ? (
                "border-red-900/60 "
                + "bg-red-950/30"
              )
              : tone === "cyan"
                ? (
                  "border-cyan-900/60 "
                  + "bg-cyan-950/30"
                )
                : (
                  "border-slate-700/70 "
                  + "bg-slate-900/70"
                ),
          ].join(" ")}
        />
      </div>

      <p
        className="
          mt-4 text-xs
          leading-5
          text-slate-500
        "
      >
        {helper}
      </p>
    </div>
  );
}


function OverviewPage() {
  const [
    employeeCount,
    setEmployeeCount,
  ] = useState(0);

  const [
    incidentSummary,
    setIncidentSummary,
  ] = useState<
    IncidentSummary | null
  >(null);

  const [
    incidents,
    setIncidents,
  ] = useState<
    IncidentListItem[]
  >([]);

  const [
    mlSummary,
    setMLSummary,
  ] = useState<
    MLSummary | null
  >(null);

  const [
    model,
    setModel,
  ] = useState<
    MLModelInfo | null
  >(null);

  const [
    evaluation,
    setEvaluation,
  ] = useState<
    EvaluationSummary | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);


  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [
          employees,
          incidentData,
          incidentList,
          machineLearningSummary,
          modelInfo,
          evaluationData,
        ] = await Promise.all([
          getEmployees(),
          getIncidentSummary(),
          getIncidents(8),
          getMLSummary(),
          getMLModelInfo(),
          getEvaluationSummary(),
        ]);

        if (cancelled) {
          return;
        }

        setEmployeeCount(
          employees.length,
        );

        setIncidentSummary(
          incidentData,
        );

        setIncidents(
          incidentList,
        );

        setMLSummary(
          machineLearningSummary,
        );

        setModel(
          modelInfo,
        );

        setEvaluation(
          evaluationData,
        );

        setError(
          null,
        );
      } catch {
        if (!cancelled) {
          setError(
            "SENTINEL could not load the current security posture. Confirm that PostgreSQL and the FastAPI backend are running.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(
            false,
          );
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);


  async function refreshOverview() {
    setIsRefreshing(
      true,
    );

    try {
      const [
        employees,
        incidentData,
        incidentList,
        machineLearningSummary,
        modelInfo,
        evaluationData,
      ] = await Promise.all([
        getEmployees(),
        getIncidentSummary(),
        getIncidents(8),
        getMLSummary(),
        getMLModelInfo(),
        getEvaluationSummary(),
      ]);

      setEmployeeCount(
        employees.length,
      );

      setIncidentSummary(
        incidentData,
      );

      setIncidents(
        incidentList,
      );

      setMLSummary(
        machineLearningSummary,
      );

      setModel(
        modelInfo,
      );

      setEvaluation(
        evaluationData,
      );

      setError(
        null,
      );
    } catch {
      setError(
        "SENTINEL could not refresh the current intelligence feed.",
      );
    } finally {
      setIsRefreshing(
        false,
      );
    }
  }


  const severityRows = useMemo<
    {
      severity: IncidentSeverity;
      count: number;
      percentage: number;
    }[]
  >(() => {
    if (!incidentSummary) {
      return [];
    }

    const total =
      incidentSummary.total_incidents || 1;

    const rows: {
      severity: IncidentSeverity;
      count: number;
    }[] = [
      {
        severity: "CRITICAL",
        count:
          incidentSummary.critical_incidents,
      },
      {
        severity: "HIGH",
        count:
          incidentSummary.high_incidents,
      },
      {
        severity: "MEDIUM",
        count:
          incidentSummary.medium_incidents,
      },
    ];

    return rows.map(
      (row) => ({
        ...row,
        percentage:
          row.count / total,
      }),
    );
  }, [
    incidentSummary,
  ]);


  if (isLoading) {
    return (
      <main
        className="
          flex min-h-screen
          items-center justify-center
          px-6
        "
      >
        <div
          className="
            flex flex-col
            items-center
            gap-4
          "
        >
          <div
            className="
              h-9 w-9
              animate-spin
              rounded-full
              border-2
              border-slate-700
              border-t-cyan-400
            "
          />

          <p
            className="
              text-xs
              uppercase
              tracking-[0.16em]
              text-slate-600
            "
          >
            Loading Security Operations
          </p>
        </div>
      </main>
    );
  }


  return (
    <main
      className="
        min-h-screen
        bg-[#0b111b]/55
        px-4 py-6
        sm:px-6
        xl:px-8
      "
    >
      <div
        className="
          mx-auto
          max-w-[1550px]
        "
      >
        {/* =================================================
            Page Header
            ================================================= */}
        <header
          className="
            flex flex-col
            gap-5
            lg:flex-row
            lg:items-end
            lg:justify-between
          "
        >
          <div>
            <div
              className="
                flex items-center
                gap-2.5
              "
            >
              <span
                className="
                  h-1.5 w-1.5
                  rounded-full
                  bg-cyan-400
                  shadow-[0_0_12px_rgba(34,211,238,0.7)]
                "
              />

              <p
                className="
                  text-[10px]
                  font-semibold uppercase
                  tracking-[0.19em]
                  text-cyan-400
                "
              >
                Security Operations
              </p>
            </div>

            <h1
              className="
                mt-3 text-3xl
                font-semibold
                tracking-tight
                text-white
                sm:text-4xl
              "
            >
              Security Operations Overview
            </h1>

            <p
              className="
                mt-3 max-w-3xl
                text-sm leading-6
                text-slate-500
              "
            >
              Monitor correlated threats,
              investigation priorities,
              behavioral detections and
              SENTINEL system health from
              one operational workspace.
            </p>
          </div>


          <div
            className="
              flex flex-wrap
              items-center gap-3
            "
          >
            <div
              className="
                rounded-xl
                border border-emerald-900/40
                bg-emerald-950/15
                px-4 py-2.5
              "
            >
              <div
                className="
                  flex items-center
                  gap-2
                "
              >
                <span
                  className="
                    h-2 w-2
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_10px_rgba(52,211,153,0.7)]
                  "
                />

                <span
                  className="
                    text-[11px]
                    font-semibold
                    tracking-[0.1em]
                    text-emerald-300
                  "
                >
                  SYSTEM OPERATIONAL
                </span>
              </div>
            </div>


            <button
              type="button"
              disabled={
                isRefreshing
              }
              onClick={() => {
                void refreshOverview();
              }}
              className="
                rounded-xl
                border border-slate-700/70
                bg-[#121a28]
                px-4 py-2.5
                text-xs font-medium
                text-slate-300
                shadow-lg
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:border-cyan-800/70
                hover:bg-cyan-950/20
                hover:text-cyan-300
                disabled:cursor-wait
                disabled:opacity-60
              "
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh Intelligence"}
            </button>
          </div>
        </header>


        {error && (
          <div
            className="
              mt-6 rounded-xl
              border border-red-900/60
              bg-red-950/25
              px-4 py-3
              text-sm
              text-red-300
            "
          >
            {error}
          </div>
        )}


        {/* =================================================
            Primary Metrics
            ================================================= */}
        <section
          className="
            mt-7 grid gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <MetricCard
            eyebrow="Enterprise"
            value={formatNumber(
              employeeCount,
            )}
            label="Monitored Identities"
            helper="Active synthetic enterprise identities currently represented in SENTINEL."
            tone="cyan"
          />

          <MetricCard
            eyebrow="Telemetry"
            value={
              mlSummary
                ? formatNumber(
                    mlSummary
                      .events_scored,
                  )
                : "—"
            }
            label="Events Analyzed"
            helper="Security events processed through the selected behavioral anomaly detector."
          />

          <MetricCard
            eyebrow="Investigations"
            value={
              incidentSummary
                ? formatNumber(
                    incidentSummary
                      .open_incidents,
                  )
                : "—"
            }
            label="Open Incidents"
            helper="Correlated investigations currently requiring analyst review."
            tone="cyan"
          />

          <MetricCard
            eyebrow="Priority"
            value={
              incidentSummary
                ? formatNumber(
                    incidentSummary
                      .critical_incidents,
                  )
                : "—"
            }
            label="Critical Incidents"
            helper="Highest-priority incidents requiring immediate analyst attention."
            tone="critical"
          />
        </section>


        {/* =================================================
            Intelligence Overview
            ================================================= */}
        <section
          className="
            mt-4 grid gap-4
            xl:grid-cols-[0.9fr_1.1fr]
          "
        >
          {/* Incident Severity */}
          <article
            className="
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
              shadow-[0_12px_35px_rgba(0,0,0,0.12)]
              transition-all duration-300
              hover:border-slate-600/70
              hover:bg-[#121c2b]
            "
          >
            <div
              className="
                flex items-start
                justify-between
                gap-4
              "
            >
              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.17em]
                    text-slate-500
                  "
                >
                  Incident Intelligence
                </p>

                <h2
                  className="
                    mt-1.5 text-lg
                    font-semibold
                    text-white
                  "
                >
                  Incident Severity
                </h2>
              </div>

              <div
                className="
                  text-right
                "
              >
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.13em]
                    text-slate-600
                  "
                >
                  Total
                </p>

                <p
                  className="
                    mt-1 text-xl
                    font-semibold
                    text-slate-200
                  "
                >
                  {incidentSummary
                    ? formatNumber(
                        incidentSummary
                          .total_incidents,
                      )
                    : "—"}
                </p>
              </div>
            </div>


            <div
              className="
                mt-6 space-y-5
              "
            >
              {severityRows.map(
                ({
                  severity,
                  count,
                  percentage,
                }) => (
                  <div
                    key={
                      severity
                    }
                    className="
                      group
                    "
                  >
                    <div
                      className="
                        flex items-center
                        justify-between
                        gap-4
                      "
                    >
                      <div
                        className="
                          flex items-center
                          gap-2.5
                        "
                      >
                        <span
                          className={[
                            "h-2 w-2",
                            "rounded-full",
                            SEVERITY_STYLES[
                              severity
                            ].dot,
                          ].join(" ")}
                        />

                        <span
                          className="
                            text-xs
                            font-medium
                            text-slate-300
                          "
                        >
                          {severity}
                        </span>
                      </div>

                      <div
                        className="
                          text-xs
                          text-slate-500
                        "
                      >
                        <span
                          className="
                            font-semibold
                            text-slate-200
                          "
                        >
                          {count}
                        </span>

                        {" · "}

                        {formatPercent(
                          percentage,
                        )}
                      </div>
                    </div>

                    <div
                      className="
                        mt-2.5 h-1.5
                        overflow-hidden
                        rounded-full
                        bg-slate-800
                      "
                    >
                      <div
                        className={[
                          "h-full",
                          "rounded-full",
                          "transition-all",
                          "duration-500",
                          "group-hover:brightness-125",
                          SEVERITY_STYLES[
                            severity
                          ].bar,
                        ].join(" ")}
                        style={{
                          width:
                            `${percentage * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>


            <div
              className="
                mt-6 grid
                grid-cols-2 gap-3
                border-t
                border-slate-800
                pt-5
              "
            >
              <div
                className="
                  rounded-xl
                  border border-slate-800
                  bg-[#0b111c]
                  p-4
                "
              >
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.13em]
                    text-slate-600
                  "
                >
                  Correlated Events
                </p>

                <p
                  className="
                    mt-2 text-xl
                    font-semibold
                    text-slate-200
                  "
                >
                  {incidentSummary
                    ? formatNumber(
                        incidentSummary
                          .total_correlated_events,
                      )
                    : "—"}
                </p>
              </div>

              <div
                className="
                  rounded-xl
                  border border-slate-800
                  bg-[#0b111c]
                  p-4
                "
              >
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.13em]
                    text-slate-600
                  "
                >
                  Incident Recall
                </p>

                <p
                  className="
                    mt-2 text-xl
                    font-semibold
                    text-emerald-300
                  "
                >
                  {evaluation
                    ? formatPercent(
                        evaluation
                          .incident_evaluation
                          .recall,
                        0,
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </article>


          {/* Intelligence Pipeline */}
          <article
            className="
              relative overflow-hidden
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
              shadow-[0_12px_35px_rgba(0,0,0,0.12)]
              transition-all duration-300
              hover:border-cyan-900/45
              hover:bg-[#121c2b]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                right-[-80px]
                top-[-90px]
                h-64 w-64
                rounded-full
                bg-cyan-400/[0.035]
                blur-[90px]
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
                  uppercase
                  tracking-[0.17em]
                  text-slate-500
                "
              >
                Detection Architecture
              </p>

              <h2
                className="
                  mt-1.5 text-lg
                  font-semibold
                  text-white
                "
              >
                Intelligence Pipeline
              </h2>

              <p
                className="
                  mt-2 max-w-2xl
                  text-xs
                  leading-5
                  text-slate-500
                "
              >
                Raw enterprise telemetry
                is transformed into
                behavioral detections,
                correlated incidents and
                structured investigation
                intelligence.
              </p>


              <div
                className="
                  mt-6 grid
                  gap-3
                  md:grid-cols-4
                "
              >
                <div
                  className="
                    group rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all duration-200
                    hover:-translate-y-1
                    hover:border-cyan-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Telemetry
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {mlSummary
                      ? formatNumber(
                          mlSummary
                            .events_scored,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    events
                  </p>
                </div>


                <div
                  className="
                    group rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all duration-200
                    hover:-translate-y-1
                    hover:border-red-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    ML Alerts
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-red-300
                    "
                  >
                    {mlSummary
                      ? formatNumber(
                          mlSummary
                            .alert_count,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    critical signals
                  </p>
                </div>


                <div
                  className="
                    group rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all duration-200
                    hover:-translate-y-1
                    hover:border-orange-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Correlation
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {incidentSummary
                      ? formatNumber(
                          incidentSummary
                            .total_incidents,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    incidents
                  </p>
                </div>


                <div
                  className="
                    group rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all duration-200
                    hover:-translate-y-1
                    hover:border-emerald-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Investigation
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-emerald-300
                    "
                  >
                    {incidentSummary
                      ? formatNumber(
                          incidentSummary
                            .total_incidents,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    enriched cases
                  </p>
                </div>
              </div>


              {/* Pipeline connector */}
              <div
                className="
                  mt-5 hidden
                  items-center
                  md:flex
                "
              >
                {[
                  "Events",
                  "Isolation Forest",
                  "Correlation",
                  "Investigation",
                ].map(
                  (
                    step,
                    index,
                  ) => (
                    <div
                      key={step}
                      className="
                        flex flex-1
                        items-center
                      "
                    >
                      <div
                        className="
                          flex items-center
                          gap-2
                        "
                      >
                        <span
                          className="
                            flex h-6 w-6
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-cyan-900/60
                            bg-cyan-950/30
                            text-[10px]
                            font-semibold
                            text-cyan-300
                          "
                        >
                          {index + 1}
                        </span>

                        <span
                          className="
                            text-[10px]
                            text-slate-500
                          "
                        >
                          {step}
                        </span>
                      </div>

                      {index < 3 && (
                        <div
                          className="
                            mx-3 h-px
                            flex-1
                            bg-gradient-to-r
                            from-cyan-900/50
                            to-slate-800
                          "
                        />
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          </article>
        </section>


        {/* =================================================
            Performance Intelligence
            ================================================= */}
        <section
          className="
            mt-4 grid gap-4
            lg:grid-cols-3
          "
        >
          <div
            className="
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
              transition-all duration-300
              hover:-translate-y-0.5
              hover:border-cyan-900/50
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              ML Detection
            </p>

            <div
              className="
                mt-3 flex
                items-baseline
                justify-between
                gap-3
              "
            >
              <p
                className="
                  text-2xl
                  font-semibold
                  text-white
                "
              >
                {model
                  ? formatPercent(
                      model.recall,
                    )
                  : "—"}
              </p>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-600
                "
              >
                Recall
              </span>
            </div>

            <p
              className="
                mt-3 text-xs
                leading-5
                text-slate-500
              "
            >
              Event-level detection
              performance across the
              controlled evaluation set.
            </p>
          </div>


          <div
            className="
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
              transition-all duration-300
              hover:-translate-y-0.5
              hover:border-emerald-900/50
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              Incident Correlation
            </p>

            <div
              className="
                mt-3 flex
                items-baseline
                justify-between
                gap-3
              "
            >
              <p
                className="
                  text-2xl
                  font-semibold
                  text-emerald-300
                "
              >
                {evaluation
                  ? formatPercent(
                      evaluation
                        .incident_evaluation
                        .recall,
                      0,
                    )
                  : "—"}
              </p>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-600
                "
              >
                Scenario Recall
              </span>
            </div>

            <p
              className="
                mt-3 text-xs
                leading-5
                text-slate-500
              "
            >
              All five controlled attack
              instances were recovered at
              the incident level.
            </p>
          </div>


          <div
            className="
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
              transition-all duration-300
              hover:-translate-y-0.5
              hover:border-indigo-900/50
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              Timeline Recovery
            </p>

            <div
              className="
                mt-3 flex
                items-baseline
                justify-between
                gap-3
              "
            >
              <p
                className="
                  text-2xl
                  font-semibold
                  text-white
                "
              >
                {evaluation
                  ? (
                    `${evaluation
                      .incident_evaluation
                      .timeline_events_recovered} / ${
                      evaluation
                        .incident_evaluation
                        .timeline_events_total
                    }`
                  )
                  : "—"}
              </p>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-600
                "
              >
                Attack Events
              </span>
            </div>

            <p
              className="
                mt-3 text-xs
                leading-5
                text-slate-500
              "
            >
              Temporal correlation
              reconstructed complete
              controlled attack timelines.
            </p>
          </div>
        </section>


        {/* =================================================
            Recent Incident Queue
            ================================================= */}
        <section
          className="
            mt-4 overflow-hidden
            rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            shadow-[0_12px_35px_rgba(0,0,0,0.12)]
          "
        >
          <div
            className="
              flex flex-col gap-3
              border-b
              border-slate-800
              px-5 py-5
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div>
              <p
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.17em]
                  text-slate-500
                "
              >
                Investigation Queue
              </p>

              <h2
                className="
                  mt-1.5 text-lg
                  font-semibold
                  text-white
                "
              >
                Recent Security Incidents
              </h2>
            </div>

            <p
              className="
                text-xs
                text-slate-600
              "
            >
              Latest correlated activity
            </p>
          </div>


          <div
            className="
              divide-y
              divide-slate-800/70
            "
          >
            {incidents.map(
              (incident) => (
                <div
                  key={
                    incident
                      .incident_id
                  }
                  className="
                    group
                    grid gap-4
                    px-5 py-4
                    transition-all
                    duration-200
                    hover:bg-[#141e2d]
                    lg:grid-cols-[120px_1fr_160px_120px_130px]
                    lg:items-center
                  "
                >
                  <div>
                    <SeverityBadge
                      severity={
                        incident
                          .severity
                      }
                    />
                  </div>


                  <div
                    className="
                      min-w-0
                    "
                  >
                    <div
                      className="
                        flex flex-wrap
                        items-center gap-2
                      "
                    >
                      <p
                        className="
                          font-mono
                          text-[10px]
                          text-cyan-400
                        "
                      >
                        {
                          incident
                            .incident_id
                        }
                      </p>

                      <span
                        className="
                          text-slate-700
                        "
                      >
                        ·
                      </span>

                      <span
                        className="
                          text-[10px]
                          uppercase
                          tracking-[0.1em]
                          text-slate-600
                        "
                      >
                        {formatIncidentType(
                          incident
                            .incident_type,
                        )}
                      </span>
                    </div>

                    <p
                      className="
                        mt-1
                        font-medium
                        text-slate-200
                        transition-colors
                        group-hover:text-white
                      "
                    >
                      {
                        incident.title
                      }
                    </p>

                    <p
                      className="
                        mt-1
                        line-clamp-1
                        text-xs
                        text-slate-600
                      "
                    >
                      {
                        incident.summary
                      }
                    </p>
                  </div>


                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-[0.12em]
                        text-slate-600
                      "
                    >
                      Identity
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        text-slate-300
                      "
                    >
                      {
                        incident
                          .primary_employee_user_id
                          ?? "Unknown"
                      }
                    </p>
                  </div>


                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-[0.12em]
                        text-slate-600
                      "
                    >
                      Events
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-slate-300
                      "
                    >
                      {incident
                        .event_count}
                    </p>
                  </div>


                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-[0.12em]
                        text-slate-600
                      "
                    >
                      First Seen
                    </p>

                    <p
                      className="
                        mt-1 text-xs
                        text-slate-400
                      "
                    >
                      {formatTimestamp(
                        incident
                          .first_seen,
                      )}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>


        {/* =================================================
            Footer / Platform State
            ================================================= */}
        <footer
          className="
            mt-6 flex
            flex-col gap-2
            border-t
            border-slate-800/70
            py-5
            text-[11px]
            text-slate-600
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p>
            SENTINEL Security Operations
            Intelligence Platform
          </p>

          <p>
            Isolation Forest
            {" "}
            {model
              ? `v${model.model_version}`
              : ""}
            {" · "}
            Multi-signal correlation
            {" · "}
            Structured investigation
          </p>
        </footer>
      </div>
    </main>
  );
}


export default OverviewPage;
