import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getMLAnomalyPage,
  getMLEventAnalysis,
  getMLModelInfo,
  getMLSummary,
} from "../services/api";

import type {
  MLAnomaly,
  MLEventAnalysis,
  MLModelInfo,
  MLRiskLevel,
  MLSummary,
} from "../types/api";


type RiskFilter =
  | "ALL"
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";


const RISK_STYLES: Record<
  MLRiskLevel,
  {
    badge: string;
    dot: string;
    bar: string;
    border: string;
    selected: string;
    text: string;
  }
> = {
  NORMAL: {
    badge:
      "border-slate-700 bg-slate-800/70 text-slate-300",

    dot:
      "bg-slate-400",

    bar:
      "bg-slate-500",

    border:
      "border-slate-800",

    selected:
      "border-slate-700 bg-slate-800/30",

    text:
      "text-slate-300",
  },

  LOW: {
    badge:
      "border-cyan-800/60 bg-cyan-950/35 text-cyan-300",

    dot:
      "bg-cyan-400",

    bar:
      "bg-cyan-500",

    border:
      "border-cyan-950/45",

    selected:
      "border-cyan-800/50 bg-cyan-950/15",

    text:
      "text-cyan-300",
  },

  MEDIUM: {
    badge:
      "border-amber-800/60 bg-amber-950/30 text-amber-300",

    dot:
      "bg-amber-400",

    bar:
      "bg-amber-500",

    border:
      "border-amber-950/40",

    selected:
      "border-amber-800/45 bg-amber-950/10",

    text:
      "text-amber-300",
  },

  HIGH: {
    badge:
      "border-orange-800/70 bg-orange-950/35 text-orange-300",

    dot:
      "bg-orange-400",

    bar:
      "bg-orange-500",

    border:
      "border-orange-950/45",

    selected:
      "border-orange-800/50 bg-orange-950/15",

    text:
      "text-orange-300",
  },

  CRITICAL: {
    badge:
      "border-red-800/70 bg-red-950/45 text-red-300",

    dot:
      "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.65)]",

    bar:
      "bg-red-500",

    border:
      "border-red-950/50",

    selected:
      "border-red-800/60 bg-red-950/20",

    text:
      "text-red-300",
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
      second: "2-digit",
    },
  );
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


function getNumberFeature(
  analysis: MLEventAnalysis,
  feature: string,
): number | null {
  const value =
    analysis.feature_snapshot[
      feature
    ];

  return typeof value
    === "number"
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
        "inline-flex items-center",
        "rounded-full border",
        "px-2.5 py-1",
        "text-[10px]",
        "font-semibold",
        "tracking-[0.12em]",
        RISK_STYLES[
          risk
        ].badge,
      ].join(" ")}
    >
      {risk}
    </span>
  );
}


function StatCard({
  eyebrow,
  value,
  label,
  tone = "default",
}: {
  eyebrow: string;
  value: string;
  label: string;

  tone?:
    | "default"
    | "critical"
    | "cyan";
}) {
  return (
    <div
      className="
        group relative
        overflow-hidden
        rounded-2xl
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
      <div
        className={[
          "absolute inset-x-0 top-0",
          "h-px",
          tone === "critical"
            ? (
              "bg-gradient-to-r "
              + "from-transparent "
              + "via-red-500 "
              + "to-transparent"
            )
            : tone === "cyan"
              ? (
                "bg-gradient-to-r "
                + "from-transparent "
                + "via-cyan-400 "
                + "to-transparent"
              )
              : (
                "bg-gradient-to-r "
                + "from-transparent "
                + "via-slate-500/50 "
                + "to-transparent"
              ),
        ].join(" ")}
      />

      <p
        className="
          text-[10px]
          uppercase
          tracking-[0.16em]
          text-slate-500
        "
      >
        {eyebrow}
      </p>

      <p
        className={[
          "mt-4 text-3xl",
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
          mt-2 text-sm
          text-slate-400
        "
      >
        {label}
      </p>
    </div>
  );
}


function SignalCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border",
        "p-4",
        "transition-all",
        "duration-200",
        "hover:-translate-y-0.5",
        warning
          ? (
            "border-red-900/55 "
            + "bg-red-950/15"
          )
          : (
            "border-slate-800 "
            + "bg-[#0b111c] "
            + "hover:border-slate-700 "
            + "hover:bg-[#111a28]"
          ),
      ].join(" ")}
    >
      <p
        className="
          text-[9px]
          uppercase
          tracking-[0.13em]
          text-slate-600
        "
      >
        {label}
      </p>

      <p
        className={[
          "mt-2 text-lg",
          "font-semibold",
          warning
            ? "text-red-300"
            : "text-slate-100",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}


function AnomaliesPage() {
  const PAGE_SIZE = 50;

  const [
    summary,
    setSummary,
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
    anomalies,
    setAnomalies,
  ] = useState<
    MLAnomaly[]
  >([]);

  const [
    totalResults,
    setTotalResults,
  ] = useState(0);

  const [
    currentOffset,
    setCurrentOffset,
  ] = useState(0);

  const [
    hasPrevious,
    setHasPrevious,
  ] = useState(false);

  const [
    hasNext,
    setHasNext,
  ] = useState(false);

  const [
    appliedSearch,
    setAppliedSearch,
  ] = useState("");

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState<
    string | null
  >(null);

  const [
    analysis,
    setAnalysis,
  ] = useState<
    MLEventAnalysis | null
  >(null);

  const [
    riskFilter,
    setRiskFilter,
  ] = useState<
    RiskFilter
  >("ALL");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    analysisLoading,
    setAnalysisLoading,
  ] = useState(false);

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
          mlSummary,
          modelInfo,
          anomalyPage,
        ] = await Promise.all([
          getMLSummary(),
          getMLModelInfo(),

          getMLAnomalyPage({
            limit:
              PAGE_SIZE,

            offset:
              0,
          }),
        ]);

        if (
          cancelled
        ) {
          return;
        }

        setSummary(
          mlSummary,
        );

        setModel(
          modelInfo,
        );

        setAnomalies(
          anomalyPage.items,
        );

        setTotalResults(
          anomalyPage.total,
        );

        setCurrentOffset(
          anomalyPage.offset,
        );

        setHasPrevious(
          anomalyPage.has_previous,
        );

        setHasNext(
          anomalyPage.has_next,
        );

        if (
          anomalyPage.items.length > 0
        ) {
          const first =
            anomalyPage.items[0];

          const firstAnalysis =
            await getMLEventAnalysis(
              first.event_id,
            );

          if (
            cancelled
          ) {
            return;
          }

          setSelectedEventId(
            first.event_id,
          );

          setAnalysis(
            firstAnalysis,
          );
        }

        setError(
          null,
        );
      } catch {
        if (
          !cancelled
        ) {
          setError(
            "SENTINEL could not load anomaly intelligence. Confirm that the backend and PostgreSQL are running.",
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


  async function selectAnomaly(
    eventId: string,
  ) {
    if (
      eventId
      === selectedEventId
    ) {
      return;
    }

    setSelectedEventId(
      eventId,
    );

    setAnalysisLoading(
      true,
    );

    try {
      const result =
        await getMLEventAnalysis(
          eventId,
        );

      setAnalysis(
        result,
      );

      setError(
        null,
      );
    } catch {
      setError(
        "SENTINEL could not load the selected anomaly analysis.",
      );
    } finally {
      setAnalysisLoading(
        false,
      );
    }
  }


  async function loadFeed(
    options: {
      risk:
        RiskFilter;

      search: string;

      offset: number;
    },
  ) {
    const page =
      await getMLAnomalyPage({
        riskLevel:
          options.risk
            === "ALL"
            ? undefined
            : options.risk,

        search:
          options.search
          || undefined,

        limit:
          PAGE_SIZE,

        offset:
          options.offset,
      });

    setAnomalies(
      page.items,
    );

    setTotalResults(
      page.total,
    );

    setCurrentOffset(
      page.offset,
    );

    setHasPrevious(
      page.has_previous,
    );

    setHasNext(
      page.has_next,
    );

    if (
      page.items.length > 0
    ) {
      const currentStillVisible =
        page.items.some(
          (item) =>
            item.event_id
            === selectedEventId,
        );

      if (
        !currentStillVisible
      ) {
        const first =
          page.items[0];

        const result =
          await getMLEventAnalysis(
            first.event_id,
          );

        setSelectedEventId(
          first.event_id,
        );

        setAnalysis(
          result,
        );
      }
    } else {
      setSelectedEventId(
        null,
      );

      setAnalysis(
        null,
      );
    }
  }


  async function refreshAnomalies() {
    setIsRefreshing(
      true,
    );

    try {
      const [
        mlSummary,
        modelInfo,
        anomalyPage,
      ] = await Promise.all([
        getMLSummary(),
        getMLModelInfo(),

        getMLAnomalyPage({
          riskLevel:
            riskFilter
              === "ALL"
              ? undefined
              : riskFilter,

          search:
            appliedSearch
            || undefined,

          limit:
            PAGE_SIZE,

          offset:
            currentOffset,
        }),
      ]);

      setSummary(
        mlSummary,
      );

      setModel(
        modelInfo,
      );

      setAnomalies(
        anomalyPage.items,
      );

      setTotalResults(
        anomalyPage.total,
      );

      setCurrentOffset(
        anomalyPage.offset,
      );

      setHasPrevious(
        anomalyPage.has_previous,
      );

      setHasNext(
        anomalyPage.has_next,
      );

      setError(
        null,
      );
    } catch {
      setError(
        "SENTINEL could not refresh anomaly intelligence.",
      );
    } finally {
      setIsRefreshing(
        false,
      );
    }
  }


  const riskFilters:
    RiskFilter[] = [
      "ALL",
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
    ];


  const riskCounts = {
    ALL:
      summary
        ? (
          summary
            .risk_distribution
            .critical
          + summary
            .risk_distribution
            .high
          + summary
            .risk_distribution
            .medium
          + summary
            .risk_distribution
            .low
        )
        : 0,

    CRITICAL:
      summary
        ?.risk_distribution
        .critical
      ?? 0,

    HIGH:
      summary
        ?.risk_distribution
        .high
      ?? 0,

    MEDIUM:
      summary
        ?.risk_distribution
        .medium
      ?? 0,

    LOW:
      summary
        ?.risk_distribution
        .low
      ?? 0,
  };


  const riskDistribution =
    useMemo(() => {
      if (
        !summary
      ) {
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
        (item) => ({
          ...item,

          percentage:
            item.count
            / total,
        }),
      );
    }, [
      summary,
    ]);


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
            Loading Anomaly Intelligence
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
        {/* Header */}
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
                Behavioral Detection
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
              Anomaly Intelligence
            </h1>

            <p
              className="
                mt-3 max-w-3xl
                text-sm leading-6
                text-slate-500
              "
            >
              Explore behavioral
              anomaly percentiles,
              ranked detections and
              observable signals identified
              by Isolation Forest.
            </p>
          </div>


          <button
            type="button"
            disabled={
              isRefreshing
            }
            onClick={() => {
              void refreshAnomalies();
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
              : "Refresh Detections"}
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


        {/* Top metrics */}
        <section
          className="
            mt-7 grid gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <StatCard
            eyebrow="Telemetry"
            value={
              summary
                ? formatNumber(
                    summary
                      .events_scored,
                  )
                : "—"
            }
            label="Events Scored"
            tone="cyan"
          />

          <StatCard
            eyebrow="Alerting"
            value={
              summary
                ? formatNumber(
                    summary
                      .alert_count,
                  )
                : "—"
            }
            label="Critical ML Signals"
            tone="critical"
          />

          <StatCard
            eyebrow="Population"
            value={
              summary
                ? formatPercent(
                    summary
                      .average_score,
                  )
                : "—"
            }
            label="Mean Anomaly Percentile"
          />

          <StatCard
            eyebrow="Model Threshold"
            value={
              model
                ? formatPercent(
                    model
                      .threshold_percentile,
                    0,
                  )
                : "—"
            }
            label="Critical Alert Boundary"
            tone="cyan"
          />
        </section>


        {/* Risk distribution */}
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
              flex flex-col gap-3
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
                Behavioral Population
              </p>

              <h2
                className="
                  mt-1.5 text-lg
                  font-semibold
                  text-white
                "
              >
                Risk Distribution
              </h2>
            </div>

            <p
              className="
                text-xs
                text-slate-600
              "
            >
              Historical anomaly percentiles,
              not attack probabilities
            </p>
          </div>


          <div
            className="
              mt-6 grid gap-4
              lg:grid-cols-5
            "
          >
            {riskDistribution.map(
              ({
                risk,
                count,
                percentage,
              }) => (
                <div
                  key={
                    risk
                  }
                  className="
                    group rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:border-slate-700
                    hover:bg-[#111a28]
                  "
                >
                  <div
                    className="
                      flex items-center
                      justify-between
                      gap-2
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
                          RISK_STYLES[
                            risk
                          ].dot,
                        ].join(" ")}
                      />

                      <span
                        className="
                          text-[10px]
                          font-semibold
                          tracking-[0.1em]
                          text-slate-400
                        "
                      >
                        {risk}
                      </span>
                    </div>

                    <span
                      className="
                        text-xs
                        font-semibold
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
                      mt-4 h-1.5
                      overflow-hidden
                      rounded-full
                      bg-slate-800
                    "
                  >
                    <div
                      className={[
                        "h-full",
                        "rounded-full",
                        RISK_STYLES[
                          risk
                        ].bar,
                      ].join(" ")}
                      style={{
                        width:
                          `${Math.max(
                            percentage
                            * 100,
                            percentage > 0
                              ? 1
                              : 0,
                          )}%`,
                      }}
                    />
                  </div>

                  <p
                    className="
                      mt-3 text-xs
                      text-slate-600
                    "
                  >
                    {formatPercent(
                      percentage,
                    )}
                    {" "}
                    of scored events
                  </p>
                </div>
              ),
            )}
          </div>
        </section>


        {/* Filters */}
        <section
          className="
            mt-4 flex
            flex-col gap-3
            rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            p-4
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          <div
            className="
              flex flex-wrap gap-2
            "
          >
            {riskFilters.map(
              (risk) => {
                const active =
                  riskFilter
                  === risk;

                return (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => {
                      setRiskFilter(
                        risk,
                      );

                      void loadFeed({
                        risk,
                        search:
                          appliedSearch,
                        offset:
                          0,
                      });
                    }}
                    className={[
                      "rounded-lg border",
                      "px-3 py-2",
                      "text-[10px]",
                      "font-semibold",
                      "tracking-[0.11em]",
                      "transition-all",
                      active
                        ? (
                          "border-cyan-800/70 "
                          + "bg-cyan-950/30 "
                          + "text-cyan-300"
                        )
                        : (
                          "border-slate-800 "
                          + "bg-[#0b111c] "
                          + "text-slate-500 "
                          + "hover:border-slate-700 "
                          + "hover:text-slate-300"
                        ),
                    ].join(" ")}
                  >
                    {risk}

                    <span
                      className="
                        ml-1
                        text-slate-600
                      "
                    >
                      {
                        riskCounts[
                          risk
                        ]
                      }
                    </span>
                  </button>
                );
              },
            )}
          </div>


          <div
            className="
              flex w-full
              gap-2
              lg:max-w-sm
            "
          >
            <input
              type="search"
              value={
                searchQuery
              }
              onChange={
                (event) =>
                  setSearchQuery(
                    event.target.value,
                  )
              }
              onKeyDown={
                (event) => {
                  if (
                    event.key
                    === "Enter"
                  ) {
                    const value =
                      searchQuery
                        .trim();

                    setAppliedSearch(
                      value,
                    );

                    void loadFeed({
                      risk:
                        riskFilter,

                      search:
                        value,

                      offset:
                        0,
                    });
                  }
                }
              }
              placeholder="Search all anomalies..."
              className="
                min-w-0 flex-1
                rounded-xl
                border border-slate-800
                bg-[#0b111c]
                px-4 py-2.5
                text-xs text-slate-200
                outline-none
                transition-all
                placeholder:text-slate-700
                focus:border-cyan-900
                focus:ring-2
                focus:ring-cyan-950/40
              "
            />

            <button
              type="button"
              onClick={() => {
                const value =
                  searchQuery
                    .trim();

                setAppliedSearch(
                  value,
                );

                void loadFeed({
                  risk:
                    riskFilter,

                  search:
                    value,

                  offset:
                    0,
                });
              }}
              className="
                rounded-xl
                border border-cyan-900/60
                bg-cyan-950/20
                px-4 py-2.5
                text-xs font-medium
                text-cyan-300
                transition-all
                hover:bg-cyan-950/35
              "
            >
              Search
            </button>
          </div>
        </section>


        {/* Main intelligence workspace */}
        <section
          className="
            mt-4 grid gap-4
            2xl:grid-cols-[1.25fr_0.75fr]
          "
        >
          {/* Anomaly list */}
          <article
            className="
              overflow-hidden
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
            "
          >
            <div
              className="
                flex items-center
                justify-between
                border-b border-slate-800
                px-5 py-4
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
                  Ranked Intelligence
                </p>

                <h2
                  className="
                    mt-1 text-lg
                    font-semibold
                    text-white
                  "
                >
                  Behavioral Anomalies
                </h2>
              </div>

              <span
                className="
                  rounded-lg
                  border border-slate-800
                  bg-[#0b111c]
                  px-2.5 py-1.5
                  text-xs
                  font-semibold
                  text-slate-400
                "
              >
                {totalResults}
              </span>
            </div>


            <div
              className="
                max-h-[760px]
                overflow-y-auto
              "
            >
              {anomalies.map(
                (anomaly) => {
                  const selected =
                    anomaly.event_id
                    === selectedEventId;

                  return (
                    <button
                      key={
                        anomaly.score_id
                      }
                      type="button"
                      onClick={() => {
                        void selectAnomaly(
                          anomaly.event_id,
                        );
                      }}
                      className={[
                        "group block w-full",
                        "border-b",
                        "border-slate-800/70",
                        "px-5 py-4",
                        "text-left",
                        "transition-all",
                        "duration-200",
                        selected
                          ? RISK_STYLES[
                              anomaly
                                .risk_level
                            ].selected
                          : (
                            "hover:bg-[#141e2d]"
                          ),
                      ].join(" ")}
                    >
                      <div
                        className="
                          grid gap-3
                          lg:grid-cols-[120px_1fr_140px_110px]
                          lg:items-center
                        "
                      >
                        <RiskBadge
                          risk={
                            anomaly
                              .risk_level
                          }
                        />

                        <div>
                          <div
                            className="
                              flex flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <span
                              className="
                                font-mono
                                text-[9px]
                                text-cyan-500
                              "
                            >
                              {
                                anomaly
                                  .event_id
                              }
                            </span>

                            <span
                              className="
                                text-[10px]
                                uppercase
                                tracking-[0.1em]
                                text-slate-600
                              "
                            >
                              {formatEventType(
                                anomaly
                                  .event_type,
                              )}
                            </span>
                          </div>

                          <p
                            className="
                              mt-1 text-xs
                              text-slate-500
                            "
                          >
                            {
                              anomaly
                                .employee_user_id
                            }
                          </p>
                        </div>

                        <div>
                          <p
                            className="
                              text-[9px]
                              uppercase
                              tracking-[0.12em]
                              text-slate-600
                            "
                          >
                            Percentile
                          </p>

                          <p
                            className="
                              mt-1 text-sm
                              font-semibold
                              text-slate-200
                            "
                          >
                            {formatPercent(
                              anomaly
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
                          {formatTimestamp(
                            anomaly
                              .timestamp,
                          )}
                        </p>
                      </div>
                    </button>
                  );
                },
              )}
            </div>


            <div
              className="
                flex flex-col gap-3
                border-t border-slate-800
                px-5 py-4
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <p
                className="
                  text-xs
                  text-slate-600
                "
              >
                Showing{" "}

                {totalResults === 0
                  ? 0
                  : currentOffset + 1}

                {"–"}

                {Math.min(
                  currentOffset
                  + anomalies.length,
                  totalResults,
                )}

                {" of "}

                {formatNumber(
                  totalResults,
                )}
              </p>


              <div
                className="
                  flex gap-2
                "
              >
                <button
                  type="button"
                  disabled={
                    !hasPrevious
                  }
                  onClick={() => {
                    const nextOffset =
                      Math.max(
                        0,
                        currentOffset
                        - PAGE_SIZE,
                      );

                    void loadFeed({
                      risk:
                        riskFilter,

                      search:
                        appliedSearch,

                      offset:
                        nextOffset,
                    });
                  }}
                  className="
                    rounded-lg
                    border border-slate-800
                    bg-[#0b111c]
                    px-3 py-2
                    text-xs
                    text-slate-400
                    transition-all
                    hover:border-cyan-900/60
                    hover:text-cyan-300
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                  "
                >
                  ← Previous
                </button>


                <button
                  type="button"
                  disabled={
                    !hasNext
                  }
                  onClick={() => {
                    const nextOffset =
                      currentOffset
                      + PAGE_SIZE;

                    void loadFeed({
                      risk:
                        riskFilter,

                      search:
                        appliedSearch,

                      offset:
                        nextOffset,
                    });
                  }}
                  className="
                    rounded-lg
                    border border-slate-800
                    bg-[#0b111c]
                    px-3 py-2
                    text-xs
                    text-slate-400
                    transition-all
                    hover:border-cyan-900/60
                    hover:text-cyan-300
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                  "
                >
                  Next →
                </button>
              </div>
            </div>
          </article>


          {/* Selected analysis */}
          <aside
            className="
              2xl:sticky
              2xl:top-5
              2xl:self-start
            "
          >
            {analysisLoading && (
              <div
                className="
                  flex min-h-[500px]
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-slate-700/55
                  bg-[#101826]/90
                "
              >
                <div
                  className="
                    h-8 w-8
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
              && analysis && (
                <div
                  key={
                    analysis.event_id
                  }
                  className="
                    sentinel-page-enter
                    space-y-4
                  "
                >
                  <article
                    className={[
                      "rounded-2xl border",
                      "bg-[#101826]/90",
                      "p-5",
                      RISK_STYLES[
                        analysis
                          .risk_level
                      ].border,
                    ].join(" ")}
                  >
                    <div
                      className="
                        flex items-start
                        justify-between
                        gap-3
                      "
                    >
                      <div>
                        <p
                          className="
                            font-mono
                            text-[10px]
                            text-cyan-400
                          "
                        >
                          {
                            analysis
                              .event_id
                          }
                        </p>

                        <h2
                          className="
                            mt-2 text-xl
                            font-semibold
                            text-white
                          "
                        >
                          {formatEventType(
                            analysis
                              .event_type,
                          )}
                        </h2>

                        <p
                          className="
                            mt-1 text-xs
                            text-slate-600
                          "
                        >
                          {
                            analysis
                              .employee_user_id
                          }
                          {" · "}
                          {formatTimestamp(
                            analysis
                              .timestamp,
                          )}
                        </p>
                      </div>

                      <RiskBadge
                        risk={
                          analysis
                            .risk_level
                        }
                      />
                    </div>


                    <div
                      className="
                        mt-6
                      "
                    >
                      <div
                        className="
                          flex items-end
                          justify-between
                          gap-4
                        "
                      >
                        <div>
                          <p
                            className="
                              text-[9px]
                              uppercase
                              tracking-[0.13em]
                              text-slate-600
                            "
                          >
                            Anomaly Percentile
                          </p>

                          <p
                            className={[
                              "mt-1 text-4xl",
                              "font-semibold",
                              RISK_STYLES[
                                analysis
                                  .risk_level
                              ].text,
                            ].join(" ")}
                          >
                            {formatPercent(
                              analysis
                                .anomaly_score,
                              1,
                            )}
                          </p>
                        </div>

                        <p
                          className="
                            text-xs
                            text-slate-600
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
                          mt-4 h-2
                          overflow-hidden
                          rounded-full
                          bg-slate-800
                        "
                      >
                        <div
                          className={[
                            "h-full",
                            "rounded-full",
                            RISK_STYLES[
                              analysis
                                .risk_level
                            ].bar,
                          ].join(" ")}
                          style={{
                            width:
                              `${analysis.anomaly_score * 100}%`,
                          }}
                        />
                      </div>

                      <p
                        className="
                          mt-4 text-xs
                          leading-5
                          text-slate-500
                        "
                      >
                        Historical anomaly
                        percentile relative to
                        the model's learned
                        normal baseline. This
                        value is not an attack
                        probability.
                      </p>
                    </div>
                  </article>


                  <article
                    className="
                      rounded-2xl
                      border
                      border-slate-700/55
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
                      Behavioral Evidence
                    </p>

                    <h3
                      className="
                        mt-1.5 text-lg
                        font-semibold
                        text-white
                      "
                    >
                      Feature Signals
                    </h3>


                    <div
                      className="
                        mt-5 grid
                        grid-cols-2 gap-3
                      "
                    >
                      <SignalCard
                        label="Failed Logins / 10m"
                        value={String(
                          getNumberFeature(
                            analysis,
                            "failed_logins_10m",
                          )
                          ?? "—",
                        )}
                        warning={
                          (
                            getNumberFeature(
                              analysis,
                              "failed_logins_10m",
                            )
                            ?? 0
                          ) > 0
                        }
                      />

                      <SignalCard
                        label="Events / 5m"
                        value={String(
                          getNumberFeature(
                            analysis,
                            "events_5m",
                          )
                          ?? "—",
                        )}
                      />

                      <SignalCard
                        label="Network Events / 5m"
                        value={String(
                          getNumberFeature(
                            analysis,
                            "network_events_5m",
                          )
                          ?? "—",
                        )}
                      />

                      <SignalCard
                        label="Unique Destinations"
                        value={String(
                          getNumberFeature(
                            analysis,
                            "unique_destinations_5m",
                          )
                          ?? "—",
                        )}
                        warning={
                          (
                            getNumberFeature(
                              analysis,
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
                            analysis,
                            "outside_work_hours",
                          )
                          === 1
                            ? "YES"
                            : "NO"
                        }
                        warning={
                          getNumberFeature(
                            analysis,
                            "outside_work_hours",
                          )
                          === 1
                        }
                      />

                      <SignalCard
                        label="Baseline Source IP"
                        value={
                          getNumberFeature(
                            analysis,
                            "source_ip_is_baseline",
                          )
                          === 1
                            ? "YES"
                            : "NO"
                        }
                        warning={
                          getNumberFeature(
                            analysis,
                            "source_ip_is_baseline",
                          )
                          === 0
                        }
                      />

                      <SignalCard
                        label="File Events / 30m"
                        value={String(
                          getNumberFeature(
                            analysis,
                            "file_events_30m",
                          )
                          ?? "—",
                        )}
                      />

                      <SignalCard
                        label="Data Volume Ratio"
                        value={
                          getNumberFeature(
                            analysis,
                            "data_volume_ratio",
                          ) !== null
                            ? (
                              getNumberFeature(
                                analysis,
                                "data_volume_ratio",
                              )
                              ?? 0
                            ).toFixed(4)
                            : "—"
                        }
                      />
                    </div>
                  </article>


                  <article
                    className="
                      rounded-2xl
                      border
                      border-slate-700/55
                      bg-[#101826]/90
                      p-5
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
                            tracking-[0.17em]
                            text-slate-600
                          "
                        >
                          Detector Context
                        </p>

                        <h3
                          className="
                            mt-1.5 text-lg
                            font-semibold
                            text-white
                          "
                        >
                          Isolation Forest Analysis
                        </h3>
                      </div>

                      <span
                        className="
                          rounded-lg
                          border
                          border-cyan-900/60
                          bg-cyan-950/25
                          px-2.5 py-1.5
                          text-[10px]
                          font-semibold
                          text-cyan-300
                        "
                      >
                        v{
                          analysis
                            .detector_version
                        }
                      </span>
                    </div>

                    <p
                      className="
                        mt-4 text-xs
                        leading-5
                        text-slate-500
                      "
                    >
                      {
                        analysis
                          .explanation
                          .summary
                      }
                    </p>

                    <div
                      className="
                        mt-4 grid
                        grid-cols-2 gap-3
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
                            text-[9px]
                            uppercase
                            tracking-[0.12em]
                            text-slate-600
                          "
                        >
                          Raw Score
                        </p>

                        <p
                          className="
                            mt-2 font-mono
                            text-sm
                            text-slate-300
                          "
                        >
                          {
                            analysis
                              .raw_score
                              .toFixed(6)
                          }
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
                            text-[9px]
                            uppercase
                            tracking-[0.12em]
                            text-slate-600
                          "
                        >
                          Recorded Features
                        </p>

                        <p
                          className="
                            mt-2 text-sm
                            font-semibold
                            text-slate-300
                          "
                        >
                          {Object.keys(
                            analysis
                              .feature_snapshot,
                          ).length}
                        </p>
                      </div>
                    </div>
                  </article>
                </div>
              )}
          </aside>
        </section>


        <footer
          className="
            mt-6 border-t
            border-slate-800/70
            py-5
            text-[11px]
            text-slate-600
          "
        >
          SENTINEL operational
          anomaly views display
          observable features and
          ML outputs only. Simulator
          attack labels remain
          evaluation-only.
        </footer>
      </div>
    </main>
  );
}


export default AnomaliesPage;
