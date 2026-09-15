import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getIncidentsForEvent,
  getMLEventAnalysis,
  getMLModelInfo,
  SentinelApiError,
} from "../services/api";

import type {
  IncidentListItem,
  MLEventAnalysis,
  MLModelInfo,
} from "../types/api";

import AnomalyDetailHero from "../components/anomalies/AnomalyDetailHero";
import AnomalyDetailKpiCard from "../components/anomalies/AnomalyDetailKpiCard";
import AnomalyDetectorContext from "../components/anomalies/AnomalyDetectorContext";
import AnomalyExplanation from "../components/anomalies/AnomalyExplanation";
import AnomalyFeatureSignals from "../components/anomalies/AnomalyFeatureSignals";
import AnomalyFeatureSnapshot from "../components/anomalies/AnomalyFeatureSnapshot";
import AnomalyLinkedIncidents from "../components/anomalies/AnomalyLinkedIncidents";

import {
  formatAnomalyEventType,
  formatAnomalyPercent,
  formatAnomalyTimestamp,
} from "../components/anomalies/anomalyFormatters";


const AUTO_REFRESH_INTERVAL_MS =
  10_000;


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


function AnomalyDetailPage() {
  const navigate =
    useNavigate();

  const {
    eventId,
  } = useParams<{
    eventId:
      string;
  }>();


  const [
    analysis,
    setAnalysis,
  ] = useState<
    MLEventAnalysis | null
  >(null);

  const [
    model,
    setModel,
  ] = useState<
    MLModelInfo | null
  >(null);

  const [
    linkedIncidents,
    setLinkedIncidents,
  ] = useState<
    IncidentListItem[]
  >([]);


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
    isBackgroundRefreshing,
    setIsBackgroundRefreshing,
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
    refreshWarning,
    setRefreshWarning,
  ] = useState<
    string | null
  >(null);

  const [
    notFound,
    setNotFound,
  ] = useState(
    false,
  );


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


  const refreshInFlightRef =
    useRef(
      false,
    );


  /*
   * Initial workspace load.
   *
   * We fetch:
   * - event ML analysis
   * - linked incident relationships
   * - detector/model metadata
   */
  useEffect(() => {
    let cancelled =
      false;


    async function loadWorkspace() {
      if (
        !eventId
      ) {
        setNotFound(
          true,
        );

        setIsLoading(
          false,
        );

        return;
      }


      try {
        const [
          eventAnalysis,
          incidents,
          modelInfo,
        ] = await Promise.all([
          getMLEventAnalysis(
            eventId,
          ),

          getIncidentsForEvent(
            eventId,
          ),

          getMLModelInfo(),
        ]);


        if (
          cancelled
        ) {
          return;
        }


        setAnalysis(
          eventAnalysis,
        );

        setLinkedIncidents(
          incidents,
        );

        setModel(
          modelInfo,
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

        setRefreshWarning(
          null,
        );

        setNotFound(
          false,
        );
      } catch (
        loadError
      ) {
        if (
          cancelled
        ) {
          return;
        }


        if (
          loadError
            instanceof SentinelApiError
          && loadError.status
            === 404
        ) {
          setNotFound(
            true,
          );
        } else {
          setError(
            "SENTINEL could not load this anomaly analysis. Confirm that the backend and PostgreSQL are running.",
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


    void loadWorkspace();


    return () => {
      cancelled =
        true;
    };
  }, [
    eventId,
  ]);


  /*
   * Visible refresh-age timer.
   *
   * No backend calls occur here.
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
   * Silent operational refresh.
   *
   * We intentionally keep all current
   * content visible while fresh analysis
   * and correlation data are requested.
   */
  useEffect(() => {
    if (
      !eventId
    ) {
      return;
    }


    let cancelled =
      false;


    async function refreshLatestData() {
      if (
        refreshInFlightRef.current
      ) {
        return;
      }


      refreshInFlightRef.current =
        true;

      setIsBackgroundRefreshing(
        true,
      );


      try {
        const [
          eventAnalysis,
          incidents,
        ] = await Promise.all([
          getMLEventAnalysis(
            eventId!,
          ),

          getIncidentsForEvent(
            eventId!,
          ),
        ]);


        if (
          cancelled
        ) {
          return;
        }


        setAnalysis(
          eventAnalysis,
        );

        setLinkedIncidents(
          incidents,
        );


        setLastRefreshedAt(
          Date.now(),
        );

        setRefreshAgeSeconds(
          0,
        );

        setRefreshWarning(
          null,
        );
      } catch {
        if (
          !cancelled
        ) {
          setRefreshWarning(
            "Automatic refresh could not retrieve the latest anomaly intelligence. Existing analysis remains visible.",
          );
        }
      } finally {
        refreshInFlightRef.current =
          false;

        if (
          !cancelled
        ) {
          setIsBackgroundRefreshing(
            false,
          );
        }
      }
    }


    const intervalId =
      window.setInterval(
        () => {
          void refreshLatestData();
        },
        AUTO_REFRESH_INTERVAL_MS,
      );


    return () => {
      cancelled =
        true;

      window.clearInterval(
        intervalId,
      );
    };
  }, [
    eventId,
  ]);


  async function refreshDetectionManually() {
    if (
      !eventId
      || refreshInFlightRef.current
    ) {
      return;
    }


    refreshInFlightRef.current =
      true;

    setIsRefreshing(
      true,
    );


    try {
      const [
        eventAnalysis,
        incidents,
        modelInfo,
      ] = await Promise.all([
        getMLEventAnalysis(
          eventId,
        ),

        getIncidentsForEvent(
          eventId,
        ),

        getMLModelInfo(),
      ]);


      setAnalysis(
        eventAnalysis,
      );

      setLinkedIncidents(
        incidents,
      );

      setModel(
        modelInfo,
      );


      setLastRefreshedAt(
        Date.now(),
      );

      setRefreshAgeSeconds(
        0,
      );

      setRefreshWarning(
        null,
      );

      setError(
        null,
      );
    } catch {
      setRefreshWarning(
        "SENTINEL could not refresh this anomaly analysis. Existing intelligence remains visible.",
      );
    } finally {
      refreshInFlightRef.current =
        false;

      setIsRefreshing(
        false,
      );
    }
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
            Loading Anomaly Analysis
          </p>
        </div>
      </main>
    );
  }


  if (
    notFound
  ) {
    return (
      <main
        className="
          flex min-h-screen
          items-center
          justify-center
          bg-[#0b111b]/55
          px-4
        "
      >
        <section
          className="
            w-full
            max-w-xl
            rounded-2xl
            border
            border-slate-700/55
            bg-[#101826]/90
            p-8
            text-center
            shadow-[0_16px_48px_rgba(0,0,0,0.16)]
          "
        >
          <div
            className="
              mx-auto
              flex h-12 w-12
              items-center
              justify-center
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]
              text-xl
              text-slate-600
            "
          >
            !
          </div>

          <p
            className="
              mt-5
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.17em]
              text-cyan-500
            "
          >
            Anomaly Intelligence
          </p>

          <h1
            className="
              mt-3
              text-2xl
              font-semibold
              text-white
            "
          >
            Detection not found
          </h1>

          <p
            className="
              mt-3
              text-sm
              leading-6
              text-slate-500
            "
          >
            No selected-detector anomaly
            analysis could be found for
            this event ID.
          </p>

          {eventId && (
            <p
              className="
                mt-3
                font-mono
                text-[10px]
                text-slate-700
              "
            >
              {eventId}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              navigate(
                "/anomalies",
              );
            }}
            className="
              mt-6
              rounded-xl
              border
              border-cyan-900/60
              bg-cyan-950/20
              px-4 py-2.5
              text-xs
              font-medium
              text-cyan-300
              transition-all
              hover:-translate-y-0.5
              hover:border-cyan-700/70
              hover:bg-cyan-950/30
            "
          >
            ← Return to Anomalies
          </button>
        </section>
      </main>
    );
  }


  if (
    error
    || !analysis
  ) {
    return (
      <main
        className="
          flex min-h-screen
          items-center
          justify-center
          bg-[#0b111b]/55
          px-4
        "
      >
        <section
          className="
            w-full
            max-w-xl
            rounded-2xl
            border
            border-red-900/50
            bg-[#101826]/90
            p-8
            text-center
          "
        >
          <h1
            className="
              text-xl
              font-semibold
              text-white
            "
          >
            Analysis unavailable
          </h1>

          <p
            className="
              mt-3
              text-sm
              leading-6
              text-slate-500
            "
          >
            {error
              ?? (
                "SENTINEL could not "
                + "load this anomaly."
              )}
          </p>

          <button
            type="button"
            onClick={() => {
              navigate(
                "/anomalies",
              );
            }}
            className="
              mt-6
              rounded-xl
              border
              border-slate-700
              bg-[#0b111c]
              px-4 py-2.5
              text-xs
              text-slate-300
              transition-all
              hover:border-cyan-900
              hover:text-cyan-300
            "
          >
            ← Back to Anomalies
          </button>
        </section>
      </main>
    );
  }


  const featureCount =
    Object.keys(
      analysis
        .feature_snapshot,
    ).length;


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
        {/* Navigation */}
        <button
          type="button"
          onClick={() => {
            navigate(
              "/anomalies",
            );
          }}
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-slate-800
            bg-[#0b111c]
            px-3 py-2
            text-xs
            text-slate-500
            transition-all
            duration-200
            hover:-translate-x-0.5
            hover:border-cyan-900/70
            hover:text-cyan-300
          "
        >
          ← Back to Anomalies
        </button>


        {/* Workspace Header */}
        <header
          className="
            mt-6
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
                Anomaly Analysis
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
              Detection Analysis Workspace
            </h1>


            <div
                className="
                    mt-5
                    flex
                    flex-wrap
                    items-center
                    gap-2.5
                "
                >
                {/* Event ID */}
                <span
                    className="
                    inline-flex
                    items-center
                    rounded-lg
                    border
                    border-cyan-900/60
                    bg-cyan-950/20
                    px-3 py-2
                    font-mono
                    text-[10px]
                    font-semibold
                    tracking-[0.04em]
                    text-cyan-300
                    shadow-[0_0_18px_rgba(34,211,238,0.04)]
                    "
                >
                    {
                    analysis
                        .event_id
                    }
                </span>


                {/* Event type */}
                <span
                    className="
                    inline-flex
                    items-center
                    rounded-lg
                    border
                    border-slate-700/70
                    bg-[#101826]
                    px-3 py-2
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.1em]
                    text-slate-300
                    "
                >
                    {formatAnomalyEventType(
                    analysis
                        .event_type,
                    )}
                </span>


                {/* User */}
                <span
                    className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-indigo-900/45
                    bg-indigo-950/15
                    px-3 py-2
                    text-[10px]
                    font-medium
                    text-indigo-300
                    "
                >
                    <span
                    className="
                        h-1.5 w-1.5
                        rounded-full
                        bg-indigo-400
                    "
                    />

                    {
                    analysis
                        .employee_user_id
                    }
                </span>


                {/* Event timestamp */}
                <span
                    className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-slate-800
                    bg-[#0b111c]
                    px-3 py-2
                    text-[10px]
                    font-medium
                    text-slate-400
                    "
                >
                    <span
                    className="
                        text-slate-600
                    "
                    >
                    ◷
                    </span>

                    {formatAnomalyTimestamp(
                    analysis
                        .timestamp,
                    )}
                </span>
            </div>
          </div>


          <div
            className="
              flex
              flex-col
              items-start
              gap-2
              sm:flex-row
              sm:items-center
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                rounded-xl
                border
                border-slate-800
                bg-[#0b111c]
                px-3 py-2.5
              "
            >
              <span
                className={[
                  "h-1.5 w-1.5",
                  "rounded-full",

                  isBackgroundRefreshing
                    ? (
                        "animate-pulse "
                        + "bg-cyan-300"
                      )
                    : "bg-emerald-400",
                ].join(
                  " ",
                )}
              />

              <span
                className="
                  text-[10px]
                  font-medium
                  text-slate-500
                "
              >
                {isBackgroundRefreshing
                  ? "Updating intelligence…"
                  : formatRefreshLabel(
                      refreshAgeSeconds,
                      lastRefreshedAt,
                    )}
              </span>
            </div>


            <button
              type="button"
              disabled={
                isRefreshing
                || isBackgroundRefreshing
              }
              onClick={() => {
                void refreshDetectionManually();
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
                : "Refresh Detection"}
            </button>
          </div>
        </header>


        {/* Live status */}
        <div
          className="
            mt-5
            flex
            flex-wrap
            items-center
            justify-between
            gap-3
            rounded-xl
            border
            border-slate-800/80
            bg-[#0d1521]/65
            px-4 py-3
          "
        >
          <p
            className="
              text-[10px]
              text-slate-600
            "
          >
            Detection analysis and incident
            correlations refresh silently
            every 10 seconds.
          </p>

          <span
            className="
              text-[9px]
              font-medium
              uppercase
              tracking-[0.12em]
              text-emerald-500
            "
          >
            Live intelligence
          </span>
        </div>


        {refreshWarning && (
          <div
            className="
              mt-4
              rounded-xl
              border
              border-amber-900/50
              bg-amber-950/10
              px-4 py-3
              text-xs
              text-amber-300
            "
          >
            {refreshWarning}
          </div>
        )}


        {/* KPIs */}
        <section
          className="
            mt-4
            grid gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <AnomalyDetailKpiCard
            eyebrow="Detection Rank"
            value={
              formatAnomalyPercent(
                analysis
                  .anomaly_score,
                1,
              )
            }
            label="Historical anomaly percentile"
            tone={
              analysis
                .alert_threshold_reached
                ? "critical"
                : "cyan"
            }
          />


          <AnomalyDetailKpiCard
            eyebrow="Model Output"
            value={
              analysis
                .raw_score
                .toFixed(
                  6,
                )
            }
            label="Raw Isolation Forest score"
          />


          <AnomalyDetailKpiCard
            eyebrow="Evidence"
            value={
              String(
                featureCount,
              )
            }
            label="Recorded model features"
            tone="cyan"
          />


          <AnomalyDetailKpiCard
            eyebrow="Correlation"
            value={
              String(
                linkedIncidents
                  .length,
              )
            }
            label={
              linkedIncidents.length
                === 1
                ? "Linked security incident"
                : "Linked security incidents"
            }
            tone={
              linkedIncidents.length
                > 0
                ? "critical"
                : "default"
            }
          />
        </section>


        {/* Detection hero */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyDetailHero
            analysis={
              analysis
            }
            model={
              model
            }
          />
        </div>


        {/* Curated behavioral signals */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyFeatureSignals
            analysis={
              analysis
            }
          />
        </div>


        {/* Interpretation */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyExplanation
            analysis={
              analysis
            }
          />
        </div>


        {/* Incident correlation */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyLinkedIncidents
            incidents={
              linkedIncidents
            }
            onOpenIncident={(
              incidentId,
            ) => {
              navigate(
                `/incidents/${encodeURIComponent(
                  incidentId,
                )}`,
              );
            }}
          />
        </div>


        {/* Complete model feature vector */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyFeatureSnapshot
            features={
              analysis
                .feature_snapshot
            }
          />
        </div>


        {/* Detector context */}
        <div
          className="
            mt-4
          "
        >
          <AnomalyDetectorContext
            analysis={
              analysis
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
          SENTINEL anomaly analysis uses
          observable event features and
          selected-detector outputs only.
          Anomaly percentiles represent
          historical ranking relative to
          the learned baseline and are not
          attack probabilities. Simulator
          ground-truth labels remain
          evaluation-only.
        </footer>
      </div>
    </main>
  );
}


export default AnomalyDetailPage;