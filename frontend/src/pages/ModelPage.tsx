import {
  useEffect,
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


const V1_FEATURES = [
  "hour_sin",
  "hour_cos",
  "outside_work_hours",
  "source_ip_is_baseline",
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
];


const FEATURE_GROUPS:
  FeatureGroup[] = [
    {
      title:
        "Temporal Behavior",

      description:
        "Captures when activity occurs relative to learned normal working patterns.",

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
        "Compares event context with the employee's behavioral baseline.",

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
        "Measures transfer size and deviation from expected employee activity.",

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
        "Tracks activity density and recent authentication or file behavior.",

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
        word.charAt(0)
        + word
          .slice(1),
    )
    .join(" ");
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
        group rounded-2xl
        border border-slate-700/55
        bg-[#101826]/90
        p-5
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-slate-600/70
        hover:bg-[#121c2b]
      "
    >
      <p
        className="
          text-[10px]
          uppercase
          tracking-[0.16em]
          text-slate-500
        "
      >
        {label}
      </p>

      <p
        className={[
          "mt-4 text-3xl",
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
          mt-2 text-xs
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

        if (
          cancelled
        ) {
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

        setError(
          null,
        );
      } catch {
        if (
          !cancelled
        ) {
          setError(
            "SENTINEL could not load model intelligence. Confirm that the FastAPI backend is running.",
          );
        }
      } finally {
        if (
          !cancelled
        ) {
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

  const rejectedExperiment:
    ModelExperimentEvaluation
    | undefined =
      evaluation
        ?.experiments
        .find(
          (experiment) =>
            !experiment.selected,
        );


  if (
    isLoading
  ) {
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
        {/* =============================================
            Header
            ============================================= */}
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
              Inspect SENTINEL's
              selected behavioral
              anomaly detector,
              evaluation performance,
              feature architecture and
              model lifecycle.
            </p>
          </div>


          <button
            type="button"
            disabled={
              isRefreshing
            }
            onClick={() => {
              void refreshModel();
            }}
            className="
              self-start
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
              lg:self-auto
            "
          >
            {isRefreshing
              ? "Refreshing..."
              : "Refresh Model"}
          </button>
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


        {/* =============================================
            Selected Model Hero
            ============================================= */}
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
                    SELECTED MODEL
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
                    PRODUCTION CANDIDATE
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
                  Isolation Forest
                  {" "}

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
                  Unsupervised behavioral
                  anomaly detection trained
                  on known-normal historical
                  enterprise activity and
                  evaluated chronologically
                  against future events.
                </p>
              </div>


              <div
                className="
                  grid gap-3
                  sm:grid-cols-3
                "
              >
                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-5 py-4
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
                    Features
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {model.feature_count}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-5 py-4
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
                    Training Rows
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {formatNumber(
                      model.training_rows,
                    )}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    px-5 py-4
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
                    Threshold
                  </p>

                  <p
                    className="
                      mt-2 text-xl
                      font-semibold
                      text-cyan-300
                    "
                  >
                    {formatPercent(
                      model
                        .threshold_percentile,
                      0,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}


        {/* =============================================
            Performance
            ============================================= */}
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
              helper="Proportion of evaluation alerts that overlapped injected attack events."
            />

            <PerformanceCard
              label="Recall"
              value={formatPercent(
                model.recall,
              )}
              helper="Proportion of controlled attack events detected by the selected model."
              accent="emerald"
            />

            <PerformanceCard
              label="F1 Score"
              value={formatPercent(
                model.f1_score,
              )}
              helper="Harmonic balance between precision and recall."
              accent="cyan"
            />

            <PerformanceCard
              label="False Positive Rate"
              value={formatPercent(
                model
                  .false_positive_rate,
                2,
              )}
              helper="Normal evaluation events that crossed the critical alert threshold."
            />
          </section>
        )}


        {/* =============================================
            Experiment Comparison
            ============================================= */}
        <section
          className="
            mt-4 grid gap-4
            xl:grid-cols-[1.1fr_0.9fr]
          "
        >
          <article
            className="
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
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
              Model Selection
            </p>

            <div
              className="
                mt-1.5 flex
                flex-col gap-2
                sm:flex-row
                sm:items-end
                sm:justify-between
              "
            >
              <h2
                className="
                  text-lg
                  font-semibold
                  text-white
                "
              >
                Experiment Comparison
              </h2>

              <p
                className="
                  text-xs
                  text-slate-600
                "
              >
                Evidence-based model selection
              </p>
            </div>


            <div
              className="
                mt-6 grid gap-4
                md:grid-cols-2
              "
            >
              {/* V1 */}
              <div
                className="
                  relative overflow-hidden
                  rounded-xl
                  border
                  border-emerald-900/50
                  bg-emerald-950/10
                  p-5
                  transition-all
                  duration-300
                  hover:-translate-y-0.5
                  hover:border-emerald-800/60
                "
              >
                <div
                  className="
                    flex items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-[0.13em]
                        text-emerald-400
                      "
                    >
                      Selected
                    </p>

                    <h3
                      className="
                        mt-1 text-lg
                        font-semibold
                        text-white
                      "
                    >
                      V1 / V1.1
                    </h3>
                  </div>

                  <span
                    className="
                      rounded-lg
                      border
                      border-emerald-800/50
                      bg-emerald-950/30
                      px-2.5 py-1.5
                      text-[9px]
                      font-semibold
                      text-emerald-300
                    "
                  >
                    WINNER
                  </span>
                </div>


                <div
                  className="
                    mt-5 grid
                    grid-cols-3 gap-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.1em]
                        text-slate-600
                      "
                    >
                      Features
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-slate-200
                      "
                    >
                      {selectedExperiment
                        ?.feature_count
                        ?? "—"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.1em]
                        text-slate-600
                      "
                    >
                      Recall
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-slate-200
                      "
                    >
                      {selectedExperiment
                        ? formatPercent(
                            selectedExperiment
                              .recall,
                          )
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.1em]
                        text-slate-600
                      "
                    >
                      F1
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-emerald-300
                      "
                    >
                      {selectedExperiment
                        ? formatPercent(
                            selectedExperiment
                              .f1_score,
                          )
                        : "—"}
                    </p>
                  </div>
                </div>


                <p
                  className="
                    mt-5 text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  {selectedExperiment
                    ?.decision
                    ?? "Selected model evaluation metadata unavailable."}
                </p>
              </div>


              {/* V2 */}
              <div
                className="
                  rounded-xl
                  border border-slate-800
                  bg-[#0b111c]
                  p-5
                  transition-all
                  duration-300
                  hover:-translate-y-0.5
                  hover:border-slate-700
                "
              >
                <div
                  className="
                    flex items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-[10px]
                        uppercase
                        tracking-[0.13em]
                        text-slate-600
                      "
                    >
                      Experiment
                    </p>

                    <h3
                      className="
                        mt-1 text-lg
                        font-semibold
                        text-white
                      "
                    >
                      V2
                    </h3>
                  </div>

                  <span
                    className="
                      rounded-lg
                      border border-slate-700
                      bg-slate-900/50
                      px-2.5 py-1.5
                      text-[9px]
                      font-semibold
                      text-slate-500
                    "
                  >
                    REJECTED
                  </span>
                </div>


                <div
                  className="
                    mt-5 grid
                    grid-cols-3 gap-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.1em]
                        text-slate-600
                      "
                    >
                      Features
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-slate-200
                      "
                    >
                      {rejectedExperiment
                        ?.feature_count
                        ?? "—"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.1em]
                        text-slate-600
                      "
                    >
                      Recall
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-slate-200
                      "
                    >
                      {rejectedExperiment
                        ? formatPercent(
                            rejectedExperiment
                              .recall,
                          )
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.1em]
                        text-slate-600
                      "
                    >
                      F1
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-slate-400
                      "
                    >
                      {rejectedExperiment
                        ? formatPercent(
                            rejectedExperiment
                              .f1_score,
                          )
                        : "—"}
                    </p>
                  </div>
                </div>


                <p
                  className="
                    mt-5 text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  {rejectedExperiment
                    ?.decision
                    ?? "Experiment evaluation metadata unavailable."}
                </p>
              </div>
            </div>


            <div
              className="
                mt-4 rounded-xl
                border border-cyan-950/45
                bg-cyan-950/10
                p-4
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
                Selection Decision
              </p>

              <p
                className="
                  mt-2 text-xs
                  leading-5
                  text-slate-400
                "
              >
                Additional features were
                not assumed to improve the
                detector. SENTINEL retained
                the simpler V1 feature set
                because controlled
                experimentation showed
                stronger precision and F1
                with identical recall.
              </p>
            </div>
          </article>


          {/* Training Strategy */}
          <article
            className="
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
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
              Experimental Design
            </p>

            <h2
              className="
                mt-1.5 text-lg
                font-semibold
                text-white
              "
            >
              Chronological Evaluation
            </h2>

            <p
              className="
                mt-2 text-xs
                leading-5
                text-slate-500
              "
            >
              SENTINEL avoids a random
              train/test split because
              security telemetry is
              temporal. The detector learns
              historical normal behavior
              before evaluating future
              activity.
            </p>


            <div
              className="
                mt-6
              "
            >
              <div
                className="
                  rounded-xl
                  border border-emerald-900/45
                  bg-emerald-950/10
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
                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.13em]
                        text-emerald-400
                      "
                    >
                      Training Baseline
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-white
                      "
                    >
                      Aug 24, 2026
                    </p>
                  </div>

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-300
                    "
                  >
                    {model
                      ? formatNumber(
                          model.training_rows,
                        )
                      : "1,938"}
                  </p>
                </div>

                <p
                  className="
                    mt-3 text-xs
                    text-slate-500
                  "
                >
                  Known-normal historical
                  behavior only.
                </p>
              </div>


              <div
                className="
                  mx-auto h-8 w-px
                  bg-gradient-to-b
                  from-emerald-800/60
                  to-cyan-900/60
                "
              />


              <div
                className="
                  rounded-xl
                  border border-cyan-900/45
                  bg-cyan-950/10
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
                  <div>
                    <p
                      className="
                        text-[9px]
                        uppercase
                        tracking-[0.13em]
                        text-cyan-400
                      "
                    >
                      Future Evaluation
                    </p>

                    <p
                      className="
                        mt-1 text-sm
                        font-semibold
                        text-white
                      "
                    >
                      Aug 25–26, 2026
                    </p>
                  </div>

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-300
                    "
                  >
                    {model
                      ? formatNumber(
                          model.evaluation_rows,
                        )
                      : "4,030"}
                  </p>
                </div>

                <p
                  className="
                    mt-3 text-xs
                    text-slate-500
                  "
                >
                  Future normal and
                  controlled attack traffic.
                </p>
              </div>
            </div>


            <div
              className="
                mt-5 rounded-xl
                border border-slate-800
                bg-[#0b111c]
                p-4
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
                Ground Truth Policy
              </p>

              <p
                className="
                  mt-2 text-xs
                  leading-5
                  text-slate-400
                "
              >
                Simulator attack labels
                are used only after scoring
                for evaluation. They never
                enter model features or
                model fitting.
              </p>
            </div>
          </article>
        </section>


        {/* =============================================
            Feature Architecture
            ============================================= */}
        <section
          className="
            mt-4 rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            p-5
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
                  mt-1.5 text-lg
                  font-semibold
                  text-white
                "
              >
                Behavioral Feature Architecture
              </h2>
            </div>

            <p
              className="
                text-xs text-slate-600
              "
            >
              {V1_FEATURES.length}
              {" "}
              selected production features
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
              (group) => (
                <div
                  key={
                    group.title
                  }
                  className="
                    group rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:border-cyan-900/45
                    hover:bg-[#111a28]
                  "
                >
                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-200
                    "
                  >
                    {group.title}
                  </p>

                  <p
                    className="
                      mt-2 text-[11px]
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
                            transition-colors
                            group-hover:border-slate-700
                            group-hover:text-slate-400
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
              ),
            )}
          </div>
        </section>


        {/* =============================================
            Model Lifecycle
            ============================================= */}
        <section
          className="
            mt-4 rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            p-5
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
            Model Lifecycle
          </p>

          <h2
            className="
              mt-1.5 text-lg
              font-semibold
              text-white
            "
          >
            Production Detection Pipeline
          </h2>


          <div
            className="
              mt-6 grid gap-3
              md:grid-cols-3
              xl:grid-cols-6
            "
          >
            {[
              {
                number: "01",
                title: "Dataset",
                detail:
                  "5,970 engineered event rows",
              },

              {
                number: "02",
                title: "Experiment",
                detail:
                  "V1 and V2 feature sets",
              },

              {
                number: "03",
                title: "Evaluate",
                detail:
                  "Chronological future test",
              },

              {
                number: "04",
                title: "Select",
                detail:
                  "V1 wins on F1 and precision",
              },

              {
                number: "05",
                title: "Version",
                detail:
                  "Frozen V1.1 model artifact",
              },

              {
                number: "06",
                title: "Operationalize",
                detail:
                  "5,970 persisted ML scores",
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
                    relative
                  "
                >
                  <div
                    className="
                      group h-full
                      rounded-xl
                      border border-slate-800
                      bg-[#0b111c]
                      p-4
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:border-cyan-900/45
                      hover:bg-[#111a28]
                    "
                  >
                    <span
                      className="
                        text-[9px]
                        font-semibold
                        tracking-[0.12em]
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
                        mt-2 text-[11px]
                        leading-5
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
        </section>


        {/* =============================================
            Operational State
            ============================================= */}
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
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-600
              "
            >
              Operational Coverage
            </p>

            <p
              className="
                mt-3 text-2xl
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

            <p
              className="
                mt-2 text-xs
                leading-5
                text-slate-500
              "
            >
              Events currently stored
              with Isolation Forest v1.1
              analysis.
            </p>
          </div>


          <div
            className="
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              p-5
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-600
              "
            >
              Critical Boundary
            </p>

            <p
              className="
                mt-3 text-2xl
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

            <p
              className="
                mt-2 text-xs
                leading-5
                text-slate-500
              "
            >
              Events currently at or
              above the selected
              99th-percentile alert
              threshold.
            </p>
          </div>


          <div
            className="
              rounded-2xl
              border
              border-emerald-900/40
              bg-emerald-950/10
              p-5
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-emerald-500
              "
            >
              Detector State
            </p>

            <div
              className="
                mt-3 flex
                items-center gap-2
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

              <p
                className="
                  text-lg
                  font-semibold
                  text-emerald-300
                "
              >
                Operational
              </p>
            </div>

            <p
              className="
                mt-2 text-xs
                leading-5
                text-slate-500
              "
            >
              Versioned model schema,
              preprocessing configuration
              and training reference are
              preserved with the artifact.
            </p>
          </div>
        </section>


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
            SENTINEL behavioral
            anomaly detection
          </p>

          <p>
            Isolation Forest
            {" "}
            {model
              ? `v${model.model_version}`
              : ""}
            {" · "}
            historical percentile scoring
            {" · "}
            ground truth evaluation only
          </p>
        </footer>
      </div>
    </main>
  );
}


export default ModelPage;
