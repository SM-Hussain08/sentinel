import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getIncidentDetail,
  getIncidentInvestigation,
  getIncidents,
  getIncidentTimeline,
} from "../services/api";

import type {
  ContainmentAction,
  IncidentDetail,
  IncidentIndicator,
  IncidentInvestigation,
  IncidentListItem,
  IncidentSeverity,
  IncidentTimelineEvent,
  InvestigationFinding,
  InvestigationStep,
} from "../types/api";


type SeverityFilter =
  | "ALL"
  | IncidentSeverity;


const SEVERITY_STYLES: Record<
  IncidentSeverity,
  {
    badge: string;
    border: string;
    selected: string;
    dot: string;
    text: string;
  }
> = {
  CRITICAL: {
    badge:
      "border-red-800/70 bg-red-950/45 text-red-300",

    border:
      "border-red-900/45",

    selected:
      "border-red-800/60 bg-red-950/20",

    dot:
      "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.65)]",

    text:
      "text-red-300",
  },

  HIGH: {
    badge:
      "border-orange-800/70 bg-orange-950/35 text-orange-300",

    border:
      "border-orange-900/40",

    selected:
      "border-orange-800/50 bg-orange-950/15",

    dot:
      "bg-orange-400",

    text:
      "text-orange-300",
  },

  MEDIUM: {
    badge:
      "border-amber-800/60 bg-amber-950/30 text-amber-300",

    border:
      "border-amber-900/35",

    selected:
      "border-amber-800/45 bg-amber-950/10",

    dot:
      "bg-amber-400",

    text:
      "text-amber-300",
  },
};


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


function formatShortTimestamp(
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


function formatEventType(
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


function formatIncidentType(
  value: string,
): string {
  return formatEventType(
    value,
  );
}


function formatIndicatorValue(
  value: unknown,
): string {
  if (
    typeof value
    === "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  if (
    typeof value
      === "number"
    && value
      >= 1_000_000_000
  ) {
    return `${(
      value
      / 1_000_000_000
    ).toFixed(2)} GB`;
  }

  if (
    typeof value
      === "number"
    && value
      >= 1_000_000
  ) {
    return `${(
      value
      / 1_000_000
    ).toFixed(2)} MB`;
  }

  if (
    value === null
    || value === undefined
  ) {
    return "—";
  }

  return String(
    value,
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
        "text-[10px]",
        "font-semibold",
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


function SectionHeader({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper?: string;
}) {
  return (
    <div>
      <p
        className="
          text-[10px]
          font-medium uppercase
          tracking-[0.17em]
          text-slate-600
        "
      >
        {eyebrow}
      </p>

      <div
        className="
          mt-1.5 flex
          flex-col gap-1
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
          {title}
        </h2>

        {helper && (
          <p
            className="
              text-xs
              text-slate-600
            "
          >
            {helper}
          </p>
        )}
      </div>
    </div>
  );
}


function IndicatorCard({
  indicator,
}: {
  indicator:
    IncidentIndicator;
}) {
  const severity =
    indicator.severity;

  return (
    <div
      className={[
        "group rounded-xl",
        "border bg-[#0b111c]",
        "p-4",
        "transition-all",
        "duration-200",
        "hover:-translate-y-0.5",
        "hover:bg-[#111a28]",
        SEVERITY_STYLES[
          severity
        ].border,
      ].join(" ")}
    >
      <div
        className="
          flex items-center
          justify-between
          gap-3
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
          className={[
            "text-[9px]",
            "font-semibold",
            "uppercase",
            "tracking-[0.12em]",
            SEVERITY_STYLES[
              severity
            ].text,
          ].join(" ")}
        >
          {severity}
        </span>
      </div>

      <p
        className="
          mt-4 text-xs
          leading-5
          text-slate-500
        "
      >
        {indicator.label}
      </p>

      <p
        className="
          mt-1.5 text-xl
          font-semibold
          text-slate-100
        "
      >
        {formatIndicatorValue(
          indicator.value,
        )}
      </p>
    </div>
  );
}


function FindingCard({
  finding,
}: {
  finding:
    InvestigationFinding;
}) {
  return (
    <div
      className="
        rounded-xl
        border border-slate-800
        bg-[#0b111c]
        p-4
        transition-all
        duration-200
        hover:border-slate-700
        hover:bg-[#111a28]
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
            text-[9px]
            uppercase
            tracking-[0.13em]
            text-cyan-500
          "
        >
          {finding.category}
        </p>

        <span
          className="
            text-[9px]
            font-semibold
            tracking-[0.1em]
            text-slate-600
          "
        >
          {finding.confidence}
        </span>
      </div>

      <p
        className="
          mt-3 text-sm
          font-medium
          text-slate-200
        "
      >
        {finding.finding}
      </p>

      <p
        className="
          mt-2 text-xs
          text-slate-500
        "
      >
        Observed value:
        {" "}

        <span
          className="
            font-medium
            text-slate-300
          "
        >
          {formatIndicatorValue(
            finding.value,
          )}
        </span>
      </p>
    </div>
  );
}


function InvestigationStepCard({
  step,
}: {
  step:
    InvestigationStep;
}) {
  return (
    <div
      className="
        group flex
        gap-4 rounded-xl
        border border-slate-800
        bg-[#0b111c]
        p-4
        transition-all
        duration-200
        hover:border-cyan-900/50
        hover:bg-[#111a28]
      "
    >
      <div
        className="
          flex h-8 w-8
          shrink-0 items-center
          justify-center
          rounded-full
          border border-cyan-900/60
          bg-cyan-950/30
          text-xs font-semibold
          text-cyan-300
          transition-transform
          duration-200
          group-hover:scale-105
        "
      >
        {step.priority}
      </div>

      <div>
        <p
          className="
            text-sm font-medium
            text-slate-200
          "
        >
          {step.action}
        </p>

        <p
          className="
            mt-1.5 text-xs
            leading-5
            text-slate-500
          "
        >
          {step.reason}
        </p>
      </div>
    </div>
  );
}


function ContainmentCard({
  action,
}: {
  action:
    ContainmentAction;
}) {
  const immediate =
    action.urgency
      === "IMMEDIATE";

  return (
    <div
      className={[
        "rounded-xl border",
        "p-4",
        immediate
          ? (
            "border-red-900/55 "
            + "bg-red-950/15"
          )
          : (
            "border-orange-900/45 "
            + "bg-orange-950/10"
          ),
      ].join(" ")}
    >
      <div
        className="
          flex flex-wrap
          items-center
          justify-between
          gap-3
        "
      >
        <span
          className={[
            "rounded-full",
            "border px-2.5",
            "py-1",
            "text-[9px]",
            "font-semibold",
            "tracking-[0.12em]",
            immediate
              ? (
                "border-red-800/70 "
                + "bg-red-950/40 "
                + "text-red-300"
              )
              : (
                "border-orange-800/70 "
                + "bg-orange-950/30 "
                + "text-orange-300"
              ),
          ].join(" ")}
        >
          {action.urgency}
        </span>
      </div>

      <p
        className="
          mt-4 text-sm
          font-medium
          text-slate-100
        "
      >
        {action.action}
      </p>

      <p
        className="
          mt-2 text-xs
          leading-5
          text-slate-500
        "
      >
        {action.condition}
      </p>
    </div>
  );
}


function IncidentsPage() {
  const [
    incidents,
    setIncidents,
  ] = useState<
    IncidentListItem[]
  >([]);

  const [
    selectedIncidentId,
    setSelectedIncidentId,
  ] = useState<
    string | null
  >(null);

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
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    detailLoading,
    setDetailLoading,
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

    async function loadInitialWorkspace() {
      try {
        const incidentList =
          await getIncidents(
            100,
          );

        if (
          cancelled
        ) {
          return;
        }

        if (
          incidentList.length
          === 0
        ) {
          setIncidents(
            [],
          );

          setIsLoading(
            false,
          );

          return;
        }

        const firstIncident =
          incidentList[0];

        const [
          incidentDetail,
          incidentTimeline,
          incidentInvestigation,
        ] = await Promise.all([
          getIncidentDetail(
            firstIncident
              .incident_id,
          ),

          getIncidentTimeline(
            firstIncident
              .incident_id,
          ),

          getIncidentInvestigation(
            firstIncident
              .incident_id,
          ),
        ]);

        if (
          cancelled
        ) {
          return;
        }

        setIncidents(
          incidentList,
        );

        setSelectedIncidentId(
          firstIncident
            .incident_id,
        );

        setDetail(
          incidentDetail,
        );

        setTimeline(
          incidentTimeline,
        );

        setInvestigation(
          incidentInvestigation,
        );

        setError(
          null,
        );
      } catch {
        if (
          !cancelled
        ) {
          setError(
            "SENTINEL could not load the incident workspace. Confirm that the backend and PostgreSQL are running.",
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

    void loadInitialWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);


  async function selectIncident(
    incidentId: string,
  ) {
    if (
      incidentId
      === selectedIncidentId
    ) {
      return;
    }

    setSelectedIncidentId(
      incidentId,
    );

    setDetailLoading(
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

      setError(
        null,
      );
    } catch {
      setError(
        "SENTINEL could not load the selected incident investigation.",
      );
    } finally {
      setDetailLoading(
        false,
      );
    }
  }


  async function refreshWorkspace() {
    setIsRefreshing(
      true,
    );

    try {
      const incidentList =
        await getIncidents(
          100,
        );

      setIncidents(
        incidentList,
      );

      const incidentId =
        selectedIncidentId
        ?? incidentList[0]
          ?.incident_id;

      if (
        incidentId
      ) {
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

        setSelectedIncidentId(
          incidentId,
        );

        setDetail(
          incidentDetail,
        );

        setTimeline(
          incidentTimeline,
        );

        setInvestigation(
          incidentInvestigation,
        );
      }

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


  const filteredIncidents =
    useMemo(() => {
      const normalized =
        searchQuery
          .trim()
          .toLowerCase();

      return incidents.filter(
        (incident) => {
          const severityMatch =
            severityFilter
              === "ALL"
            || incident.severity
              === severityFilter;

          if (
            !severityMatch
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
    }, [
      incidents,
      searchQuery,
      severityFilter,
    ]);


  const incidentCounts =
    useMemo(() => ({
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
    }), [
      incidents,
    ]);

    const severityFilters: SeverityFilter[] = [
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
                Incident Intelligence
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
              Investigation Workspace
            </h1>

            <p
              className="
                mt-3 max-w-3xl
                text-sm leading-6
                text-slate-500
              "
            >
              Prioritize correlated
              threats, reconstruct event
              timelines and review
              deterministic investigation
              guidance from SENTINEL.
            </p>
          </div>


          <button
            type="button"
            disabled={
              isRefreshing
            }
            onClick={() => {
              void refreshWorkspace();
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
              : "Refresh Incidents"}
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
            Filters
            ============================================= */}
        <section
          className="
            mt-7 flex
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
            {severityFilters.map(
                (severity) => {
                const active =
                    severityFilter
                    === severity;

                return (
                    <button
                    key={severity}
                    type="button"
                    onClick={() =>
                        setSeverityFilter(
                        severity,
                        )
                    }
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
                            "border-cyan-800/70 " +
                            "bg-cyan-950/30 " +
                            "text-cyan-300"
                        )
                        : (
                            "border-slate-800 " +
                            "bg-[#0b111c] " +
                            "text-slate-500 " +
                            "hover:border-slate-700 " +
                            "hover:text-slate-300"
                        ),
                    ].join(" ")}
                    >
                    {severity}
                    {" "}

                    <span
                        className="
                        ml-1 text-slate-600
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
              relative w-full
              lg:max-w-sm
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
                (event) =>
                  setSearchQuery(
                    event.target.value,
                  )
              }
              placeholder="Search incident, identity or type..."
              className="
                w-full rounded-xl
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
        </section>


        {/* =============================================
            Main Workspace
            ============================================= */}
        <section
          className="
            mt-4 grid
            gap-4
            2xl:grid-cols-[390px_1fr]
          "
        >
          {/* =========================================
              Incident Queue
              ========================================= */}
          <aside
            className="
              overflow-hidden
              rounded-2xl
              border border-slate-700/55
              bg-[#101826]/90
              shadow-[0_12px_35px_rgba(0,0,0,0.12)]
            "
          >
            <div
              className="
                border-b
                border-slate-800
                px-4 py-4
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
                      tracking-[0.16em]
                      text-slate-600
                    "
                  >
                    Investigation Queue
                  </p>

                  <p
                    className="
                      mt-1 text-sm
                      font-semibold
                      text-white
                    "
                  >
                    Security Incidents
                  </p>
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
                  {
                    filteredIncidents
                      .length
                  }
                </span>
              </div>
            </div>


            <div
              className="
                max-h-[calc(100vh-280px)]
                overflow-y-auto
              "
            >
              {filteredIncidents.map(
                (incident) => {
                  const selected =
                    selectedIncidentId
                    === incident
                      .incident_id;

                  return (
                    <button
                      key={
                        incident
                          .incident_id
                      }
                      type="button"
                      onClick={() => {
                        void selectIncident(
                          incident
                            .incident_id,
                        );
                      }}
                      className={[
                        "group relative",
                        "block w-full",
                        "border-b",
                        "border-slate-800/70",
                        "px-4 py-4",
                        "text-left",
                        "transition-all",
                        "duration-200",
                        selected
                          ? SEVERITY_STYLES[
                              incident
                                .severity
                            ].selected
                          : (
                            "bg-transparent "
                            + "hover:bg-[#141e2d]"
                          ),
                      ].join(" ")}
                    >
                      {selected && (
                        <span
                          className={[
                            "absolute",
                            "left-0 top-3",
                            "bottom-3 w-[2px]",
                            "rounded-r-full",
                            incident
                              .severity
                              === "CRITICAL"
                              ? "bg-red-400"
                              : incident
                                .severity
                                === "HIGH"
                                ? "bg-orange-400"
                                : "bg-amber-400",
                          ].join(" ")}
                        />
                      )}

                      <div
                        className="
                          flex items-center
                          justify-between
                          gap-3
                        "
                      >
                        <SeverityBadge
                          severity={
                            incident
                              .severity
                          }
                        />

                        <span
                          className="
                            font-mono
                            text-[9px]
                            text-cyan-500
                          "
                        >
                          {
                            incident
                              .incident_id
                          }
                        </span>
                      </div>

                      <p
                        className="
                          mt-3 text-sm
                          font-semibold
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
                          line-clamp-2
                          text-xs
                          leading-5
                          text-slate-600
                        "
                      >
                        {
                          incident.summary
                        }
                      </p>

                      <div
                        className="
                          mt-3 flex
                          flex-wrap
                          items-center
                          gap-x-4 gap-y-2
                          text-[10px]
                          text-slate-600
                        "
                      >
                        <span>
                          {
                            incident
                              .primary_employee_user_id
                              ?? "Unknown"
                          }
                        </span>

                        <span>
                          {
                            incident
                              .event_count
                          }
                          {" "}
                          events
                        </span>

                        <span>
                          {formatShortTimestamp(
                            incident
                              .first_seen,
                          )}
                        </span>
                      </div>
                    </button>
                  );
                },
              )}


              {filteredIncidents.length
                === 0 && (
                  <div
                    className="
                      px-5 py-12
                      text-center
                    "
                  >
                    <p
                      className="
                        text-sm
                        text-slate-500
                      "
                    >
                      No incidents match
                      the current filters.
                    </p>
                  </div>
                )}
            </div>
          </aside>


          {/* =========================================
              Investigation Detail
              ========================================= */}
          <div
            className="
              min-w-0
            "
          >
            {detailLoading && (
              <div
                className="
                  flex min-h-[600px]
                  items-center
                  justify-center
                  rounded-2xl
                  border border-slate-700/55
                  bg-[#101826]/90
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
                      h-8 w-8
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
                      tracking-[0.15em]
                      text-slate-600
                    "
                  >
                    Loading Investigation
                  </p>
                </div>
              </div>
            )}


            {!detailLoading
              && detail
              && investigation && (
                <div
                  key={
                    detail
                      .incident_id
                  }
                  className="
                    sentinel-page-enter
                    space-y-4
                  "
                >
                  {/* =================================
                      Incident Hero
                      ================================= */}
                  <article
                    className={[
                      "relative overflow-hidden",
                      "rounded-2xl border",
                      "bg-[#101826]/90",
                      "p-5 sm:p-6",
                      "shadow-[0_12px_35px_rgba(0,0,0,0.12)]",
                      SEVERITY_STYLES[
                        detail.severity
                      ].border,
                    ].join(" ")}
                  >
                    <div
                      className="
                        pointer-events-none
                        absolute right-[-100px]
                        top-[-120px]
                        h-72 w-72
                        rounded-full
                        bg-cyan-400/[0.025]
                        blur-[100px]
                      "
                    />

                    <div
                      className="
                        relative
                      "
                    >
                      <div
                        className="
                          flex flex-col
                          gap-5
                          lg:flex-row
                          lg:items-start
                          lg:justify-between
                        "
                      >
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
                                text-xs
                                text-cyan-400
                              "
                            >
                              {
                                detail
                                  .incident_id
                              }
                            </span>

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
                                tracking-[0.12em]
                                text-slate-600
                              "
                            >
                              {formatIncidentType(
                                detail
                                  .incident_type,
                              )}
                            </span>
                          </div>

                          <h2
                            className="
                              mt-3 text-2xl
                              font-semibold
                              tracking-tight
                              text-white
                              sm:text-3xl
                            "
                          >
                            {
                              detail.title
                            }
                          </h2>

                          <p
                            className="
                              mt-3 max-w-3xl
                              text-sm
                              leading-6
                              text-slate-400
                            "
                          >
                            {
                              detail.summary
                            }
                          </p>
                        </div>


                        <div
                          className="
                            flex flex-wrap
                            gap-2
                          "
                        >
                          <SeverityBadge
                            severity={
                              detail.severity
                            }
                          />

                          <span
                            className="
                              inline-flex
                              rounded-full
                              border
                              border-emerald-900/50
                              bg-emerald-950/20
                              px-2.5 py-1
                              text-[10px]
                              font-semibold
                              tracking-[0.12em]
                              text-emerald-300
                            "
                          >
                            {
                              detail.status
                            }
                          </span>
                        </div>
                      </div>


                      <div
                        className="
                          mt-6 grid gap-3
                          sm:grid-cols-2
                          xl:grid-cols-4
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
                              tracking-[0.13em]
                              text-slate-600
                            "
                          >
                            Affected Identity
                          </p>

                          <p
                            className="
                              mt-2 text-sm
                              font-semibold
                              text-slate-200
                            "
                          >
                            {
                              detail
                                .primary_employee_user_id
                                ?? "Unknown"
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
                              tracking-[0.13em]
                              text-slate-600
                            "
                          >
                            Correlated Events
                          </p>

                          <p
                            className="
                              mt-2 text-sm
                              font-semibold
                              text-slate-200
                            "
                          >
                            {
                              detail
                                .event_count
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
                              tracking-[0.13em]
                              text-slate-600
                            "
                          >
                            First Seen
                          </p>

                          <p
                            className="
                              mt-2 text-xs
                              font-medium
                              text-slate-300
                            "
                          >
                            {formatTimestamp(
                              detail.first_seen,
                            )}
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
                              tracking-[0.13em]
                              text-slate-600
                            "
                          >
                            Peak Anomaly
                          </p>

                          <p
                            className="
                              mt-2 text-sm
                              font-semibold
                              text-red-300
                            "
                          >
                            {(
                              detail
                                .max_anomaly_score
                              * 100
                            ).toFixed(1)}
                            %
                          </p>
                        </div>
                      </div>


                      <div
                        className="
                          mt-5 rounded-xl
                          border border-cyan-950/45
                          bg-cyan-950/10
                          px-4 py-3
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
                          Correlation Rationale
                        </p>

                        <p
                          className="
                            mt-2 text-xs
                            leading-5
                            text-slate-400
                          "
                        >
                          {
                            detail
                              .correlation_reason
                          }
                        </p>
                      </div>
                    </div>
                  </article>


                  {/* =================================
                      Key Indicators
                      ================================= */}
                  <article
                    className="
                      rounded-2xl
                      border border-slate-700/55
                      bg-[#101826]/90
                      p-5
                    "
                  >
                    <SectionHeader
                      eyebrow="Evidence"
                      title="Key Indicators"
                      helper={`${detail.indicators.length} correlated signals`}
                    />

                    <div
                      className="
                        mt-5 grid gap-3
                        sm:grid-cols-2
                        xl:grid-cols-3
                      "
                    >
                      {detail.indicators.map(
                        (
                          indicator,
                          index,
                        ) => (
                          <IndicatorCard
                            key={
                              `${indicator.type}-${index}`
                            }
                            indicator={
                              indicator
                            }
                          />
                        ),
                      )}
                    </div>
                  </article>


                  {/* =================================
                      Timeline
                      ================================= */}
                  <article
                    className="
                      rounded-2xl
                      border border-slate-700/55
                      bg-[#101826]/90
                      p-5
                    "
                  >
                    <SectionHeader
                      eyebrow="Reconstruction"
                      title="Incident Timeline"
                      helper={`${timeline.length} correlated events`}
                    />

                    <div
                      className="
                        mt-6
                      "
                    >
                      {timeline.map(
                        (
                          event,
                          index,
                        ) => {
                          const critical =
                            event
                              .risk_level
                            === "CRITICAL";

                          return (
                            <div
                              key={
                                event.event_id
                              }
                              className="
                                relative flex
                                gap-4 pb-5
                                last:pb-0
                              "
                            >
                              {index
                                < timeline.length
                                  - 1 && (
                                  <div
                                    className="
                                      absolute
                                      left-[15px]
                                      top-8
                                      bottom-0
                                      w-px
                                      bg-slate-800
                                    "
                                  />
                                )}

                              <div
                                className={[
                                  "relative z-10",
                                  "flex h-8 w-8",
                                  "shrink-0",
                                  "items-center",
                                  "justify-center",
                                  "rounded-full",
                                  "border",
                                  critical
                                    ? (
                                      "border-red-900/60 "
                                      + "bg-red-950/35"
                                    )
                                    : (
                                      "border-slate-700 "
                                      + "bg-[#0b111c]"
                                    ),
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "h-2 w-2",
                                    "rounded-full",
                                    critical
                                      ? "bg-red-400"
                                      : "bg-cyan-500",
                                  ].join(" ")}
                                />
                              </div>


                              <div
                                className="
                                  min-w-0 flex-1
                                  rounded-xl
                                  border
                                  border-slate-800
                                  bg-[#0b111c]
                                  px-4 py-3
                                  transition-all
                                  duration-200
                                  hover:border-slate-700
                                  hover:bg-[#111a28]
                                "
                              >
                                <div
                                  className="
                                    flex flex-col
                                    gap-2
                                    sm:flex-row
                                    sm:items-center
                                    sm:justify-between
                                  "
                                >
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
                                          event
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
                                          event
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
                                        event
                                          .source_ip
                                        ?? "—"
                                      }
                                      {" → "}
                                      {
                                        event
                                          .destination_ip
                                        ?? "—"
                                      }
                                    </p>
                                  </div>


                                  <div
                                    className="
                                      text-left
                                      sm:text-right
                                    "
                                  >
                                    <p
                                      className="
                                        text-xs
                                        text-slate-400
                                      "
                                    >
                                      {formatTimestamp(
                                        event
                                          .timestamp,
                                      )}
                                    </p>

                                    <p
                                      className={[
                                        "mt-1 text-[10px]",
                                        "font-semibold",
                                        critical
                                          ? "text-red-300"
                                          : "text-slate-600",
                                      ].join(" ")}
                                    >
                                      Anomaly{" "}
                                      {(
                                        event
                                          .anomaly_score
                                        * 100
                                      ).toFixed(1)}
                                      %
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </article>


                  {/* =================================
                      Findings + Severity
                      ================================= */}
                  <div
                    className="
                      grid gap-4
                      xl:grid-cols-[1fr_0.8fr]
                    "
                  >
                    <article
                      className="
                        rounded-2xl
                        border
                        border-slate-700/55
                        bg-[#101826]/90
                        p-5
                      "
                    >
                      <SectionHeader
                        eyebrow="Investigation Intelligence"
                        title="Key Findings"
                        helper={`${investigation.key_findings.length} findings`}
                      />

                      <div
                        className="
                          mt-5 grid gap-3
                          sm:grid-cols-2
                        "
                      >
                        {investigation
                          .key_findings
                          .map(
                            (
                              finding,
                              index,
                            ) => (
                              <FindingCard
                                key={
                                  `${finding.category}-${index}`
                                }
                                finding={
                                  finding
                                }
                              />
                            ),
                          )}
                      </div>
                    </article>


                    <article
                      className={[
                        "rounded-2xl",
                        "border p-5",
                        "bg-[#101826]/90",
                        SEVERITY_STYLES[
                          detail.severity
                        ].border,
                      ].join(" ")}
                    >
                      <SectionHeader
                        eyebrow="Assessment"
                        title="Severity Rationale"
                      />

                      <div
                        className="
                          mt-5
                        "
                      >
                        <SeverityBadge
                          severity={
                            detail.severity
                          }
                        />

                        <p
                          className="
                            mt-4 text-sm
                            leading-7
                            text-slate-300
                          "
                        >
                          {
                            investigation
                              .severity_rationale
                          }
                        </p>

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
                            Intelligence Source
                          </p>

                          <p
                            className="
                              mt-2 text-xs
                              leading-5
                              text-slate-400
                            "
                          >
                            Multi-signal correlation
                            with structured
                            deterministic investigation
                            intelligence.
                          </p>
                        </div>
                      </div>
                    </article>
                  </div>


                  {/* =================================
                      Investigation Plan
                      ================================= */}
                  <article
                    className="
                      rounded-2xl
                      border
                      border-slate-700/55
                      bg-[#101826]/90
                      p-5
                    "
                  >
                    <SectionHeader
                      eyebrow="Analyst Workflow"
                      title="Recommended Investigation"
                      helper="Prioritized response sequence"
                    />

                    <div
                      className="
                        mt-5 grid gap-3
                      "
                    >
                      {investigation
                        .investigation_steps
                        .map(
                          (step) => (
                            <InvestigationStepCard
                              key={
                                step.priority
                              }
                              step={
                                step
                              }
                            />
                          ),
                        )}
                    </div>
                  </article>


                  {/* =================================
                      Questions + Containment
                      ================================= */}
                  <div
                    className="
                      grid gap-4
                      xl:grid-cols-[1fr_0.85fr]
                    "
                  >
                    <article
                      className="
                        rounded-2xl
                        border
                        border-slate-700/55
                        bg-[#101826]/90
                        p-5
                      "
                    >
                      <SectionHeader
                        eyebrow="Analyst Decision Support"
                        title="Questions to Resolve"
                      />

                      <div
                        className="
                          mt-5 space-y-3
                        "
                      >
                        {investigation
                          .analyst_questions
                          .map(
                            (
                              question,
                              index,
                            ) => (
                              <div
                                key={
                                  question
                                }
                                className="
                                  group flex
                                  gap-3
                                  rounded-xl
                                  border
                                  border-slate-800
                                  bg-[#0b111c]
                                  p-4
                                  transition-all
                                  duration-200
                                  hover:border-cyan-900/45
                                  hover:bg-[#111a28]
                                "
                              >
                                <div
                                  className="
                                    mt-0.5
                                    flex h-5 w-5
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-md
                                    border
                                    border-slate-700
                                    text-[9px]
                                    text-slate-600
                                    transition-colors
                                    group-hover:border-cyan-800
                                    group-hover:text-cyan-400
                                  "
                                >
                                  {index + 1}
                                </div>

                                <p
                                  className="
                                    text-xs
                                    leading-5
                                    text-slate-400
                                  "
                                >
                                  {question}
                                </p>
                              </div>
                            ),
                          )}
                      </div>
                    </article>


                    <article
                      className="
                        rounded-2xl
                        border
                        border-red-950/45
                        bg-[#101826]/90
                        p-5
                      "
                    >
                      <SectionHeader
                        eyebrow="Response Guidance"
                        title="Containment"
                      />

                      <p
                        className="
                          mt-3 text-xs
                          leading-5
                          text-slate-600
                        "
                      >
                        Containment actions
                        remain conditional on
                        analyst validation of
                        the incident evidence.
                      </p>

                      <div
                        className="
                          mt-5 space-y-3
                        "
                      >
                        {investigation
                          .containment_actions
                          .map(
                            (
                              action,
                              index,
                            ) => (
                              <ContainmentCard
                                key={
                                  `${action.action}-${index}`
                                }
                                action={
                                  action
                                }
                              />
                            ),
                          )}
                      </div>
                    </article>
                  </div>
                </div>
              )}


            {!detailLoading
              && !detail && (
                <div
                  className="
                    flex min-h-[550px]
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-slate-700/55
                    bg-[#101826]/90
                    p-8
                    text-center
                  "
                >
                  <div>
                    <p
                      className="
                        text-sm
                        font-medium
                        text-slate-400
                      "
                    >
                      Select an incident
                      to begin investigation.
                    </p>

                    <p
                      className="
                        mt-2 text-xs
                        text-slate-600
                      "
                    >
                      SENTINEL will load
                      its correlated evidence,
                      timeline and analyst
                      guidance.
                    </p>
                  </div>
                </div>
              )}
          </div>
        </section>


        <footer
          className="
            mt-6 border-t
            border-slate-800/70
            py-5 text-[11px]
            text-slate-600
          "
        >
          Incident classifications are
          inferred from observable security
          behavior. Simulator ground-truth
          labels are excluded from the
          operational workspace.
        </footer>
      </div>
    </main>
  );
}


export default IncidentsPage;