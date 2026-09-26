import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getEvaluationSummary,
  getMLModelInfo,
  getMLSummary,
} from "../services/api";

import type {
  EvaluationSummary,
  MLModelInfo,
  MLSummary,
  ModelExperimentEvaluation,
} from "../types/api";


interface PerformanceCardProps {
  label: string;
  value: string;
  helper: string;

  accent?:
    | "cyan"
    | "emerald"
    | "default";
}


interface FeatureGroup {
  title: string;
  description: string;
  features: string[];
}


const FEATURE_GROUPS:
  FeatureGroup[] = [
    {
      title:
        "Temporal Behavior",

      description:
        "Captures when activity occurs relative to learned working patterns.",

      features: [
        "hour_sin",
        "hour_cos",
        "outside_work_hours",
      ],
    },

    {
      title:
        "Identity Context",

      description:
        "Compares event context against the employee behavioral baseline.",

      features: [
        "source_ip_is_baseline",
        "remote_work_probability",
        "success",
      ],
    },

    {
      title:
        "Data Volume",

      description:
        "Measures transfer volume and deviation from expected activity.",

      features: [
        "bytes_sent",
        "bytes_received",
        "total_bytes",
        "data_volume_ratio",
      ],
    },

    {
      title:
        "Rolling Behavior",

      description:
        "Tracks recent authentication, event density and file activity.",

      features: [
        "failed_logins_10m",
        "events_5m",
        "file_events_30m",
        "bytes_sent_30m",
        "bytes_received_30m",
      ],
    },

    {
      title:
        "Network Behavior",

      description:
        "Captures short-window network activity and destination fan-out.",

      features: [
        "network_events_5m",
        "unique_destinations_5m",
      ],
    },
  ];


const RISK_LEVELS = [
  {
    key: "CRITICAL",
    label: "Critical",
  },
  {
    key: "HIGH",
    label: "High",
  },
  {
    key: "MEDIUM",
    label: "Medium",
  },
  {
    key: "LOW",
    label: "Low",
  },
  {
    key: "NORMAL",
    label: "Normal",
  },
] as const;


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


function formatFeatureName(
  value: string,
): string {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase()
        + word.slice(1),
    )
    .join(" ");
}


function formatDateTime(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString();
}


function formatRefreshTime(
  value: Date,
): string {
  return value.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


function PerformanceCard({
  label,
  value,
  helper,
  accent = "default",
}: PerformanceCardProps) {
  return (
    <div
      className="
        group relative overflow-hidden
        rounded-2xl
        border border-slate-700/55
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
          absolute -right-10 -top-10
          h-24 w-24
          rounded-full
          bg-cyan-400/[0.025]
          blur-3xl
          transition-all
          duration-300
          group-hover:bg-cyan-400/[0.055]
        "
      />

      <p
        className="
          relative text-[10px]
          uppercase
          tracking-[0.16em]
          text-slate-500
        "
      >
        {label}
      </p>

      <p
        className={[
          "relative mt-4 text-3xl",
          "font-semibold",
          "tracking-tight",

          accent === "cyan"
            ? "text-cyan-300"
            : accent === "emerald"
              ? "text-emerald-300"
              : "text-white",
        ].join(" ")}
      >
        {value}
      </p>

      <p
        className="
          relative mt-2 text-xs
          leading-5
          text-slate-500
        "
      >
        {helper}
      </p>
    </div>
  );
}


function ModelPage() {
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

  const [
    lastRefreshedAt,
    setLastRefreshedAt,
  ] = useState<
    Date | null
  >(null);


  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [
          modelInfo,
          mlSummary,
          evaluationData,
        ] = await Promise.all([
          getMLModelInfo(),
          getMLSummary(),
          getEvaluationSummary(),
        ]);

        if (cancelled) {
          return;
        }

        setModel(
          modelInfo,
        );

        setSummary(
          mlSummary,
        );

        setEvaluation(
          evaluationData,
        );

        setLastRefreshedAt(
          new Date(),
        );

        setError(
          null,
        );
      } catch {
        if (!cancelled) {
          setError(
            "SENTINEL could not load model intelligence. Confirm that the FastAPI backend is running.",
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


  async function refreshModel() {
    setIsRefreshing(
      true,
    );

    try {
      const [
        modelInfo,
        mlSummary,
        evaluationData,
      ] = await Promise.all([
        getMLModelInfo(),
        getMLSummary(),
        getEvaluationSummary(),
      ]);

      setModel(
        modelInfo,
      );

      setSummary(
        mlSummary,
      );

      setEvaluation(
        evaluationData,
      );

      setLastRefreshedAt(
        new Date(),
      );

      setError(
        null,
      );
    } catch {
      setError(
        "SENTINEL could not refresh model intelligence.",
      );
    } finally {
      setIsRefreshing(
        false,
      );
    }
  }


  const selectedExperiment:
    ModelExperimentEvaluation
    | undefined =
      evaluation
        ?.experiments
        .find(
          (experiment) =>
            experiment.selected,
        );


  const maxRiskCount = useMemo(
    () => {
      if (!evaluation) {
        return 1;
      }

      const values =
        Object.values(
          evaluation
            .benchmark
            .operational_scoring
            .risk_distribution,
        );

      return Math.max(
        ...values,
        1,
      );
    },
    [
      evaluation,
    ],
  );


  if (isLoading) {
    return (
      <main
        className="
          flex min-h-screen
          items-center
          justify-center
          bg-[#0b111b]/55
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
              text-[10px]
              uppercase
              tracking-[0.17em]
              text-slate-600
            "
          >
            Loading Model Intelligence
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
          max-w-[1600px]
        "
      >
        {/* ==================================================
            Header
            ================================================== */}

        <header
          className="
            flex flex-col gap-5
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
                  font-semibold
                  uppercase
                  tracking-[0.19em]
                  text-cyan-400
                "
              >
                Detection Intelligence
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
              Model Intelligence
            </h1>

            <p
              className="
                mt-3 max-w-3xl
                text-sm leading-6
                text-slate-500
              "
            >
              Inspect SENTINEL&apos;s selected
              anomaly detector, controlled
              benchmark evidence, model selection,
              incident recovery and current
              scoring data.
            </p>
          </div>


          <div
            className="
              flex flex-wrap
              items-center gap-3
              self-start
              lg:self-auto
            "
          >
            {lastRefreshedAt && (
              <div
                className="
                  flex items-center gap-2.5
                  rounded-xl
                  border border-slate-800
                  bg-[#0d1522]/85
                  px-3.5 py-2
                  shadow-sm
                "
              >
                <span
                  className="
                    relative flex
                    h-2 w-2
                  "
                >
                  <span
                    className="
                      absolute inline-flex
                      h-full w-full
                      animate-ping
                      rounded-full
                      bg-emerald-400
                      opacity-40
                    "
                  />

                  <span
                    className="
                      relative inline-flex
                      h-2 w-2
                      rounded-full
                      bg-emerald-400
                    "
                  />
                </span>

                <div>
                  <p
                    className="
                      text-[8px]
                      font-semibold
                      uppercase
                      tracking-[0.14em]
                      text-slate-600
                    "
                  >
                    Last Refreshed
                  </p>

                  <p
                    className="
                      mt-0.5 text-[11px]
                      font-medium
                      text-slate-300
                    "
                  >
                    {formatRefreshTime(
                      lastRefreshedAt,
                    )}
                  </p>
                </div>
              </div>
            )}


            <button
              type="button"
              disabled={
                isRefreshing
              }
              onClick={() => {
                void refreshModel();
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
                hover:border-cyan-700/70
                hover:bg-cyan-950/25
                hover:text-cyan-300
                hover:shadow-[0_8px_24px_rgba(6,182,212,0.08)]
                disabled:cursor-wait
                disabled:opacity-60
              "
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh Model"}
            </button>
          </div>
        </header>


        {error && (
          <div
            className="
              mt-6 rounded-xl
              border border-red-900/60
              bg-red-950/20
              px-4 py-3
              text-sm text-red-300
            "
          >
            {error}
          </div>
        )}


        {/* ==================================================
            Selected Model Hero
            ================================================== */}

        {model && (
          <section
            className="
              relative mt-7
              overflow-hidden
              rounded-2xl
              border border-cyan-950/55
              bg-[#101826]/90
              p-6
              shadow-[0_16px_45px_rgba(0,0,0,0.14)]
              transition-all
              duration-300
              hover:border-cyan-900/60
              hover:shadow-[0_22px_60px_rgba(6,182,212,0.06)]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                right-[-120px]
                top-[-140px]
                h-96 w-96
                rounded-full
                bg-cyan-400/[0.04]
                blur-[120px]
              "
            />

            <div
              className="
                relative flex
                flex-col gap-6
                xl:flex-row
                xl:items-center
                xl:justify-between
              "
            >
              <div>
                <div
                  className="
                    flex flex-wrap
                    items-center gap-2
                  "
                >
                  <span
                    className="
                      rounded-full
                      border
                      border-emerald-900/55
                      bg-emerald-950/20
                      px-3 py-1
                      text-[9px]
                      font-semibold
                      tracking-[0.13em]
                      text-emerald-300
                    "
                  >
                    PRODUCTION DETECTOR
                  </span>

                  <span
                    className="
                      rounded-full
                      border
                      border-cyan-900/55
                      bg-cyan-950/20
                      px-3 py-1
                      text-[9px]
                      font-semibold
                      tracking-[0.13em]
                      text-cyan-300
                    "
                  >
                    HISTORICAL PERCENTILE SCORING
                  </span>
                </div>

                <h2
                  className="
                    mt-4 text-3xl
                    font-semibold
                    tracking-tight
                    text-white
                  "
                >
                  Isolation Forest{" "}

                  <span
                    className="
                      text-cyan-300
                    "
                  >
                    v{model.model_version}
                  </span>
                </h2>

                <p
                  className="
                    mt-3 max-w-2xl
                    text-sm
                    leading-6
                    text-slate-500
                  "
                >
                  Unsupervised behavioral anomaly
                  detection trained on known-normal
                  historical enterprise activity
                  and evaluated chronologically
                  against future normal and
                  controlled attack events.
                </p>
              </div>


              <div
                className="
                  grid gap-3
                  sm:grid-cols-3
                "
              >
                {[
                  {
                    label:
                      "Features",

                    value:
                      String(
                        model.feature_count,
                      ),
                  },

                  {
                    label:
                      "Training Rows",

                    value:
                      formatNumber(
                        model.training_rows,
                      ),
                  },

                  {
                    label:
                      "Threshold",

                    value:
                      formatPercent(
                        model.threshold_percentile,
                        0,
                      ),
                  },
                ].map(
                  (item) => (
                    <div
                      key={
                        item.label
                      }
                      className="
                        min-w-[130px]
                        rounded-xl
                        border border-slate-800
                        bg-[#0b111c]
                        px-5 py-4
                        transition-all
                        duration-300
                        hover:-translate-y-0.5
                        hover:border-cyan-900/60
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
                        {item.label}
                      </p>

                      <p
                        className="
                          mt-2 text-xl
                          font-semibold
                          text-white
                        "
                      >
                        {item.value}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>
        )}


        {/* ==================================================
            KPI Cards
            ================================================== */}

        {model && (
          <section
            className="
              mt-4 grid gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <PerformanceCard
              label="Precision"
              value={formatPercent(
                model.precision,
              )}
              helper="Share of model alerts that overlap controlled attack events."
            />

            <PerformanceCard
              label="Recall"
              value={formatPercent(
                model.recall,
              )}
              helper="Share of controlled attack events detected by the model."
              accent="emerald"
            />

            <PerformanceCard
              label="F1 Score"
              value={formatPercent(
                model.f1_score,
              )}
              helper="Balance between detection coverage and alert precision."
              accent="cyan"
            />

            <PerformanceCard
              label="False Positive Rate"
              value={formatPercent(
                model.false_positive_rate,
                2,
              )}
              helper="Normal evaluation events incorrectly crossing the alert threshold."
            />
          </section>
        )}


        {/* ==================================================
            Benchmark Command Center
            ================================================== */}

        {evaluation && (
          <section
            className="
              mt-4 grid gap-4
              xl:grid-cols-[0.92fr_1.08fr]
            "
          >
            <article
              className="
                group relative overflow-hidden
                rounded-2xl
                border border-slate-700/55
                bg-[#101826]/90
                p-6
                transition-all
                duration-300
                hover:border-cyan-900/55
                hover:shadow-[0_18px_50px_rgba(6,182,212,0.045)]
              "
            >
              <div
                className="
                  pointer-events-none
                  absolute
                  -left-16 -top-20
                  h-52 w-52
                  rounded-full
                  bg-cyan-400/[0.025]
                  blur-[80px]
                  transition-all
                  duration-300
                  group-hover:bg-cyan-400/[0.05]
                "
              />

              <div
                className="
                  relative
                "
              >
                <div
                  className="
                    flex flex-wrap
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-[0.17em]
                        text-cyan-500
                      "
                    >
                      Controlled Benchmark
                    </p>

                    <h2
                      className="
                        mt-1.5 text-xl
                        font-semibold
                        text-white
                      "
                    >
                      Reproducible Evaluation
                    </h2>
                  </div>


                  <div
                    className="
                      flex flex-wrap gap-2
                    "
                  >
                    <span
                      className="
                        rounded-full
                        border border-emerald-900/50
                        bg-emerald-950/20
                        px-3 py-1.5
                        text-[9px]
                        font-semibold
                        tracking-[0.12em]
                        text-emerald-300
                      "
                    >
                      {evaluation
                        .benchmark
                        .status}
                    </span>

                    <span
                      className="
                        rounded-full
                        border border-cyan-900/50
                        bg-cyan-950/20
                        px-3 py-1.5
                        text-[9px]
                        font-semibold
                        tracking-[0.12em]
                        text-cyan-300
                      "
                    >
                      SEED{" "}
                      {evaluation
                        .benchmark
                        .seed}
                    </span>

                    <span
                      className="
                        rounded-full
                        border border-slate-700
                        bg-slate-900/50
                        px-3 py-1.5
                        text-[9px]
                        font-semibold
                        tracking-[0.12em]
                        text-slate-400
                      "
                    >
                      REPRODUCIBLE
                    </span>
                  </div>
                </div>


                <p
                  className="
                    mt-4 max-w-2xl
                    text-xs leading-5
                    text-slate-500
                  "
                >
                  A fixed synthetic enterprise,
                  deterministic attack scenarios
                  and a fixed random seed provide
                  repeatable evidence independent
                  of the live operational database.
                </p>


                <div
                  className="
                    mt-6 grid gap-3
                    sm:grid-cols-2
                    lg:grid-cols-3
                  "
                >
                  {[
                    {
                      label:
                        "Employees",

                      value:
                        formatNumber(
                          evaluation
                            .benchmark
                            .dataset
                            .employees,
                        ),
                    },

                    {
                      label:
                        "Total Events",

                      value:
                        formatNumber(
                          evaluation
                            .benchmark
                            .dataset
                            .total_events,
                        ),
                    },

                    {
                      label:
                        "Attack Events",

                      value:
                        formatNumber(
                          evaluation
                            .benchmark
                            .dataset
                            .attack_events,
                        ),
                    },

                    {
                      label:
                        "Normal Events",

                      value:
                        formatNumber(
                          evaluation
                            .benchmark
                            .dataset
                            .normal_events,
                        ),
                    },

                    {
                      label:
                        "Campaigns",

                      value:
                        formatNumber(
                          evaluation
                            .benchmark
                            .dataset
                            .attack_instances,
                        ),
                    },

                    {
                      label:
                        "Incidents",

                      value:
                        formatNumber(
                          evaluation
                            .benchmark
                            .incident_correlation
                            .total,
                        ),
                    },
                  ].map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                        className="
                          rounded-xl
                          border border-slate-800
                          bg-[#0b111c]
                          p-4
                          transition-all
                          duration-300
                          hover:-translate-y-0.5
                          hover:border-slate-700
                          hover:bg-[#0e1724]
                        "
                      >
                        <p
                          className="
                            text-[9px]
                            uppercase
                            tracking-[0.12em]
                            text-slate-600
                          "
                        >
                          {item.label}
                        </p>

                        <p
                          className="
                            mt-2 text-xl
                            font-semibold
                            text-white
                          "
                        >
                          {item.value}
                        </p>
                      </div>
                    ),
                  )}
                </div>


                <div
                  className="
                    mt-4 flex flex-col
                    gap-1 rounded-xl
                    border border-slate-800
                    bg-[#0b111c]/75
                    px-4 py-3
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <p
                    className="
                      text-[10px]
                      text-slate-500
                    "
                  >
                    {evaluation
                      .benchmark
                      .database_isolation}
                  </p>

                  <p
                    className="
                      text-[10px]
                      text-slate-600
                    "
                  >
                    Generated{" "}
                    {formatDateTime(
                      evaluation
                        .benchmark
                        .generated_at,
                    )}
                  </p>
                </div>
              </div>
            </article>


            {/* Risk Distribution */}

            <article
              className="
                rounded-2xl
                border border-slate-700/55
                bg-[#101826]/90
                p-6
                transition-all
                duration-300
                hover:border-slate-600/70
              "
            >
              <div
                className="
                  flex flex-col gap-2
                  sm:flex-row
                  sm:items-end
                  sm:justify-between
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.17em]
                      text-slate-600
                    "
                  >
                    Benchmark Scoring
                  </p>

                  <h2
                    className="
                      mt-1.5 text-xl
                      font-semibold
                      text-white
                    "
                  >
                    Risk Distribution
                  </h2>
                </div>

                <p
                  className="
                    text-xs text-slate-600
                  "
                >
                  {formatNumber(
                    evaluation
                      .benchmark
                      .operational_scoring
                      .scored_events,
                  )}
                  {" "}
                  scored events
                </p>
              </div>


              <div
                className="
                  mt-7 space-y-5
                "
              >
                {RISK_LEVELS.map(
                  (risk) => {
                    const count =
                      evaluation
                        .benchmark
                        .operational_scoring
                        .risk_distribution[
                          risk.key
                        ]
                      ?? 0;

                    const width =
                      Math.max(
                        (
                          count
                          / maxRiskCount
                        )
                        * 100,
                        count > 0
                          ? 1.5
                          : 0,
                      );

                    const barClass =
                      risk.key === "CRITICAL"
                        ? "bg-red-400"
                        : risk.key === "HIGH"
                          ? "bg-orange-400"
                          : risk.key === "MEDIUM"
                            ? "bg-amber-300"
                            : risk.key === "LOW"
                              ? "bg-cyan-400"
                              : "bg-slate-500";

                    return (
                      <div
                        key={
                          risk.key
                        }
                        className="
                          group
                        "
                      >
                        <div
                          className="
                            mb-2 flex
                            items-center
                            justify-between
                            gap-3
                          "
                        >
                          <div
                            className="
                              flex items-center gap-2
                            "
                          >
                            <span
                              className={[
                                "h-1.5 w-1.5",
                                "rounded-full",
                                barClass,
                              ].join(" ")}
                            />

                            <span
                              className="
                                text-xs
                                font-medium
                                text-slate-400
                              "
                            >
                              {risk.label}
                            </span>
                          </div>

                          <span
                            className="
                              text-xs
                              font-semibold
                              tabular-nums
                              text-slate-300
                            "
                          >
                            {formatNumber(
                              count,
                            )}
                          </span>
                        </div>


                        <div
                          className="
                            h-2 overflow-hidden
                            rounded-full
                            bg-slate-900
                          "
                        >
                          <div
                            style={{
                              width:
                                `${width}%`,
                            }}
                            className={[
                              "h-full rounded-full",
                              barClass,
                              "opacity-70",
                              "transition-all",
                              "duration-500",
                              "group-hover:opacity-100",
                            ].join(" ")}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>


              <div
                className="
                  mt-7 rounded-xl
                  border border-red-950/40
                  bg-red-950/[0.08]
                  p-4
                "
              >
                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-[0.13em]
                    text-red-400
                  "
                >
                  Critical Boundary
                </p>

                <div
                  className="
                    mt-2 flex
                    items-end
                    justify-between
                    gap-4
                  "
                >
                  <p
                    className="
                      text-2xl
                      font-semibold
                      text-red-300
                    "
                  >
                    {formatNumber(
                      evaluation
                        .benchmark
                        .canonical_signature
                        .critical_scores,
                    )}
                  </p>

                  <p
                    className="
                      max-w-xs text-right
                      text-[11px]
                      leading-5
                      text-slate-600
                    "
                  >
                    Events reaching the selected
                    critical anomaly boundary.
                  </p>
                </div>
              </div>
            </article>
          </section>
        )}


        {/* ==================================================
            Model Selection Arena
            ================================================== */}

        {evaluation && (
          <section
            className="
              mt-4 rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-6
            "
          >
            <div
              className="
                flex flex-col gap-3
                md:flex-row
                md:items-end
                md:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.17em]
                    text-slate-600
                  "
                >
                  Model Selection Arena
                </p>

                <h2
                  className="
                    mt-1.5 text-xl
                    font-semibold
                    text-white
                  "
                >
                  V1 vs V2
                </h2>

                <p
                  className="
                    mt-2 max-w-2xl
                    text-xs leading-5
                    text-slate-500
                  "
                >
                  Both candidates were retrained
                  against the same chronological
                  benchmark before objective model
                  selection.
                </p>
              </div>

              <p
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.13em]
                  text-slate-600
                "
              >
                F1 → Precision → Fewer Features
              </p>
            </div>


            <div
              className="
                mt-6 grid gap-4
                lg:grid-cols-2
              "
            >
              {evaluation
                .experiments
                .map(
                  (experiment) => (
                    <article
                      key={
                        experiment.name
                      }
                      className={[
                        "group relative overflow-hidden",
                        "rounded-2xl border p-5",
                        "transition-all duration-300",
                        "hover:-translate-y-1",

                        experiment.selected
                          ? (
                            "border-emerald-900/55 "
                            + "bg-emerald-950/[0.08] "
                            + "hover:border-emerald-700/60 "
                            + "hover:shadow-[0_20px_50px_rgba(16,185,129,0.07)]"
                          )
                          : (
                            "border-slate-800 "
                            + "bg-[#0b111c] "
                            + "hover:border-cyan-900/45 "
                            + "hover:shadow-[0_20px_50px_rgba(6,182,212,0.04)]"
                          ),
                      ].join(" ")}
                    >
                      {experiment.selected && (
                        <div
                          className="
                            pointer-events-none
                            absolute
                            -right-14 -top-20
                            h-52 w-52
                            rounded-full
                            bg-emerald-400/[0.035]
                            blur-[80px]
                          "
                        />
                      )}

                      <div
                        className="
                          relative
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
                              className={[
                                "text-[9px]",
                                "font-semibold",
                                "uppercase",
                                "tracking-[0.14em]",

                                experiment.selected
                                  ? "text-emerald-400"
                                  : "text-slate-600",
                              ].join(" ")}
                            >
                              {experiment.selected
                                ? "Selected Experiment"
                                : "Candidate Experiment"}
                            </p>

                            <h3
                              className="
                                mt-2 text-2xl
                                font-semibold
                                tracking-tight
                                text-white
                              "
                            >
                              {experiment.name}
                            </h3>

                            <p
                              className="
                                mt-1 text-xs
                                text-slate-600
                              "
                            >
                              {experiment.version}
                            </p>
                          </div>

                          <span
                            className={[
                              "rounded-lg border",
                              "px-3 py-1.5",
                              "text-[9px]",
                              "font-semibold",
                              "tracking-[0.1em]",

                              experiment.selected
                                ? (
                                  "border-emerald-800/60 "
                                  + "bg-emerald-950/30 "
                                  + "text-emerald-300"
                                )
                                : (
                                  "border-slate-700 "
                                  + "bg-slate-900/50 "
                                  + "text-slate-500"
                                ),
                            ].join(" ")}
                          >
                            {experiment.selected
                              ? "WINNER"
                              : "REJECTED"}
                          </span>
                        </div>


                        <div
                          className="
                            mt-6 grid gap-3
                            grid-cols-2
                            sm:grid-cols-4
                          "
                        >
                          {[
                            {
                              label:
                                "Precision",

                              value:
                                formatPercent(
                                  experiment
                                    .precision,
                                ),
                            },

                            {
                              label:
                                "Recall",

                              value:
                                formatPercent(
                                  experiment
                                    .recall,
                                ),
                            },

                            {
                              label:
                                "F1 Score",

                              value:
                                formatPercent(
                                  experiment
                                    .f1_score,
                                ),
                            },

                            {
                              label:
                                "Features",

                              value:
                                String(
                                  experiment
                                    .feature_count,
                                ),
                            },
                          ].map(
                            (metric) => (
                              <div
                                key={
                                  metric.label
                                }
                                className="
                                  rounded-xl
                                  border border-slate-800
                                  bg-slate-950/30
                                  p-3
                                "
                              >
                                <p
                                  className="
                                    text-[8px]
                                    uppercase
                                    tracking-[0.12em]
                                    text-slate-600
                                  "
                                >
                                  {metric.label}
                                </p>

                                <p
                                  className="
                                    mt-2 text-base
                                    font-semibold
                                    text-slate-200
                                  "
                                >
                                  {metric.value}
                                </p>
                              </div>
                            ),
                          )}
                        </div>


                        <div
                          className="
                            mt-4 flex
                            flex-wrap gap-4
                            border-t
                            border-slate-800/80
                            pt-4
                          "
                        >
                          <p
                            className="
                              text-[11px]
                              text-slate-500
                            "
                          >
                            Alerts{" "}
                            <span
                              className="
                                font-semibold
                                text-slate-300
                              "
                            >
                              {formatNumber(
                                experiment.alerts,
                              )}
                            </span>
                          </p>

                          <p
                            className="
                              text-[11px]
                              text-slate-500
                            "
                          >
                            False positives{" "}
                            <span
                              className="
                                font-semibold
                                text-slate-300
                              "
                            >
                              {formatNumber(
                                experiment
                                  .false_positives,
                              )}
                            </span>
                          </p>

                          <p
                            className="
                              text-[11px]
                              text-slate-500
                            "
                          >
                            FPR{" "}
                            <span
                              className="
                                font-semibold
                                text-slate-300
                              "
                            >
                              {formatPercent(
                                experiment
                                  .false_positive_rate,
                                2,
                              )}
                            </span>
                          </p>
                        </div>


                        <p
                          className="
                            mt-4 text-xs
                            leading-5
                            text-slate-500
                          "
                        >
                          {experiment.decision}
                        </p>
                      </div>
                    </article>
                  ),
                )}
            </div>


            {selectedExperiment && (
              <div
                className="
                  mt-4 rounded-xl
                  border border-cyan-950/50
                  bg-gradient-to-r
                  from-cyan-950/[0.14]
                  to-transparent
                  p-4
                "
              >
                <p
                  className="
                    text-[9px]
                    uppercase
                    tracking-[0.14em]
                    text-cyan-500
                  "
                >
                  Final Selection
                </p>

                <p
                  className="
                    mt-2 text-sm
                    leading-6
                    text-slate-300
                  "
                >
                  {selectedExperiment.name}
                  {" was promoted because it "}
                  delivered the strongest overall
                  balance of precision and F1 while
                  retaining a compact feature set
                  and fewer false-positive alerts.
                  V2 achieved slightly higher
                  recall, but not enough to
                  outperform V1 on the benchmark
                  selection criteria.
                </p>
              </div>
            )}
          </section>
        )}


        {/* ==================================================
            Evaluation Journey
            ================================================== */}

        {evaluation && model && (
          <section
            className="
              mt-4 rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-6
            "
          >
            <div
              className="
                flex flex-col gap-2
                sm:flex-row
                sm:items-end
                sm:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.17em]
                    text-slate-600
                  "
                >
                  Evaluation Journey
                </p>

                <h2
                  className="
                    mt-1.5 text-xl
                    font-semibold
                    text-white
                  "
                >
                  From Historical Baseline
                  to Production Detector
                </h2>
              </div>

              <p
                className="
                  text-xs
                  text-slate-600
                "
              >
                Chronological, not random
              </p>
            </div>


            <div
              className="
                mt-7 grid gap-3
                md:grid-cols-3
                xl:grid-cols-6
              "
            >
              {[
                {
                  number: "01",
                  title: "Train",
                  main:
                    evaluation
                      .provenance
                      .ml_training_period,

                  detail:
                    `${formatNumber(
                      model.training_rows,
                    )} known-normal rows`,
                },

                {
                  number: "02",
                  title: "Evaluate",
                  main:
                    evaluation
                      .provenance
                      .ml_evaluation_period,

                  detail:
                    `${formatNumber(
                      model.evaluation_rows,
                    )} future rows`,
                },

                {
                  number: "03",
                  title: "Compare",
                  main:
                    "V1 vs V2",

                  detail:
                    "Same controlled benchmark",
                },

                {
                  number: "04",
                  title: "Select",
                  main:
                    selectedExperiment
                      ?.name
                    ?? "V1",

                  detail:
                    "Objective metric hierarchy",
                },

                {
                  number: "05",
                  title: "Version",
                  main:
                    `v${model.model_version}`,

                  detail:
                    "Frozen production artifact",
                },

                {
                  number: "06",
                  title: "Score",
                  main:
                    formatNumber(
                      evaluation
                        .benchmark
                        .operational_scoring
                        .scored_events,
                    ),

                  detail:
                    "Controlled benchmark scores",
                },
              ].map(
                (
                  stage,
                  index,
                ) => (
                  <div
                    key={
                      stage.number
                    }
                    className="
                      group relative
                    "
                  >
                    <div
                      className="
                        h-full rounded-xl
                        border border-slate-800
                        bg-[#0b111c]
                        p-4
                        transition-all
                        duration-300
                        hover:-translate-y-1
                        hover:border-cyan-900/55
                        hover:bg-[#0e1724]
                        hover:shadow-[0_12px_28px_rgba(6,182,212,0.04)]
                      "
                    >
                      <span
                        className="
                          text-[9px]
                          font-semibold
                          tracking-[0.13em]
                          text-cyan-500
                        "
                      >
                        {stage.number}
                      </span>

                      <p
                        className="
                          mt-3 text-sm
                          font-semibold
                          text-slate-200
                        "
                      >
                        {stage.title}
                      </p>

                      <p
                        className="
                          mt-2 text-xs
                          font-medium
                          text-slate-400
                        "
                      >
                        {stage.main}
                      </p>

                      <p
                        className="
                          mt-2 text-[10px]
                          leading-4
                          text-slate-600
                        "
                      >
                        {stage.detail}
                      </p>
                    </div>

                    {index < 5 && (
                      <div
                        className="
                          absolute
                          -right-2
                          top-1/2
                          z-10 hidden
                          h-px w-4
                          bg-cyan-900/45
                          xl:block
                        "
                      />
                    )}
                  </div>
                ),
              )}
            </div>


            <div
              className="
                mt-4 rounded-xl
                border border-slate-800
                bg-[#0b111c]/70
                p-4
              "
            >
              <div
                className="
                  flex items-start gap-3
                "
              >
                <span
                  className="
                    mt-1 h-2 w-2
                    shrink-0
                    rounded-full
                    bg-cyan-400
                    shadow-[0_0_10px_rgba(34,211,238,0.5)]
                  "
                />

                <div>
                  <p
                    className="
                      text-[9px]
                      uppercase
                      tracking-[0.13em]
                      text-slate-600
                    "
                  >
                    Ground Truth Isolation
                  </p>

                  <p
                    className="
                      mt-1.5 text-xs
                      leading-5
                      text-slate-400
                    "
                  >
                    {evaluation
                      .provenance
                      .ground_truth_policy}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}


        {/* ==================================================
            Incident Intelligence
            ================================================== */}

        {evaluation && (
          <section
            className="
              mt-4 grid gap-4
              xl:grid-cols-[1.15fr_0.85fr]
            "
          >
            <article
              className="
                relative overflow-hidden
                rounded-2xl
                border border-slate-700/55
                bg-[#101826]/90
                p-6
              "
            >
              <div
                className="
                  pointer-events-none
                  absolute
                  -right-20 -bottom-20
                  h-64 w-64
                  rounded-full
                  bg-emerald-400/[0.025]
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
                    text-emerald-500
                  "
                >
                  Incident Intelligence
                </p>

                <h2
                  className="
                    mt-1.5 text-xl
                    font-semibold
                    text-white
                  "
                >
                  Correlation Recovery
                </h2>

                <p
                  className="
                    mt-2 max-w-xl
                    text-xs leading-5
                    text-slate-500
                  "
                >
                  Individual anomaly detections
                  are correlated into attack
                  timelines and evaluated against
                  hidden controlled scenarios.
                </p>


                <div
                  className="
                    mt-6 grid gap-4
                    sm:grid-cols-2
                  "
                >
                  <div
                    className="
                      group rounded-2xl
                      border border-emerald-900/40
                      bg-emerald-950/[0.08]
                      p-5
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:border-emerald-800/55
                      hover:shadow-[0_16px_40px_rgba(16,185,129,0.05)]
                    "
                  >
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.13em]
                        text-emerald-500
                      "
                    >
                      Campaign Recovery
                    </p>

                    <p
                      className="
                        mt-3 text-4xl
                        font-semibold
                        tracking-tight
                        text-emerald-300
                      "
                    >
                      {evaluation
                        .incident_evaluation
                        .attack_instances_detected}
                      /
                      {evaluation
                        .incident_evaluation
                        .attack_instances_total}
                    </p>

                    <p
                      className="
                        mt-3 text-xs
                        leading-5
                        text-slate-500
                      "
                    >
                      Controlled attack campaigns
                      recovered through incident
                      correlation.
                    </p>
                  </div>


                  <div
                    className="
                      group rounded-2xl
                      border border-cyan-900/40
                      bg-cyan-950/[0.08]
                      p-5
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:border-cyan-800/55
                      hover:shadow-[0_16px_40px_rgba(6,182,212,0.05)]
                    "
                  >
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.13em]
                        text-cyan-500
                      "
                    >
                      Timeline Recovery
                    </p>

                    <p
                      className="
                        mt-3 text-4xl
                        font-semibold
                        tracking-tight
                        text-cyan-300
                      "
                    >
                      {evaluation
                        .incident_evaluation
                        .timeline_events_recovered}
                      /
                      {evaluation
                        .incident_evaluation
                        .timeline_events_total}
                    </p>

                    <p
                      className="
                        mt-3 text-xs
                        leading-5
                        text-slate-500
                      "
                    >
                      Injected attack events
                      represented across recovered
                      incident timelines.
                    </p>
                  </div>
                </div>
              </div>
            </article>


            <article
              className="
                rounded-2xl
                border border-slate-700/55
                bg-[#101826]/90
                p-6
              "
            >
              <p
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.17em]
                  text-slate-600
                "
              >
                Incident Metrics
              </p>

              <h2
                className="
                  mt-1.5 text-xl
                  font-semibold
                  text-white
                "
              >
                Correlation Quality
              </h2>


              <div
                className="
                  mt-6 grid gap-3
                  sm:grid-cols-2
                "
              >
                {[
                  {
                    label:
                      "Precision",

                    value:
                      formatPercent(
                        evaluation
                          .incident_evaluation
                          .precision,
                      ),
                  },

                  {
                    label:
                      "Recall",

                    value:
                      formatPercent(
                        evaluation
                          .incident_evaluation
                          .recall,
                      ),
                  },

                  {
                    label:
                      "F1 Score",

                    value:
                      formatPercent(
                        evaluation
                          .incident_evaluation
                          .f1_score,
                      ),
                  },

                  {
                    label:
                      "Timeline Rate",

                    value:
                      formatPercent(
                        evaluation
                          .incident_evaluation
                          .timeline_recovery_rate,
                      ),
                  },

                  {
                    label:
                      "True Positive Incidents",

                    value:
                      formatNumber(
                        evaluation
                          .incident_evaluation
                          .true_positive_incidents,
                      ),
                  },

                  {
                    label:
                      "False Positive Incidents",

                    value:
                      formatNumber(
                        evaluation
                          .incident_evaluation
                          .false_positive_incidents,
                      ),
                  },
                ].map(
                  (metric) => (
                    <div
                      key={
                        metric.label
                      }
                      className="
                        rounded-xl
                        border border-slate-800
                        bg-[#0b111c]
                        p-4
                        transition-all
                        duration-300
                        hover:-translate-y-0.5
                        hover:border-slate-700
                      "
                    >
                      <p
                        className="
                          text-[8px]
                          uppercase
                          tracking-[0.12em]
                          text-slate-600
                        "
                      >
                        {metric.label}
                      </p>

                      <p
                        className="
                          mt-2 text-lg
                          font-semibold
                          text-slate-200
                        "
                      >
                        {metric.value}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </article>
          </section>
        )}


        {/* ==================================================
            Feature Architecture
            ================================================== */}

        <section
          className="
            mt-4 rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            p-6
          "
        >
          <div
            className="
              flex flex-col gap-2
              sm:flex-row
              sm:items-end
              sm:justify-between
            "
          >
            <div>
              <p
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.17em]
                  text-slate-600
                "
              >
                Feature Engineering
              </p>

              <h2
                className="
                  mt-1.5 text-xl
                  font-semibold
                  text-white
                "
              >
                Behavioral Feature Architecture
              </h2>

              <p
                className="
                  mt-2 max-w-2xl
                  text-xs leading-5
                  text-slate-500
                "
              >
                The selected detector combines
                temporal, identity, transfer,
                rolling-window and network
                behavior without using simulator
                ground-truth labels.
              </p>
            </div>

            <p
              className="
                text-xs text-slate-600
              "
            >
              {model
                ?.feature_count
                ?? 17}
              {" "}
              production features
            </p>
          </div>


          <div
            className="
              mt-6 grid gap-4
              md:grid-cols-2
              xl:grid-cols-5
            "
          >
            {FEATURE_GROUPS.map(
              (
                group,
                index,
              ) => (
                <div
                  key={
                    group.title
                  }
                  className="
                    group relative
                    overflow-hidden
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:border-cyan-900/55
                    hover:bg-[#0e1724]
                    hover:shadow-[0_14px_32px_rgba(6,182,212,0.04)]
                  "
                >
                  <div
                    className="
                      pointer-events-none
                      absolute
                      -right-8 -top-8
                      h-20 w-20
                      rounded-full
                      bg-cyan-400/[0.025]
                      blur-2xl
                      transition-all
                      duration-300
                      group-hover:bg-cyan-400/[0.07]
                    "
                  />

                  <div
                    className="
                      relative
                    "
                  >
                    <div
                      className="
                        flex items-center gap-2
                      "
                    >
                      <span
                        className="
                          flex h-6 w-6
                          items-center
                          justify-center
                          rounded-lg
                          border border-cyan-950/60
                          bg-cyan-950/20
                          text-[8px]
                          font-semibold
                          text-cyan-400
                        "
                      >
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </span>

                      <p
                        className="
                          text-sm
                          font-semibold
                          text-slate-200
                        "
                      >
                        {group.title}
                      </p>
                    </div>

                    <p
                      className="
                        mt-3 min-h-[40px]
                        text-[11px]
                        leading-5
                        text-slate-600
                      "
                    >
                      {group.description}
                    </p>

                    <div
                      className="
                        mt-4 flex
                        flex-wrap gap-1.5
                      "
                    >
                      {group.features.map(
                        (feature) => (
                          <span
                            key={
                              feature
                            }
                            title={
                              feature
                            }
                            className="
                              rounded-md
                              border border-slate-800
                              bg-slate-950/50
                              px-2 py-1
                              text-[9px]
                              text-slate-500
                              transition-all
                              duration-200
                              group-hover:border-slate-700
                              group-hover:text-slate-400
                              hover:!border-cyan-900/60
                              hover:!text-cyan-300
                            "
                          >
                            {formatFeatureName(
                              feature,
                            )}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>


        {/* ==================================================
            Current Data + Benchmark Snapshot
            ================================================== */}

        <section
          className="
            relative mt-4
            overflow-hidden
            rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            p-5
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -right-20 -top-24
              h-64 w-64
              rounded-full
              bg-cyan-400/[0.025]
              blur-[100px]
            "
          />

          <div
            className="
              relative
              grid gap-6
              xl:grid-cols-2
            "
          >
            {/* --------------------------------------------------
                Current SENTINEL data
                -------------------------------------------------- */}

            <div>
              <p
                className="
                  text-[10px]
                  font-semibold uppercase
                  tracking-[0.16em]
                  text-cyan-500
                "
              >
                Current SENTINEL Data
              </p>

              <h2
                className="
                  mt-2 text-lg
                  font-semibold
                  text-white
                "
              >
                Current model-facing data
              </h2>

              <p
                className="
                  mt-2 max-w-xl
                  text-xs leading-5
                  text-slate-500
                "
              >
                Values currently stored by SENTINEL for
                anomaly scoring. This section describes
                available data and does not represent
                processor runtime health.
              </p>

              <div
                className="
                  mt-5 grid gap-3
                  sm:grid-cols-3
                "
              >
                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-4 py-3
                  "
                >
                  <p
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Scored Events
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {summary
                      ? formatNumber(
                          summary.events_scored,
                        )
                      : "—"}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-4 py-3
                  "
                >
                  <p
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Critical Events
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-red-300
                    "
                  >
                    {summary
                      ? formatNumber(
                          summary.alert_count,
                        )
                      : "—"}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border border-emerald-950/60
                    bg-emerald-950/10
                    px-4 py-3
                  "
                >
                  <p
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.12em]
                      text-emerald-500
                    "
                  >
                    Selected Detector
                  </p>

                  <p
                    className="
                      mt-2 text-sm
                      font-semibold
                      text-emerald-300
                    "
                  >
                    {model
                      ? `${model.model_name} v${model.model_version}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* --------------------------------------------------
                Controlled benchmark
                -------------------------------------------------- */}

            <div
              className="
                border-t border-slate-800
                pt-6
                xl:border-l
                xl:border-t-0
                xl:pl-6
                xl:pt-0
              "
            >
              <p
                className="
                  text-[10px]
                  font-semibold uppercase
                  tracking-[0.16em]
                  text-violet-400
                "
              >
                Benchmark Evidence
              </p>

              <h2
                className="
                  mt-2 text-lg
                  font-semibold
                  text-white
                "
              >
                Controlled evaluation snapshot
              </h2>

              <p
                className="
                  mt-2 max-w-xl
                  text-xs leading-5
                  text-slate-500
                "
              >
                Fixed evaluation evidence for the selected
                detector, kept separate from SENTINEL&apos;s
                current operational dataset.
              </p>

              <div
                className="
                  mt-5 grid gap-3
                  sm:grid-cols-3
                "
              >
                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-4 py-3
                  "
                >
                  <p
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Evaluation Rows
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {evaluation
                      ? formatNumber(
                          evaluation
                            .selected_model
                            .evaluation_rows,
                        )
                      : "—"}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-4 py-3
                  "
                >
                  <p
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Detector F1
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-cyan-300
                    "
                  >
                    {evaluation
                      ? formatPercent(
                          evaluation
                            .selected_model
                            .f1_score,
                        )
                      : "—"}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-4 py-3
                  "
                >
                  <p
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Timeline Recovery
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-violet-300
                    "
                  >
                    {evaluation
                      ? formatPercent(
                          evaluation
                            .incident_evaluation
                            .timeline_recovery_rate,
                        )
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            Footer
            ================================================== */}

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
            SENTINEL behavioral anomaly detection
          </p>

          <p>
            Isolation Forest{" "}

            {model
              ? `v${model.model_version}`
              : ""}

            {" · "}
            historical percentile scoring

            {" · "}
            controlled ground-truth evaluation
          </p>
        </footer>
      </div>
    </main>
  );
}


export default ModelPage;