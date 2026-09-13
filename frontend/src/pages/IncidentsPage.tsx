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
  IncidentDetail,
  IncidentInvestigation,
  IncidentListItem,
  IncidentSeverity,
  IncidentTimelineEvent,
} from "../types/api";

import IncidentQueue from "../components/incidents/IncidentQueue";
import IncidentHero from "../components/incidents/IncidentHero";
import IncidentIndicators from "../components/incidents/IncidentIndicators";
import IncidentTimeline from "../components/incidents/IncidentTimeline";
import InvestigationPanel from "../components/incidents/InvestigationPanel";
import DecisionSupportPanel from "../components/incidents/DecisionSupportPanel";
import AIInvestigator from "../components/incidents/AIInvestigator";
import AIAnalystChat from "../components/incidents/AIAnalystChat";

type SeverityFilter =
  | "ALL"
  | IncidentSeverity;

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
        {/* ─────────────────────────────────────────────
            Header
            ───────────────────────────────────────────── */}
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

        {/* ─────────────────────────────────────────────
            Filters
            ───────────────────────────────────────────── */}
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
                    {severity}{" "}

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

        {/* ─────────────────────────────────────────────
            Main Workspace
            ───────────────────────────────────────────── */}
        <section
          className="
            mt-4 grid
            gap-4
            2xl:grid-cols-[390px_1fr]
          "
        >
          {/* ───────────────────────────────────────
              Incident Queue
              ─────────────────────────────────────── */}
          <IncidentQueue
            incidents={
              filteredIncidents
            }
            selectedIncidentId={
              selectedIncidentId
            }
            onSelectIncident={(
              incidentId,
            ) => {
              void selectIncident(
                incidentId,
              );
            }}
          />

          {/* ───────────────────────────────────────
              Investigation Detail
              ─────────────────────────────────────── */}
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
                  {/* ─────────────────────────────
                      Incident Hero
                      ───────────────────────────── */}
                  <IncidentHero
                    incident={
                      detail
                    }
                  />

                  {/* ─────────────────────────────
                      Key Indicators
                      ───────────────────────────── */}
                  <IncidentIndicators
                    indicators={
                      detail.indicators
                    }
                  />

                  {/* ─────────────────────────────
                      Timeline
                      ───────────────────────────── */}
                  <IncidentTimeline
                    events={
                      timeline
                    }
                  />

                  {/* ─────────────────────────────
                      Findings + Severity
                      ───────────────────────────── */}
                  <InvestigationPanel
                    investigation={
                      investigation
                    }
                    severity={
                      detail.severity
                    }
                  />

                  {/* ─────────────────────────────
                      AI Investigation
                      ───────────────────────────── */}
                  <AIInvestigator
                    incidentId={
                      detail.incident_id
                    }
                  />

                  {/* ─────────────────────────────
                      AI Chat
                      ───────────────────────────── */}

                  <AIAnalystChat
                    key={
                      detail.incident_id
                    }
                    incidentId={
                      detail.incident_id
                    }
                  />

                  {/* ─────────────────────────────
                      Questions + Containment
                      ───────────────────────────── */}
                  <DecisionSupportPanel
                    analystQuestions={
                      investigation.analyst_questions
                    }
                    containmentActions={
                      investigation.containment_actions
                    }
                  />
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