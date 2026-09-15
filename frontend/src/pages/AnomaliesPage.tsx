import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getMLAnomalyPage,
  getMLModelInfo,
  getMLSummary,
} from "../services/api";

import type {
  MLAnomaly,
  MLModelInfo,
  MLSummary,
} from "../types/api";

import AnomalyFilters, {
  type AnomalyRiskFilter,
} from "../components/anomalies/AnomalyFilters";

import AnomalyQueue from "../components/anomalies/AnomalyQueue";
import AnomalyRiskDistribution from "../components/anomalies/AnomalyRiskDistribution";
import AnomalyStatCard from "../components/anomalies/AnomalyStatCard";

import {
  formatAnomalyNumber,
  formatAnomalyPercent,
} from "../components/anomalies/anomalyFormatters";


const PAGE_SIZE =
  50;


function formatRefreshLabel(
  ageSeconds: number,
  refreshedAt: number | null,
): string {
  if (
    refreshedAt === null
  ) {
    return "Waiting for refresh";
  }

  if (
    ageSeconds < 5
  ) {
    return "Refreshed just now";
  }

  if (
    ageSeconds < 60
  ) {
    return `Refreshed ${ageSeconds}s ago`;
  }

  if (
    ageSeconds < 3600
  ) {
    const minutes =
      Math.floor(
        ageSeconds / 60,
      );

    return `Refreshed ${minutes} ${
      minutes === 1
        ? "min"
        : "mins"
    } ago`;
  }

  const formattedTime =
    new Date(
      refreshedAt,
    ).toLocaleTimeString(
      undefined,
      {
        hour:
          "numeric",

        minute:
          "2-digit",
      },
    );

  return `Last refreshed at ${formattedTime}`;
}


function AnomaliesPage() {
  const navigate =
    useNavigate();


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
  ] = useState(
    0,
  );

  const [
    currentOffset,
    setCurrentOffset,
  ] = useState(
    0,
  );

  const [
    hasPrevious,
    setHasPrevious,
  ] = useState(
    false,
  );

  const [
    hasNext,
    setHasNext,
  ] = useState(
    false,
  );


  const [
    riskFilter,
    setRiskFilter,
  ] = useState<
    AnomalyRiskFilter
  >("ALL");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState(
    "",
  );

  const [
    appliedSearch,
    setAppliedSearch,
  ] = useState(
    "",
  );


  const [
    isLoading,
    setIsLoading,
  ] = useState(
    true,
  );

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(
    false,
  );

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
    number | null
  >(null);

  const [
    refreshAgeSeconds,
    setRefreshAgeSeconds,
  ] = useState(
    0,
  );


  /*
   * Initial page load.
   *
   * A fresh navigation to /anomalies is treated
   * as a detection refresh, so the visible
   * refresh age begins at "just now".
   */
  useEffect(() => {
    let cancelled =
      false;


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


        setLastRefreshedAt(
          Date.now(),
        );

        setRefreshAgeSeconds(
          0,
        );

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
      cancelled =
        true;
    };
  }, []);


  /*
   * Update only the visible age label.
   *
   * This does NOT fetch anomaly data.
   */
  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          setRefreshAgeSeconds(
            (current) =>
              current + 1,
          );
        },
        1000,
      );


    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, []);


  /*
   * Fetch one server-side anomaly page.
   *
   * Search, filtering and pagination should
   * not reset the "last refreshed" indicator.
   * They change the current view, rather than
   * performing a full detection refresh.
   */
  async function loadFeed(
    options: {
      risk:
        AnomalyRiskFilter;

      search:
        string;

      offset:
        number;
    },
  ) {
    try {
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

      setError(
        null,
      );
    } catch {
      setError(
        "SENTINEL could not load the requested anomaly detections.",
      );
    }
  }


  /*
   * Explicit full anomaly refresh.
   *
   * This reloads:
   * - ML summary
   * - model context
   * - current anomaly page
   *
   * Only a successful refresh resets the
   * visible refresh timestamp.
   */
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


      setLastRefreshedAt(
        Date.now(),
      );

      setRefreshAgeSeconds(
        0,
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


  const riskCounts:
    Record<
      AnomalyRiskFilter,
      number
    > = {
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


  function applySearch() {
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


  function changeRiskFilter(
    risk:
      AnomalyRiskFilter,
  ) {
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
  }


  function goToPreviousPage() {
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
  }


  function goToNextPage() {
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
  }


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
                flex
                items-center
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
                mt-3
                text-3xl
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
                mt-3
                max-w-3xl
                text-sm
                leading-6
                text-slate-500
              "
            >
              Explore behavioral anomaly
              percentiles, ranked detections
              and observable signals
              identified by Isolation Forest.
              Open a detection for its
              dedicated analysis workspace.
            </p>
          </div>


          <div
            className="
              flex flex-col
              items-start
              gap-2
              sm:flex-row
              sm:items-center
              lg:justify-end
            "
          >
            <span
              className="
                rounded-xl
                border
                border-slate-800
                bg-[#0b111c]
                px-3 py-2.5
                text-[10px]
                font-medium
                text-slate-500
              "
            >
              {formatRefreshLabel(
                refreshAgeSeconds,
                lastRefreshedAt,
              )}
            </span>


            <button
              type="button"
              disabled={
                isRefreshing
              }
              onClick={() => {
                void refreshAnomalies();
              }}
              className="
                rounded-xl
                border
                border-slate-700/70
                bg-[#121a28]
                px-4 py-2.5
                text-xs
                font-medium
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
                : "Refresh Detections"}
            </button>
          </div>
        </header>


        {error && (
          <div
            className="
              mt-6
              rounded-xl
              border
              border-red-900/60
              bg-red-950/20
              px-4 py-3
              text-sm
              text-red-300
            "
          >
            {error}
          </div>
        )}


        {/* Top metrics */}
        <section
          className="
            mt-7
            grid gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <AnomalyStatCard
            eyebrow="Telemetry"
            value={
              summary
                ? formatAnomalyNumber(
                    summary
                      .events_scored,
                  )
                : "—"
            }
            label="Events Scored"
            tone="cyan"
          />


          <AnomalyStatCard
            eyebrow="Alerting"
            value={
              summary
                ? formatAnomalyNumber(
                    summary
                      .alert_count,
                  )
                : "—"
            }
            label="Critical ML Signals"
            tone="critical"
          />


          <AnomalyStatCard
            eyebrow="Population"
            value={
              summary
                ? formatAnomalyPercent(
                    summary
                      .average_score,
                  )
                : "—"
            }
            label="Mean Anomaly Percentile"
          />


          <AnomalyStatCard
            eyebrow="Model Threshold"
            value={
              model
                ? formatAnomalyPercent(
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
        <div
          className="
            mt-4
          "
        >
          <AnomalyRiskDistribution
            summary={
              summary
            }
          />
        </div>


        {/* Search and filtering */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyFilters
            riskFilter={
              riskFilter
            }
            searchQuery={
              searchQuery
            }
            riskCounts={
              riskCounts
            }
            onRiskChange={
              changeRiskFilter
            }
            onSearchQueryChange={
              setSearchQuery
            }
            onSearch={
              applySearch
            }
          />
        </div>


        {/* Ranked anomaly queue */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyQueue
            anomalies={
              anomalies
            }
            totalResults={
              totalResults
            }
            currentOffset={
              currentOffset
            }
            hasPrevious={
              hasPrevious
            }
            hasNext={
              hasNext
            }
            onOpenAnomaly={(
              eventId,
            ) => {
              navigate(
                `/anomalies/${encodeURIComponent(
                  eventId,
                )}`,
              );
            }}
            onPrevious={
              goToPreviousPage
            }
            onNext={
              goToNextPage
            }
          />
        </div>


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
          SENTINEL operational anomaly
          views display observable features
          and ML outputs only. Simulator
          attack labels remain
          evaluation-only.
        </footer>
      </div>
    </main>
  );
}


export default AnomaliesPage;