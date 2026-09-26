import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getIncidents,
  getIncidentSummary,
} from "../services/api";

import type {
  IncidentListItem,
  IncidentSeverity,
  IncidentSummary,
} from "../types/api";

import IncidentKpiCard from "../components/incidents/IncidentKpiCard";
import IncidentQueue from "../components/incidents/IncidentQueue";


type SeverityFilter =
  | "ALL"
  | IncidentSeverity;


type SortOption =
  | "NEWEST"
  | "OLDEST"
  | "SEVERITY"
  | "EVENTS";


const INCIDENTS_PER_PAGE = 15;

const MAX_INCIDENTS_TO_LOAD = 500;


const SEVERITY_RANK:
  Record<
    IncidentSeverity,
    number
  > = {
    CRITICAL: 3,
    HIGH: 2,
    MEDIUM: 1,
  };


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


function IncidentsPage() {
  const navigate =
    useNavigate();

  const [
    incidents,
    setIncidents,
  ] = useState<
    IncidentListItem[]
  >([]);

  const [
    summary,
    setSummary,
  ] = useState<
    IncidentSummary | null
  >(null);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    severityFilter,
    setSeverityFilter,
  ] = useState<
    SeverityFilter
  >("ALL");

  const [
    sortOption,
    setSortOption,
  ] = useState<
    SortOption
  >("NEWEST");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

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
    number | null
  >(null);

  const [
    refreshAgeSeconds,
    setRefreshAgeSeconds,
  ] = useState(0);


  useEffect(() => {
    let cancelled =
      false;

    async function loadIncidents() {
      try {
        const [
          incidentList,
          incidentSummary,
        ] = await Promise.all([
          getIncidents(
            MAX_INCIDENTS_TO_LOAD,
          ),

          getIncidentSummary(),
        ]);

        if (
          cancelled
        ) {
          return;
        }

        setIncidents(
          incidentList,
        );

        setSummary(
          incidentSummary,
        );

        setError(
          null,
        );

        setLastRefreshedAt(
          Date.now(),
        );

        setRefreshAgeSeconds(
          0,
        );
      } catch {
        if (
          !cancelled
        ) {
          setError(
            "SENTINEL could not load incident intelligence. Confirm that the backend and PostgreSQL are running.",
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

    void loadIncidents();

    return () => {
      cancelled = true;
    };
  }, []);


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


  async function refreshIncidents() {
    setIsRefreshing(
      true,
    );

    try {
      const [
        incidentList,
        incidentSummary,
      ] = await Promise.all([
        getIncidents(
          MAX_INCIDENTS_TO_LOAD,
        ),

        getIncidentSummary(),
      ]);

      setIncidents(
        incidentList,
      );

      setSummary(
        incidentSummary,
      );

      setCurrentPage(
        1,
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
        "SENTINEL could not refresh incident intelligence.",
      );
    } finally {
      setIsRefreshing(
        false,
      );
    }
  }


  const incidentCounts =
    useMemo(
      () => ({
        ALL:
          incidents.length,

        CRITICAL:
          incidents.filter(
            (incident) =>
              incident.severity
              === "CRITICAL",
          ).length,

        HIGH:
          incidents.filter(
            (incident) =>
              incident.severity
              === "HIGH",
          ).length,

        MEDIUM:
          incidents.filter(
            (incident) =>
              incident.severity
              === "MEDIUM",
          ).length,
      }),
      [
        incidents,
      ],
    );


  const filteredAndSortedIncidents =
    useMemo(() => {
      const normalized =
        searchQuery
          .trim()
          .toLowerCase();

      const filtered =
        incidents.filter(
          (incident) => {
            const severityMatches =
              severityFilter
                === "ALL"
              || incident.severity
                === severityFilter;

            if (
              !severityMatches
            ) {
              return false;
            }

            if (
              !normalized
            ) {
              return true;
            }

            return [
              incident.incident_id,
              incident.title,
              incident.incident_type,
              incident.status,
              incident.summary,
              incident
                .primary_employee_user_id
                ?? "",
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(
                    normalized,
                  ),
            );
          },
        );

      return [
        ...filtered,
      ].sort(
        (first, second) => {
          switch (
            sortOption
          ) {
            case "OLDEST":
              return (
                new Date(
                  first.first_seen,
                ).getTime()
                - new Date(
                  second.first_seen,
                ).getTime()
              );

            case "SEVERITY": {
              const severityDifference =
                SEVERITY_RANK[
                  second.severity
                ]
                - SEVERITY_RANK[
                  first.severity
                ];

              if (
                severityDifference
                !== 0
              ) {
                return severityDifference;
              }

              return (
                new Date(
                  second.first_seen,
                ).getTime()
                - new Date(
                  first.first_seen,
                ).getTime()
              );
            }

            case "EVENTS":
              return (
                second.event_count
                - first.event_count
              );

            case "NEWEST":
            default:
              return (
                new Date(
                  second.first_seen,
                ).getTime()
                - new Date(
                  first.first_seen,
                ).getTime()
              );
          }
        },
      );
    }, [
      incidents,
      searchQuery,
      severityFilter,
      sortOption,
    ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredAndSortedIncidents.length
        / INCIDENTS_PER_PAGE,
      ),
    );

  const pageStart =
    (currentPage - 1)
    * INCIDENTS_PER_PAGE;

  const visibleIncidents =
    filteredAndSortedIncidents.slice(
      pageStart,
      pageStart
      + INCIDENTS_PER_PAGE,
    );


  const severityFilters:
    SeverityFilter[] = [
      "ALL",
      "CRITICAL",
      "HIGH",
      "MEDIUM",
    ];


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
            Loading Incident Intelligence
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
                  font-semibold uppercase
                  tracking-[0.19em]
                  text-cyan-400
                "
              >
                Incident Intelligence
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
              Prioritize correlated threats,
              review active security incidents
              and open a dedicated investigation
              workspace for deeper analysis.
            </p>
          </div>

          <div
            className="
              flex flex-col
              items-start gap-2
              sm:flex-row
              sm:items-center
              lg:justify-end
            "
          >
            <span
              className="
                rounded-xl
                border border-slate-800
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
                void refreshIncidents();
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
                : "Refresh Incidents"}
            </button>
          </div>
        </header>


        {error && (
          <div
            role="alert"
            className="
              mt-6
              rounded-xl
              border border-red-900/60
              bg-red-950/20
              px-4 py-3
              text-sm
              text-red-300
            "
          >
            {error}
          </div>
        )}


        {/* KPI Cards */}
        <section
          className="
            mt-7 grid gap-3
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <IncidentKpiCard
            label="Total Incidents"
            value={
              summary
                ?.total_incidents
              ?? incidents.length
            }
            helper="Correlated incidents currently known to SENTINEL."
            accent="cyan"
          />

          <IncidentKpiCard
            label="Open Incidents"
            value={
              summary
                ?.open_incidents
              ?? incidents.filter(
                (incident) =>
                  incident.status
                  === "OPEN",
              ).length
            }
            helper="Incidents still requiring analyst attention."
            accent="emerald"
          />

          <IncidentKpiCard
            label="Critical Incidents"
            value={
              summary
                ?.critical_incidents
              ?? incidentCounts
                .CRITICAL
            }
            helper="Highest-priority investigations in the queue."
            accent="red"
          />

          <IncidentKpiCard
            label="Correlated Events"
            value={
              summary
                ?.total_correlated_events
              ?? incidents.reduce(
                (
                  total,
                  incident,
                ) =>
                  total
                  + incident.event_count,
                0,
              )
            }
            helper="Security events linked into incident investigations."
            accent="orange"
          />
        </section>


        {/* Filters */}
        <section
          className="
            mt-5
            rounded-2xl
            border border-slate-700/55
            bg-[#101826]/90
            p-4
          "
        >
          <div
            className="
              flex flex-col gap-4
              xl:flex-row
              xl:items-center
              xl:justify-between
            "
          >
            <div
              className="
                flex flex-wrap
                gap-2
              "
            >
              {severityFilters.map(
                (severity) => {
                  const active =
                    severityFilter
                    === severity;

                  return (
                    <button
                      key={severity}
                      type="button"
                      onClick={() => {
                        setSeverityFilter(
                          severity,
                        );

                        setCurrentPage(
                          1,
                        );
                      }}
                      className={[
                        "rounded-lg border",
                        "px-3 py-2",
                        "text-[10px]",
                        "font-semibold",
                        "tracking-[0.11em]",
                        "transition-all",
                        "duration-200",
                        active
                          ? (
                              "border-cyan-800/70 "
                              + "bg-cyan-950/30 "
                              + "text-cyan-300 "
                              + "shadow-[0_0_18px_rgba(34,211,238,0.04)]"
                            )
                          : (
                              "border-slate-800 "
                              + "bg-[#0b111c] "
                              + "text-slate-500 "
                              + "hover:-translate-y-0.5 "
                              + "hover:border-slate-700 "
                              + "hover:text-slate-300"
                            ),
                      ].join(" ")}
                    >
                      {severity}
                      {" "}

                      <span
                        className="
                          ml-1
                          text-slate-600
                        "
                      >
                        {
                          incidentCounts[
                            severity
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
                flex-col gap-3
                sm:flex-row
                xl:max-w-2xl
              "
            >
              <div
                className="
                  relative
                  min-w-0 flex-1
                "
              >
                <span
                  className="
                    pointer-events-none
                    absolute left-3
                    top-1/2
                    -translate-y-1/2
                    text-xs
                    text-slate-600
                  "
                >
                  ⌕
                </span>

                <input
                  type="search"
                  value={
                    searchQuery
                  }
                  onChange={
                    (event) => {
                      setSearchQuery(
                        event.target.value,
                      );

                      setCurrentPage(
                        1,
                      );
                    }
                  }
                  placeholder="Search incident, identity or type..."
                  className="
                    w-full
                    rounded-xl
                    border border-slate-800
                    bg-[#0b111c]
                    py-2.5 pl-9 pr-3
                    text-xs
                    text-slate-200
                    outline-none
                    transition-all
                    placeholder:text-slate-700
                    focus:border-cyan-900
                    focus:ring-2
                    focus:ring-cyan-950/40
                  "
                />
              </div>

              <select
                value={
                  sortOption
                }
                onChange={
                  (event) => {
                    setSortOption(
                      event.target.value as SortOption,
                    );

                    setCurrentPage(
                      1,
                    );
                  }
                }
                aria-label="Sort incidents"
                className="
                  rounded-xl
                  border border-slate-800
                  bg-[#0b111c]
                  px-3 py-2.5
                  text-xs
                  text-slate-400
                  outline-none
                  transition-all
                  hover:border-slate-700
                  focus:border-cyan-900
                  focus:ring-2
                  focus:ring-cyan-950/40
                "
              >
                <option
                  value="NEWEST"
                >
                  Newest first
                </option>

                <option
                  value="OLDEST"
                >
                  Oldest first
                </option>

                <option
                  value="SEVERITY"
                >
                  Severity — highest first
                </option>

                <option
                  value="EVENTS"
                >
                  Most events
                </option>
              </select>
            </div>
          </div>
        </section>


        {/* Incident Queue */}
        <div
          className="
            mt-4
          "
        >
          <IncidentQueue
            incidents={
              visibleIncidents
            }
            totalFiltered={
              filteredAndSortedIncidents
                .length
            }
            pageStart={
              pageStart
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


        {/* Pagination */}
        <section
          className="
            mt-4
            flex flex-col gap-3
            rounded-2xl
            border border-slate-800/80
            bg-[#0d1521]/75
            px-4 py-3
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <button
            type="button"
            disabled={
              currentPage <= 1
            }
            onClick={() => {
              setCurrentPage(
                (current) =>
                  Math.max(
                    1,
                    current - 1,
                  ),
              );

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className="
              rounded-lg
              border border-slate-800
              bg-[#0b111c]
              px-3.5 py-2
              text-xs
              text-slate-400
              transition-all
              hover:-translate-y-0.5
              hover:border-cyan-900/60
              hover:text-cyan-300
              disabled:cursor-not-allowed
              disabled:opacity-35
              disabled:hover:translate-y-0
              disabled:hover:border-slate-800
              disabled:hover:text-slate-400
            "
          >
            ← Previous
          </button>

          <div
            className="
              text-center
            "
          >
            <p
              className="
                text-xs
                font-medium
                text-slate-400
              "
            >
              Page
              {" "}
              <span
                className="
                  text-slate-200
                "
              >
                {currentPage}
              </span>
              {" of "}
              <span
                className="
                  text-slate-200
                "
              >
                {totalPages}
              </span>
            </p>

            <p
              className="
                mt-1
                text-[10px]
                text-slate-700
              "
            >
              15 incidents per page
            </p>
          </div>

          <button
            type="button"
            disabled={
              currentPage
              >= totalPages
            }
            onClick={() => {
              setCurrentPage(
                (current) =>
                  Math.min(
                    totalPages,
                    current + 1,
                  ),
              );

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className="
              rounded-lg
              border border-slate-800
              bg-[#0b111c]
              px-3.5 py-2
              text-xs
              text-slate-400
              transition-all
              hover:-translate-y-0.5
              hover:border-cyan-900/60
              hover:text-cyan-300
              disabled:cursor-not-allowed
              disabled:opacity-35
              disabled:hover:translate-y-0
              disabled:hover:border-slate-800
              disabled:hover:text-slate-400
            "
          >
            Next →
          </button>
        </section>


        <footer
          className="
            mt-6
            border-t
            border-slate-800/70
            py-5
            text-[11px]
            text-slate-600
          "
        >
          Incident classifications are inferred
          from observable security behavior.
          Simulator ground-truth labels are
          excluded from the operational workspace.
        </footer>
      </div>
    </main>
  );
}


export default IncidentsPage;