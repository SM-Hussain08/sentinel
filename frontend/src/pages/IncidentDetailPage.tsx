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
  getIncidentDetail,
  getIncidentInvestigation,
  getIncidentTimeline,
  SentinelApiError,
} from "../services/api";

import type {
  IncidentDetail,
  IncidentInvestigation,
  IncidentTimelineEvent,
} from "../types/api";

import AIAnalystChat from "../components/incidents/AIAnalystChat";
import AIInvestigator from "../components/incidents/AIInvestigator";
import DecisionSupportPanel from "../components/incidents/DecisionSupportPanel";
import IncidentHero from "../components/incidents/IncidentHero";
import IncidentIndicators from "../components/incidents/IncidentIndicators";
import IncidentTimeline from "../components/incidents/IncidentTimeline";
import InvestigationPanel from "../components/incidents/InvestigationPanel";


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
        hour: "numeric",
        minute: "2-digit",
      },
    );

  return `Last refreshed at ${formattedTime}`;
}


function IncidentDetailPage() {
  const navigate =
    useNavigate();

  const {
    incidentId,
  } = useParams<{
    incidentId: string;
  }>();


  const [
    detail,
    setDetail,
  ] = useState<
    IncidentDetail | null
  >(null);

  const [
    timeline,
    setTimeline,
  ] = useState<
    IncidentTimelineEvent[]
  >([]);

  const [
    investigation,
    setInvestigation,
  ] = useState<
    IncidentInvestigation | null
  >(null);


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
    useRef(false);


  /*
   * Initial incident load.
   *
   * This is the only time we show
   * the full-page loading state.
   */
  useEffect(() => {
    let cancelled =
      false;


    async function loadIncident() {
      if (
        !incidentId
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
          incidentDetail,
          incidentTimeline,
          incidentInvestigation,
        ] = await Promise.all([
          getIncidentDetail(
            incidentId,
          ),

          getIncidentTimeline(
            incidentId,
          ),

          getIncidentInvestigation(
            incidentId,
          ),
        ]);


        if (
          cancelled
        ) {
          return;
        }


        setDetail(
          incidentDetail,
        );

        setTimeline(
          incidentTimeline,
        );

        setInvestigation(
          incidentInvestigation,
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
            "SENTINEL could not load this incident investigation. Confirm that the backend and PostgreSQL are running.",
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


    void loadIncident();


    return () => {
      cancelled = true;
    };
  }, [
    incidentId,
  ]);


  /*
   * Keeps the visible refresh-age
   * label moving without affecting
   * any incident or AI state.
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
   * Silent deterministic intelligence
   * refresh every ten seconds.
   *
   * Existing data remains visible.
   * AI components are NOT remounted.
   */
  useEffect(() => {
    if (
      !incidentId
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
          incidentDetail,
          incidentTimeline,
          incidentInvestigation,
        ] = await Promise.all([
          getIncidentDetail(
            incidentId!,
          ),

          getIncidentTimeline(
            incidentId!,
          ),

          getIncidentInvestigation(
            incidentId!,
          ),
        ]);


        if (
          cancelled
        ) {
          return;
        }


        setDetail(
          incidentDetail,
        );

        setTimeline(
          incidentTimeline,
        );

        setInvestigation(
          incidentInvestigation,
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
            "Automatic refresh could not retrieve the latest incident data. Existing intelligence remains visible.",
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
      cancelled = true;

      window.clearInterval(
        intervalId,
      );
    };
  }, [
    incidentId,
  ]);


  async function refreshIncidentManually() {
    if (
      !incidentId
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
        incidentDetail,
        incidentTimeline,
        incidentInvestigation,
      ] = await Promise.all([
        getIncidentDetail(
          incidentId,
        ),

        getIncidentTimeline(
          incidentId,
        ),

        getIncidentInvestigation(
          incidentId,
        ),
      ]);


      setDetail(
        incidentDetail,
      );

      setTimeline(
        incidentTimeline,
      );

      setInvestigation(
        incidentInvestigation,
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
        "SENTINEL could not refresh this incident. Existing intelligence remains visible.",
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
          items-center justify-center
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
            Loading Incident Investigation
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
          items-center justify-center
          bg-[#0b111b]/55
          px-4
        "
      >
        <section
          className="
            w-full max-w-xl
            rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            p-8 text-center
            shadow-[0_16px_48px_rgba(0,0,0,0.16)]
          "
        >
          <div
            className="
              mx-auto flex
              h-12 w-12
              items-center justify-center
              rounded-xl
              border border-slate-800
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
              font-semibold uppercase
              tracking-[0.17em]
              text-cyan-500
            "
          >
            Incident Intelligence
          </p>

          <h1
            className="
              mt-3 text-2xl
              font-semibold
              text-white
            "
          >
            Incident not found
          </h1>

          <p
            className="
              mt-3 text-sm
              leading-6
              text-slate-500
            "
          >
            The requested incident could
            not be located in SENTINEL.
          </p>

          <button
            type="button"
            onClick={() => {
              navigate(
                "/incidents",
              );
            }}
            className="
              mt-6
              rounded-xl
              border border-cyan-900/60
              bg-cyan-950/20
              px-4 py-2.5
              text-xs font-medium
              text-cyan-300
              transition-all
              hover:-translate-y-0.5
              hover:border-cyan-700/70
              hover:bg-cyan-950/30
            "
          >
            ← Return to Incidents
          </button>
        </section>
      </main>
    );
  }


  if (
    error
    || !detail
    || !investigation
  ) {
    return (
      <main
        className="
          flex min-h-screen
          items-center justify-center
          bg-[#0b111b]/55
          px-4
        "
      >
        <section
          role="alert"
          className="
            w-full max-w-xl
            rounded-2xl
            border border-red-900/50
            bg-[#101826]/90
            p-8 text-center
          "
        >
          <h1
            className="
              text-xl font-semibold
              text-white
            "
          >
            Investigation unavailable
          </h1>

          <p
            className="
              mt-3 text-sm
              leading-6
              text-slate-500
            "
          >
            {error
              ?? "SENTINEL could not load this incident."}
          </p>

          <button
            type="button"
            onClick={() => {
              navigate(
                "/incidents",
              );
            }}
            className="
              mt-6
              rounded-xl
              border border-slate-700
              bg-[#0b111c]
              px-4 py-2.5
              text-xs
              text-slate-300
              transition-all
              hover:border-cyan-900
              hover:text-cyan-300
            "
          >
            ← Back to Incidents
          </button>
        </section>
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
        {/* Navigation */}
        <button
          type="button"
          onClick={() => {
            navigate(
              "/incidents",
            );
          }}
          className="
            inline-flex
            items-center gap-2
            rounded-lg
            border border-slate-800
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
          ← Back to Incidents
        </button>


        {/* Workspace Header */}
        <header
          className="
            mt-6
            flex flex-col gap-5
            lg:flex-row
            lg:items-end
            lg:justify-between
          "
        >
          <div>
            <div
              className="
                flex items-center gap-2.5
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
                Incident Investigation
              </p>
            </div>

            <h1
              className="
                mt-3
                text-3xl font-semibold
                tracking-tight
                text-white
                sm:text-4xl
              "
            >
              Investigation Workspace
            </h1>

            <p
              className="
                mt-3
                max-w-3xl
                text-sm leading-6
                text-slate-500
              "
            >
              Reconstruct correlated activity,
              review deterministic investigation
              intelligence and use grounded local
              AI to support analyst decisions.
            </p>
          </div>


          <div
            className="
              flex flex-col
              items-start gap-2
              sm:flex-row
              sm:items-center
          "
          >
            <div
              className="
                flex items-center gap-2
                rounded-xl
                border border-slate-800
                bg-[#0b111c]
                px-3 py-2.5
              "
            >
              <span
                className={[
                  "h-1.5 w-1.5",
                  "rounded-full",
                  isBackgroundRefreshing
                    ? "animate-pulse bg-cyan-300"
                    : "bg-emerald-400",
                ].join(" ")}
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
                void refreshIncidentManually();
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
                : "Refresh Incident"}
            </button>
          </div>
        </header>


        {/* Auto-refresh note */}
        <div
          className="
            mt-5 flex
            flex-wrap items-center
            justify-between gap-3
            rounded-xl
            border border-slate-800/80
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
            Deterministic incident intelligence
            refreshes automatically every 10 seconds.
          </p>

          <span
            className="
              text-[9px]
              font-medium uppercase
              tracking-[0.12em]
              text-emerald-500
            "
          >
            Live intelligence
          </span>
        </div>


        {refreshWarning && (
          <div
            role="status"
            className="
              mt-4
              rounded-xl
              border border-amber-900/50
              bg-amber-950/10
              px-4 py-3
              text-xs
              text-amber-300
            "
          >
            {refreshWarning}
          </div>
        )}


        {/* Investigation Workspace */}
        <div
          className="
            mt-4 space-y-4
          "
        >
          <IncidentHero
            incident={
              detail
            }
          />

          <IncidentIndicators
            indicators={
              detail.indicators
            }
          />

          <IncidentTimeline
            events={
              timeline
            }
          />

          <InvestigationPanel
            investigation={
              investigation
            }
            severity={
              detail.severity
            }
          />

          <AIInvestigator
            key={
              `investigator-${incidentId}`
            }
            incidentId={
              detail.incident_id
            }
            statusRefreshSignal={
              lastRefreshedAt ?? 0
            }
          />

          <AIAnalystChat
            key={
              `chat-${incidentId}`
            }
            incidentId={
                detail.incident_id
            }
            statusRefreshSignal={
                lastRefreshedAt
                ?? 0
            }
            />

          <DecisionSupportPanel
            analystQuestions={
              investigation
                .analyst_questions
            }
            containmentActions={
              investigation
                .containment_actions
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
          Incident classifications and
          investigation guidance are derived
          from observable operational evidence.
          Simulator ground-truth labels remain
          excluded from detection, correlation
          and AI investigation workflows.
        </footer>
      </div>
    </main>
  );
}


export default IncidentDetailPage;