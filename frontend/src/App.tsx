import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getEmployees,
  getMLAnomalies,
  getMLEventAnalysis,
  getMLModelInfo,
  getMLSummary,
} from "./services/api";

import type {
  MLAnomaly,
  MLEventAnalysis,
  MLModelInfo,
  MLRiskLevel,
  MLSummary,
} from "./types/api";


const RISK_STYLES: Record<
  MLRiskLevel,
  string
> = {
  NORMAL:
    "border-slate-700 bg-slate-800/70 text-slate-300",

  LOW:
    "border-cyan-800/60 bg-cyan-950/40 text-cyan-300",

  MEDIUM:
    "border-amber-800/60 bg-amber-950/40 text-amber-300",

  HIGH:
    "border-orange-800/60 bg-orange-950/40 text-orange-300",

  CRITICAL:
    "border-red-800/70 bg-red-950/45 text-red-300",
};


const RISK_BAR_STYLES: Record<
  MLRiskLevel,
  string
> = {
  NORMAL: "bg-slate-500",
  LOW: "bg-cyan-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-500",
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


function formatEventType(
  eventType: string,
): string {
  return eventType
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
  const date = new Date(
    timestamp,
  );

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
}


function getNumberFeature(
  analysis: MLEventAnalysis,
  feature: string,
): number | null {
  const value =
    analysis.feature_snapshot[
      feature
    ];

  return typeof value === "number"
    ? value
    : null;
}


function RiskBadge({
  risk,
}: {
  risk: MLRiskLevel;
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full",
        "border px-2.5 py-1",
        "text-[11px] font-semibold",
        "tracking-[0.12em]",
        RISK_STYLES[risk],
      ].join(" ")}
    >
      {risk}
    </span>
  );
}


function MetricCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: "critical";
}) {
  return (
    <div
      className={[
        "relative overflow-hidden",
        "rounded-2xl border",
        "border-slate-800",
        "bg-slate-900/70",
        "p-5 shadow-xl",
        "shadow-black/10",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-x-0 top-0",
          "h-px",
          accent === "critical"
            ? "bg-red-500"
            : "bg-gradient-to-r from-transparent via-cyan-500/70 to-transparent",
        ].join(" ")}
      />

      <p
        className="
          text-xs font-medium
          uppercase tracking-[0.16em]
          text-slate-500
        "
      >
        {label}
      </p>

      <p
        className={[
          "mt-3 text-3xl",
          "font-semibold tracking-tight",
          accent === "critical"
            ? "text-red-300"
            : "text-white",
        ].join(" ")}
      >
        {value}
      </p>

      <p
        className="
          mt-2 text-sm
          text-slate-500
        "
      >
        {helper}
      </p>
    </div>
  );
}


function SignalCard({
  label,
  value,
  note,
  warning = false,
}: {
  label: string;
  value: string;
  note?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border p-4",
        warning
          ? "border-red-900/60 bg-red-950/20"
          : "border-slate-800 bg-slate-950/45",
      ].join(" ")}
    >
      <p
        className="
          text-[11px] uppercase
          tracking-[0.14em]
          text-slate-500
        "
      >
        {label}
      </p>

      <p
        className={[
          "mt-2 text-lg font-semibold",
          warning
            ? "text-red-300"
            : "text-slate-100",
        ].join(" ")}
      >
        {value}
      </p>

      {note && (
        <p
          className="
            mt-1 text-xs
            leading-5 text-slate-500
          "
        >
          {note}
        </p>
      )}
    </div>
  );
}


function App() {
  const [
    employeeCount,
    setEmployeeCount,
  ] = useState(0);

  const [
    model,
    setModel,
  ] = useState<
    MLModelInfo | null
  >(null);

  const [
    summary,
    setSummary,
  ] = useState<
    MLSummary | null
  >(null);

  const [
    anomalies,
    setAnomalies,
  ] = useState<
    MLAnomaly[]
  >([]);

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState<
    string | null
  >(null);

  const [
    selectedAnalysis,
    setSelectedAnalysis,
  ] = useState<
    MLEventAnalysis | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    analysisLoading,
    setAnalysisLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);


  async function loadDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      const [
        employees,
        modelInfo,
        mlSummary,
        mlAnomalies,
      ] = await Promise.all([
        getEmployees(),
        getMLModelInfo(),
        getMLSummary(),
        getMLAnomalies(50),
      ]);

      setEmployeeCount(
        employees.length,
      );

      setModel(
        modelInfo,
      );

      setSummary(
        mlSummary,
      );

      setAnomalies(
        mlAnomalies,
      );

      if (
        mlAnomalies.length > 0
      ) {
        setSelectedEventId(
          (current) =>
            current
              ?? mlAnomalies[0]
                .event_id,
        );
      }
    } catch {
      setError(
        "SENTINEL could not load the ML intelligence feed. Confirm that the FastAPI backend and PostgreSQL are running.",
      );
    } finally {
      setIsLoading(false);
    }
  }


  useEffect(() => {
    let cancelled = false;

    async function loadInitialDashboard() {
      try {
        const [
          employees,
          modelInfo,
          mlSummary,
          mlAnomalies,
        ] = await Promise.all([
          getEmployees(),
          getMLModelInfo(),
          getMLSummary(),
          getMLAnomalies(50),
        ]);

        if (cancelled) {
          return;
        }

        setEmployeeCount(
          employees.length,
        );

        setModel(
          modelInfo,
        );

        setSummary(
          mlSummary,
        );

        setAnomalies(
          mlAnomalies,
        );

        if (
          mlAnomalies.length > 0
        ) {
          setSelectedEventId(
            mlAnomalies[0].event_id,
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "SENTINEL could not load the ML intelligence feed. Confirm that the FastAPI backend and PostgreSQL are running.",
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

    void loadInitialDashboard();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    let cancelled = false;

    async function loadAnalysis() {
      setAnalysisLoading(true);

      try {
        const analysis =
          await getMLEventAnalysis(
            selectedEventId!,
          );

        if (!cancelled) {
          setSelectedAnalysis(
            analysis,
          );
        }
      } catch {
        if (!cancelled) {
          setSelectedAnalysis(
            null,
          );
        }
      } finally {
        if (!cancelled) {
          setAnalysisLoading(
            false,
          );
        }
      }
    }

    void loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);


  const riskRows =
    useMemo(() => {
      if (!summary) {
        return [];
      }

      const total =
        summary.events_scored
        || 1;

      const values: Array<{
        risk: MLRiskLevel;
        count: number;
      }> = [
        {
          risk: "CRITICAL",
          count:
            summary
              .risk_distribution
              .critical,
        },
        {
          risk: "HIGH",
          count:
            summary
              .risk_distribution
              .high,
        },
        {
          risk: "MEDIUM",
          count:
            summary
              .risk_distribution
              .medium,
        },
        {
          risk: "LOW",
          count:
            summary
              .risk_distribution
              .low,
        },
        {
          risk: "NORMAL",
          count:
            summary
              .risk_distribution
              .normal,
        },
      ];

      return values.map(
        (row) => ({
          ...row,

          percentage:
            row.count / total,
        }),
      );
    }, [summary]);


  if (isLoading) {
    return (
      <main
        className="
          flex min-h-screen
          items-center justify-center
          bg-[#070b12]
          text-slate-200
        "
      >
        <div
          className="
            flex flex-col
            items-center gap-4
          "
        >
          <div
            className="
              h-10 w-10
              animate-spin
              rounded-full
              border-2
              border-slate-700
              border-t-cyan-400
            "
          />

          <p
            className="
              text-sm tracking-wide
              text-slate-500
            "
          >
            Loading SENTINEL
            intelligence...
          </p>
        </div>
      </main>
    );
  }


  return (
    <main
      className="
        min-h-screen
        bg-[#070b12]
        text-slate-100
      "
    >
      <div
        className="
          pointer-events-none
          fixed inset-0
          bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(99,102,241,0.05),transparent_25%)]
        "
      />

      <div
        className="
          relative mx-auto
          max-w-[1600px]
          px-4 py-5
          sm:px-6
          lg:px-8
        "
      >
        {/* Header */}
        <header
          className="
            mb-6 flex
            flex-col gap-5
            border-b
            border-slate-800/80
            pb-6
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          <div>
            <div
              className="
                flex items-center
                gap-3
              "
            >
              <div
                className="
                  flex h-10 w-10
                  items-center justify-center
                  rounded-xl
                  border border-cyan-900/70
                  bg-cyan-950/30
                "
              >
                <div
                  className="
                    h-3 w-3
                    rounded-full
                    bg-cyan-400
                    shadow-[0_0_18px_rgba(34,211,238,0.9)]
                  "
                />
              </div>

              <div>
                <h1
                  className="
                    text-xl font-semibold
                    tracking-[0.18em]
                    text-white
                  "
                >
                  SENTINEL
                </h1>

                <p
                  className="
                    mt-0.5 text-xs
                    uppercase
                    tracking-[0.13em]
                    text-slate-500
                  "
                >
                  Anomaly Detection
                  & Incident Intelligence
                </p>
              </div>
            </div>
          </div>

          <div
            className="
              flex flex-wrap
              items-center gap-3
            "
          >
            {model && (
              <div
                className="
                  rounded-xl
                  border border-slate-800
                  bg-slate-900/80
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
                      shadow-[0_0_12px_rgba(52,211,153,0.8)]
                    "
                  />

                  <span
                    className="
                      text-xs
                      font-medium
                      text-emerald-300
                    "
                  >
                    MODEL ONLINE
                  </span>
                </div>

                <p
                  className="
                    mt-1 text-xs
                    text-slate-500
                  "
                >
                  Isolation Forest
                  {" "}
                  v{model.model_version}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                void loadDashboard();
              }}
              className="
                rounded-xl
                border border-slate-700
                bg-slate-900
                px-4 py-3
                text-xs font-medium
                text-slate-300
                transition
                hover:border-cyan-800
                hover:text-cyan-300
              "
            >
              Refresh Intelligence
            </button>
          </div>
        </header>


        {error && (
          <div
            className="
              mb-6 rounded-xl
              border border-red-900/70
              bg-red-950/30
              px-4 py-3
              text-sm text-red-300
            "
          >
            {error}
          </div>
        )}


        {/* Metrics */}
        <section
          className="
            grid gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <MetricCard
            label="Active Users"
            value={formatNumber(
              employeeCount,
            )}
            helper="Synthetic enterprise identities"
          />

          <MetricCard
            label="Events Scored"
            value={
              summary
                ? formatNumber(
                    summary.events_scored,
                  )
                : "—"
            }
            helper="Persisted Isolation Forest analyses"
          />

          <MetricCard
            label="Critical Alerts"
            value={
              summary
                ? formatNumber(
                    summary.alert_count,
                  )
                : "—"
            }
            helper="Reached the 99th-percentile alert threshold"
            accent="critical"
          />

          <MetricCard
            label="Evaluation Recall"
            value={
              model
                ? formatPercent(
                    model.recall,
                  )
                : "—"
            }
            helper="Controlled Aug 25–26 evaluation set"
          />
        </section>


        {/* Model + risk */}
        <section
          className="
            mt-4 grid gap-4
            xl:grid-cols-[1.1fr_0.9fr]
          "
        >
          {/* Risk distribution */}
          <div
            className="
              rounded-2xl
              border border-slate-800
              bg-slate-900/65
              p-5
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
                    text-xs uppercase
                    tracking-[0.15em]
                    text-slate-500
                  "
                >
                  Population Risk
                </p>

                <h2
                  className="
                    mt-1 text-lg
                    font-semibold
                    text-white
                  "
                >
                  Risk Distribution
                </h2>
              </div>

              {summary && (
                <div
                  className="
                    text-right
                  "
                >
                  <p
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    Mean anomaly percentile
                  </p>

                  <p
                    className="
                      mt-1 text-lg
                      font-semibold
                      text-slate-200
                    "
                  >
                    {formatPercent(
                      summary.average_score,
                    )}
                  </p>
                </div>
              )}
            </div>

            <div
              className="
                mt-6 space-y-4
              "
            >
              {riskRows.map(
                ({
                  risk,
                  count,
                  percentage,
                }) => (
                  <div
                    key={risk}
                  >
                    <div
                      className="
                        mb-2 flex
                        items-center
                        justify-between
                      "
                    >
                      <div
                        className="
                          flex items-center
                          gap-2
                        "
                      >
                        <span
                          className={[
                            "h-2 w-2",
                            "rounded-full",
                            RISK_BAR_STYLES[
                              risk
                            ],
                          ].join(" ")}
                        />

                        <span
                          className="
                            text-xs
                            font-medium
                            text-slate-300
                          "
                        >
                          {risk}
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
                            font-medium
                            text-slate-300
                          "
                        >
                          {formatNumber(
                            count,
                          )}
                        </span>

                        {" · "}

                        {formatPercent(
                          percentage,
                        )}
                      </div>
                    </div>

                    <div
                      className="
                        h-1.5
                        overflow-hidden
                        rounded-full
                        bg-slate-800
                      "
                    >
                      <div
                        className={[
                          "h-full",
                          "rounded-full",
                          RISK_BAR_STYLES[
                            risk
                          ],
                        ].join(" ")}
                        style={{
                          width:
                            `${Math.max(
                              percentage
                                * 100,
                              percentage > 0
                                ? 0.8
                                : 0,
                            )}%`,
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>


          {/* Model performance */}
          <div
            className="
              rounded-2xl
              border border-slate-800
              bg-slate-900/65
              p-5
            "
          >
            <p
              className="
                text-xs uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              Detection Engine
            </p>

            <div
              className="
                mt-1 flex
                items-center
                justify-between
                gap-4
              "
            >
              <div>
                <h2
                  className="
                    text-lg font-semibold
                    text-white
                  "
                >
                  Isolation Forest
                </h2>

                <p
                  className="
                    mt-1 text-sm
                    text-slate-500
                  "
                >
                  Unsupervised behavioral
                  anomaly detection
                </p>
              </div>

              {model && (
                <span
                  className="
                    rounded-lg
                    border border-cyan-900/60
                    bg-cyan-950/30
                    px-3 py-1.5
                    text-xs font-medium
                    text-cyan-300
                  "
                >
                  v{model.model_version}
                </span>
              )}
            </div>

            {model && (
              <>
                <div
                  className="
                    mt-6 grid
                    grid-cols-2 gap-3
                  "
                >
                  <SignalCard
                    label="Precision"
                    value={formatPercent(
                      model.precision,
                    )}
                    note="Evaluation precision"
                  />

                  <SignalCard
                    label="Recall"
                    value={formatPercent(
                      model.recall,
                    )}
                    note="Attack events detected"
                  />

                  <SignalCard
                    label="F1 Score"
                    value={formatPercent(
                      model.f1_score,
                    )}
                    note="Precision / recall balance"
                  />

                  <SignalCard
                    label="False Positive Rate"
                    value={formatPercent(
                      model.false_positive_rate,
                      2,
                    )}
                    note="Evaluation normal traffic"
                  />
                </div>

                <div
                  className="
                    mt-4 grid
                    grid-cols-3 gap-3
                    rounded-xl
                    border border-slate-800
                    bg-slate-950/40
                    p-4
                  "
                >
                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-wider
                        text-slate-600
                      "
                    >
                      Features
                    </p>

                    <p
                      className="
                        mt-1 font-semibold
                        text-slate-300
                      "
                    >
                      {model.feature_count}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-wider
                        text-slate-600
                      "
                    >
                      Train
                    </p>

                    <p
                      className="
                        mt-1 font-semibold
                        text-slate-300
                      "
                    >
                      {formatNumber(
                        model.training_rows,
                      )}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-wider
                        text-slate-600
                      "
                    >
                      Threshold
                    </p>

                    <p
                      className="
                        mt-1 font-semibold
                        text-slate-300
                      "
                    >
                      {formatPercent(
                        model.threshold_percentile,
                        0,
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>


        {/* Main intelligence */}
        <section
          className="
            mt-4 grid gap-4
            2xl:grid-cols-[1.35fr_0.65fr]
          "
        >
          {/* Anomaly feed */}
          <div
            className="
              overflow-hidden
              rounded-2xl
              border border-slate-800
              bg-slate-900/65
            "
          >
            <div
              className="
                flex flex-col gap-3
                border-b
                border-slate-800
                p-5
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-xs uppercase
                    tracking-[0.15em]
                    text-slate-500
                  "
                >
                  Ranked Intelligence
                </p>

                <h2
                  className="
                    mt-1 text-lg
                    font-semibold
                    text-white
                  "
                >
                  Top ML Anomalies
                </h2>
              </div>

              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Showing top
                {" "}
                {anomalies.length}
                {" "}
                non-normal events
              </p>
            </div>

            <div
              className="
                overflow-x-auto
              "
            >
              <table
                className="
                  w-full
                  min-w-[850px]
                  border-collapse
                "
              >
                <thead>
                  <tr
                    className="
                      border-b
                      border-slate-800
                      bg-slate-950/30
                    "
                  >
                    {[
                      "Event",
                      "Employee",
                      "Type",
                      "Score",
                      "Risk",
                      "Observed (Local)",
                    ].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="
                            px-5 py-3
                            text-left
                            text-[10px]
                            font-medium
                            uppercase
                            tracking-[0.14em]
                            text-slate-600
                          "
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {anomalies.map(
                    (anomaly) => {
                      const selected =
                        anomaly.event_id
                        === selectedEventId;

                      return (
                        <tr
                          key={
                            anomaly.score_id
                          }
                          onClick={() =>
                            setSelectedEventId(
                              anomaly.event_id,
                            )
                          }
                          className={[
                            "cursor-pointer",
                            "border-b",
                            "border-slate-800/60",
                            "transition",
                            selected
                              ? "bg-cyan-950/25"
                              : "hover:bg-slate-800/35",
                          ].join(" ")}
                        >
                          <td
                            className="
                              px-5 py-4
                            "
                          >
                            <p
                              className="
                                font-mono
                                text-xs
                                text-slate-300
                              "
                            >
                              {anomaly.event_id}
                            </p>
                          </td>

                          <td
                            className="
                              px-5 py-4
                              text-sm
                              text-slate-400
                            "
                          >
                            {
                              anomaly
                                .employee_user_id
                            }
                          </td>

                          <td
                            className="
                              px-5 py-4
                              text-sm
                              text-slate-300
                            "
                          >
                            {formatEventType(
                              anomaly.event_type,
                            )}
                          </td>

                          <td
                            className="
                              px-5 py-4
                            "
                          >
                            <div
                              className="
                                flex items-center
                                gap-3
                              "
                            >
                              <span
                                className="
                                  min-w-12
                                  font-mono
                                  text-sm
                                  font-semibold
                                  text-slate-200
                                "
                              >
                                {anomaly
                                  .anomaly_score
                                  .toFixed(3)}
                              </span>

                              <div
                                className="
                                  h-1.5 w-16
                                  overflow-hidden
                                  rounded-full
                                  bg-slate-800
                                "
                              >
                                <div
                                  className="
                                    h-full
                                    rounded-full
                                    bg-red-500
                                  "
                                  style={{
                                    width:
                                      `${anomaly.anomaly_score * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td
                            className="
                              px-5 py-4
                            "
                          >
                            <RiskBadge
                              risk={
                                anomaly.risk_level
                              }
                            />
                          </td>

                          <td
                            className="
                              px-5 py-4
                              text-xs
                              text-slate-500
                            "
                          >
                            {formatTimestamp(
                              anomaly.timestamp,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </div>


          {/* Selected event */}
          <aside
            className="
              rounded-2xl
              border border-slate-800
              bg-slate-900/65
              p-5
              2xl:sticky
              2xl:top-5
              2xl:self-start
            "
          >
            <p
              className="
                text-xs uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              Event Intelligence
            </p>

            <h2
              className="
                mt-1 text-lg
                font-semibold
                text-white
              "
            >
              Behavioral Analysis
            </h2>

            {analysisLoading && (
              <div
                className="
                  mt-10 flex
                  items-center
                  justify-center
                "
              >
                <div
                  className="
                    h-7 w-7
                    animate-spin
                    rounded-full
                    border-2
                    border-slate-700
                    border-t-cyan-400
                  "
                />
              </div>
            )}

            {!analysisLoading
              && !selectedAnalysis && (
                <p
                  className="
                    mt-6 text-sm
                    leading-6
                    text-slate-500
                  "
                >
                  Select an anomaly to
                  inspect its behavioral
                  feature snapshot.
                </p>
              )}

            {!analysisLoading
              && selectedAnalysis && (
                <>
                  <div
                    className="
                      mt-5 rounded-xl
                      border border-slate-800
                      bg-slate-950/50
                      p-4
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
                            font-mono
                            text-xs
                            text-cyan-300
                          "
                        >
                          {
                            selectedAnalysis
                              .event_id
                          }
                        </p>

                        <p
                          className="
                            mt-2 text-lg
                            font-semibold
                            text-white
                          "
                        >
                          {formatEventType(
                            selectedAnalysis
                              .event_type,
                          )}
                        </p>

                        <p
                          className="
                            mt-1 text-xs
                            text-slate-500
                          "
                        >
                          {
                            selectedAnalysis
                              .employee_user_id
                          }
                          {" · "}
                          {formatTimestamp(
                            selectedAnalysis
                              .timestamp,
                          )}
                        </p>
                      </div>

                      <RiskBadge
                        risk={
                          selectedAnalysis
                            .risk_level
                        }
                      />
                    </div>

                    <div
                      className="
                        mt-5
                      "
                    >
                      <div
                        className="
                          flex items-end
                          justify-between
                        "
                      >
                        <div>
                          <p
                            className="
                              text-[10px]
                              uppercase
                              tracking-[0.14em]
                              text-slate-600
                            "
                          >
                            Anomaly Percentile
                          </p>

                          <p
                            className="
                              mt-1 text-3xl
                              font-semibold
                              text-red-300
                            "
                          >
                            {formatPercent(
                              selectedAnalysis
                                .anomaly_score,
                              1,
                            )}
                          </p>
                        </div>

                        <p
                          className="
                            text-xs
                            text-slate-500
                          "
                        >
                          threshold{" "}
                          {model
                            ? formatPercent(
                                model
                                  .threshold_percentile,
                                0,
                              )
                            : "99%"}
                        </p>
                      </div>

                      <div
                        className="
                          mt-3 h-2
                          overflow-hidden
                          rounded-full
                          bg-slate-800
                        "
                      >
                        <div
                          className="
                            h-full
                            rounded-full
                            bg-gradient-to-r
                            from-amber-500
                            to-red-500
                          "
                          style={{
                            width:
                              `${selectedAnalysis.anomaly_score * 100}%`,
                          }}
                        />
                      </div>

                      <p
                        className="
                          mt-3 text-xs
                          leading-5
                          text-slate-500
                        "
                      >
                        Historical anomaly
                        percentile relative
                        to the learned baseline.
                        This is not an attack
                        probability.
                      </p>
                    </div>
                  </div>


                  <div
                    className="
                      mt-5
                    "
                  >
                    <p
                      className="
                        text-[11px]
                        font-medium
                        uppercase
                        tracking-[0.14em]
                        text-slate-500
                      "
                    >
                      Behavioral Signals
                    </p>

                    <div
                      className="
                        mt-3 grid
                        grid-cols-2 gap-3
                      "
                    >
                      <SignalCard
                        label="Failed Logins / 10m"
                        value={String(
                          getNumberFeature(
                            selectedAnalysis,
                            "failed_logins_10m",
                          )
                            ?? "—",
                        )}
                        warning={
                          (
                            getNumberFeature(
                              selectedAnalysis,
                              "failed_logins_10m",
                            )
                            ?? 0
                          ) > 0
                        }
                      />

                      <SignalCard
                        label="Recent Events / 5m"
                        value={String(
                          getNumberFeature(
                            selectedAnalysis,
                            "events_5m",
                          )
                            ?? "—",
                        )}
                      />

                      <SignalCard
                        label="Network Events / 5m"
                        value={String(
                          getNumberFeature(
                            selectedAnalysis,
                            "network_events_5m",
                          )
                            ?? "—",
                        )}
                      />

                      <SignalCard
                        label="Unique Destinations"
                        value={String(
                          getNumberFeature(
                            selectedAnalysis,
                            "unique_destinations_5m",
                          )
                            ?? "—",
                        )}
                        warning={
                          (
                            getNumberFeature(
                              selectedAnalysis,
                              "unique_destinations_5m",
                            )
                            ?? 0
                          ) >= 10
                        }
                      />

                      <SignalCard
                        label="Outside Work Hours"
                        value={
                          getNumberFeature(
                            selectedAnalysis,
                            "outside_work_hours",
                          )
                            === 1
                            ? "YES"
                            : "NO"
                        }
                        warning={
                          getNumberFeature(
                            selectedAnalysis,
                            "outside_work_hours",
                          )
                            === 1
                        }
                      />

                      <SignalCard
                        label="Baseline Source IP"
                        value={
                          getNumberFeature(
                            selectedAnalysis,
                            "source_ip_is_baseline",
                          )
                            === 1
                            ? "YES"
                            : "NO"
                        }
                        warning={
                          getNumberFeature(
                            selectedAnalysis,
                            "source_ip_is_baseline",
                          )
                            === 0
                        }
                      />

                      <SignalCard
                        label="File Events / 30m"
                        value={String(
                          getNumberFeature(
                            selectedAnalysis,
                            "file_events_30m",
                          )
                            ?? "—",
                        )}
                      />

                      <SignalCard
                        label="Data Volume Ratio"
                        value={
                          getNumberFeature(
                            selectedAnalysis,
                            "data_volume_ratio",
                          ) !== null
                            ? (
                                getNumberFeature(
                                  selectedAnalysis,
                                  "data_volume_ratio",
                                )
                                ?? 0
                              ).toFixed(4)
                            : "—"
                        }
                      />
                    </div>
                  </div>


                  <div
                    className="
                      mt-5 rounded-xl
                      border border-slate-800
                      bg-slate-950/40
                      p-4
                    "
                  >
                    <div
                      className="
                        flex items-center
                        justify-between
                        gap-3
                      "
                    >
                      <p
                        className="
                          text-[11px]
                          uppercase
                          tracking-[0.14em]
                          text-slate-500
                        "
                      >
                        Detector
                      </p>

                      <span
                        className="
                          text-xs
                          text-emerald-300
                        "
                      >
                        Analysis complete
                      </span>
                    </div>

                    <p
                      className="
                        mt-3 text-sm
                        font-medium
                        text-slate-300
                      "
                    >
                      {
                        selectedAnalysis
                          .explanation
                          .summary
                      }
                    </p>

                    <p
                      className="
                        mt-2 text-xs
                        leading-5
                        text-slate-500
                      "
                    >
                      Isolation Forest
                      {" "}
                      v{
                        selectedAnalysis
                          .detector_version
                      }
                      {" · "}
                      {
                        selectedAnalysis
                          .feature_snapshot
                          ? Object.keys(
                              selectedAnalysis
                                .feature_snapshot,
                            ).length
                          : 0
                      }
                      {" "}
                      recorded features
                    </p>
                  </div>
                </>
              )}
          </aside>
        </section>


        {/* Footer note */}
        <footer
          className="
            mt-6 flex
            flex-col gap-2
            border-t
            border-slate-800/70
            py-5
            text-xs
            text-slate-600
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p>
            SENTINEL synthetic enterprise
            security environment
          </p>

          <p>
            Operational UI excludes simulator
            ground-truth labels.
          </p>
        </footer>
      </div>
    </main>
  );
}


export default App;