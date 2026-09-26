import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getEmployees,
  getEvaluationSummary,
  getIncidents,
  getIncidentSummary,
  getMLModelInfo,
  getMLSummary,
  getOperationsStatus,
} from "../services/api";

import type {
  EvaluationSummary,
  IncidentListItem,
  IncidentSeverity,
  IncidentSummary,
  MLModelInfo,
  MLSummary,
  ProcessorRuntimeStatus,
} from "../types/api";

import OverviewIncidentQueue from "../components/overview/OverviewIncidentQueue";
import OverviewMetricCard from "../components/overview/OverviewMetricCard";
import OverviewRefreshControls from "../components/overview/OverviewRefreshControls";

import {
  OVERVIEW_SEVERITY_STYLES,
  formatOverviewNumber,
  formatOverviewPercent,
} from "../components/overview/overviewStyles";


const AUTO_REFRESH_INTERVAL_MS =
  10_000;

const INCIDENT_FETCH_LIMIT =
  50;

const OVERVIEW_INCIDENT_LIMIT =
  5;


const SEVERITY_PRIORITY:
  Record<
    IncidentSeverity,
    number
  > = {
    CRITICAL:
      3,

    HIGH:
      2,

    MEDIUM:
      1,
  };


const STATUS_PRIORITY:
  Record<
    string,
    number
  > = {
    OPEN:
      4,

    INVESTIGATING:
      3,

    RESOLVED:
      2,

    CLOSED:
      1,
  };


function selectPriorityIncidents(
  incidents:
    IncidentListItem[],
): IncidentListItem[] {
  return [
    ...incidents,
  ]
    .sort(
      (
        incidentA,
        incidentB,
      ) => {
        /*
         * 1. Highest severity first.
         */
        const severityDifference =
          SEVERITY_PRIORITY[
            incidentB.severity
          ]
          - SEVERITY_PRIORITY[
              incidentA.severity
            ];

        if (
          severityDifference
          !== 0
        ) {
          return severityDifference;
        }


        /*
         * 2. Active investigations ahead
         *    of resolved / closed cases.
         */
        const statusDifference =
          (
            STATUS_PRIORITY[
              incidentB.status
            ]
            ?? 0
          )
          - (
              STATUS_PRIORITY[
                incidentA.status
              ]
              ?? 0
            );

        if (
          statusDifference
          !== 0
        ) {
          return statusDifference;
        }


        /*
         * 3. Most recently observed
         *    incident first.
         */
        return (
          new Date(
            incidentB.first_seen,
          ).getTime()
          - new Date(
              incidentA.first_seen,
            ).getTime()
        );
      },
    )
    .slice(
      0,
      OVERVIEW_INCIDENT_LIMIT,
    );
}


function OverviewPage() {
  const navigate =
    useNavigate();


  const [
    employeeCount,
    setEmployeeCount,
  ] = useState(
    0,
  );

  const [
    incidentSummary,
    setIncidentSummary,
  ] = useState<
    IncidentSummary | null
  >(
    null,
  );

  const [
    incidents,
    setIncidents,
  ] = useState<
    IncidentListItem[]
  >(
    [],
  );

  const [
    mlSummary,
    setMLSummary,
  ] = useState<
    MLSummary | null
  >(
    null,
  );

  const [
    model,
    setModel,
  ] = useState<
    MLModelInfo | null
  >(
    null,
  );

  const [
    evaluation,
    setEvaluation,
  ] = useState<
    EvaluationSummary | null
  >(
    null,
  );

  const [
    processorStatus,
    setProcessorStatus,
  ] = useState<
    ProcessorRuntimeStatus
    | null
  >(
    null,
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
  >(
    null,
  );

  const [
    refreshWarning,
    setRefreshWarning,
  ] = useState<
    string | null
  >(
    null,
  );


  const [
    lastRefreshedAt,
    setLastRefreshedAt,
  ] = useState<
    number | null
  >(
    null,
  );

  const [
    refreshAgeSeconds,
    setRefreshAgeSeconds,
  ] = useState(
    0,
  );

  const [
    currentTimeMs,
    setCurrentTimeMs,
  ] = useState(
    0,
  );


  const refreshInFlightRef =
    useRef(
      false,
    );


  /*
   * Initial intelligence load.
   *
   * This is the only time Overview uses
   * the full-page loading state.
   */
  useEffect(() => {
    let cancelled =
      false;


    async function loadInitialData() {
      try {
        const [
          employees,
          incidentData,
          incidentList,
          machineLearningSummary,
          modelInfo,
          evaluationData,
          operationsData,
        ] = await Promise.all([
          getEmployees(),

          getIncidentSummary(),

          getIncidents(
            INCIDENT_FETCH_LIMIT,
          ),

          getMLSummary(),

          getMLModelInfo(),

          getEvaluationSummary(),

          getOperationsStatus()
            .catch(
              () => null,
            ),
        ]);


        if (
          cancelled
        ) {
          return;
        }


        setEmployeeCount(
          employees.length,
        );

        setIncidentSummary(
          incidentData,
        );

        setIncidents(
          incidentList,
        );

        setMLSummary(
          machineLearningSummary,
        );

        setModel(
          modelInfo,
        );

        setEvaluation(
          evaluationData,
        );

        if (
          operationsData
        ) {
          setProcessorStatus(
            operationsData.sentinel,
          );
        }


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
      } catch {
        if (
          !cancelled
        ) {
          setError(
            "SENTINEL could not load the current security posture. Confirm that PostgreSQL and the FastAPI backend are running.",
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
   * Refresh-age display timer.
   *
   * This changes the visible label only.
   * It does not make API requests.
   */
  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          setRefreshAgeSeconds(
            (current) =>
              current + 1,
          );

          setCurrentTimeMs(
            Date.now(),
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
   * Silent 10-second intelligence refresh.
   *
   * Existing dashboard data remains visible
   * throughout the request.
   */
  useEffect(() => {
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
          employees,
          incidentData,
          incidentList,
          machineLearningSummary,
          modelInfo,
          evaluationData,
          operationsData,
        ] = await Promise.all([
          getEmployees(),

          getIncidentSummary(),

          getIncidents(
            INCIDENT_FETCH_LIMIT,
          ),

          getMLSummary(),

          getMLModelInfo(),

          getEvaluationSummary(),

          getOperationsStatus()
            .catch(
              () => null,
            ),
        ]);


        if (
          cancelled
        ) {
          return;
        }


        setEmployeeCount(
          employees.length,
        );

        setIncidentSummary(
          incidentData,
        );

        setIncidents(
          incidentList,
        );

        setMLSummary(
          machineLearningSummary,
        );

        setModel(
          modelInfo,
        );

        setEvaluation(
          evaluationData,
        );

        if (
          operationsData
        ) {
          setProcessorStatus(
            operationsData.sentinel,
          );
        }


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
        if (
          !cancelled
        ) {
          setRefreshWarning(
            "Automatic refresh could not retrieve the latest security intelligence. Existing dashboard data remains visible.",
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
  }, []);


  /*
   * Explicit analyst-requested refresh.
   *
   * Uses the same complete intelligence
   * dataset as the silent refresh.
   */
  async function refreshOverview() {
    if (
      refreshInFlightRef.current
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
        employees,
        incidentData,
        incidentList,
        machineLearningSummary,
        modelInfo,
        evaluationData,
        operationsData,
      ] = await Promise.all([
        getEmployees(),

        getIncidentSummary(),

        getIncidents(
          INCIDENT_FETCH_LIMIT,
        ),

        getMLSummary(),

        getMLModelInfo(),

        getEvaluationSummary(),

        getOperationsStatus()
          .catch(
            () => null,
          ),
      ]);


      setEmployeeCount(
        employees.length,
      );

      setIncidentSummary(
        incidentData,
      );

      setIncidents(
        incidentList,
      );

      setMLSummary(
        machineLearningSummary,
      );

      setModel(
        modelInfo,
      );

      setEvaluation(
        evaluationData,
      );

      if (
        operationsData
      ) {
        setProcessorStatus(
          operationsData.sentinel,
        );
      }


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
        "SENTINEL could not refresh the current intelligence feed. Existing dashboard data remains visible.",
      );
    } finally {
      refreshInFlightRef.current =
        false;

      setIsRefreshing(
        false,
      );
    }
  }


  /*
   * Severity distribution used by the
   * existing Incident Severity panel.
   */
  const severityRows =
    useMemo<
      {
        severity:
          IncidentSeverity;

        count:
          number;

        percentage:
          number;
      }[]
    >(
      () => {
        if (
          !incidentSummary
        ) {
          return [];
        }


        const total =
          incidentSummary
            .total_incidents
          || 1;


        const rows:
          {
            severity:
              IncidentSeverity;

            count:
              number;
          }[] = [
            {
              severity:
                "CRITICAL",

              count:
                incidentSummary
                  .critical_incidents,
            },

            {
              severity:
                "HIGH",

              count:
                incidentSummary
                  .high_incidents,
            },

            {
              severity:
                "MEDIUM",

              count:
                incidentSummary
                  .medium_incidents,
            },
          ];


        return rows.map(
          (
            row,
          ) => ({
            ...row,

            percentage:
              row.count
              / total,
          }),
        );
      },
      [
        incidentSummary,
      ],
    );


  /*
   * Overview shows only the highest-value
   * operational incidents, while /incidents
   * remains the complete investigation queue.
   */
  const priorityIncidents =
    useMemo(
      () =>
        selectPriorityIncidents(
          incidents,
        ),
      [
        incidents,
      ],
    );


  if (
    isLoading
  ) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          px-6
        "
      >
        <div
          className="
            flex
            flex-col
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
              text-xs
              uppercase
              tracking-[0.16em]
              text-slate-600
            "
          >
            Loading Security Operations
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
          max-w-[1550px]
        "
      >
        {/* =================================================
            Page Header
            ================================================= */}
        <header
          className="
            flex
            flex-col
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
                Security Operations
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
              Security Operations Overview
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
              Monitor correlated threats,
              investigation priorities,
              behavioral detections and
              SENTINEL system health from
              one operational workspace.
            </p>
          </div>


          <OverviewRefreshControls
            isRefreshing={
              isRefreshing
            }
            isBackgroundRefreshing={
              isBackgroundRefreshing
            }
            lastRefreshedAt={
              lastRefreshedAt
            }
            refreshAgeSeconds={
              refreshAgeSeconds
            }
            processorStatus={
              processorStatus
            }
            currentTimeMs={
              currentTimeMs
            }
            onRefresh={() => {
              void refreshOverview();
            }}
          />
        </header>


        {error && (
          <div
            role="alert"
            className="
              mt-6
              rounded-xl
              border
              border-red-900/60
              bg-red-950/25
              px-4 py-3
              text-sm
              text-red-300
            "
          >
            {error}
          </div>
        )}


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


        {/* =================================================
            Primary Metrics
            ================================================= */}
        <section
          className="
            mt-7
            grid
            gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <OverviewMetricCard
            eyebrow="Enterprise"
            value={
              formatOverviewNumber(
                employeeCount,
              )
            }
            label="Monitored Identities"
            helper="Active synthetic enterprise identities currently represented in SENTINEL."
            tone="cyan"
          />


          <OverviewMetricCard
            eyebrow="Telemetry"
            value={
              mlSummary
                ? formatOverviewNumber(
                    mlSummary
                      .events_scored,
                  )
                : "—"
            }
            label="Events Analyzed"
            helper="Security events processed through the selected behavioral anomaly detector."
          />


          <OverviewMetricCard
            eyebrow="Investigations"
            value={
              incidentSummary
                ? formatOverviewNumber(
                    incidentSummary
                      .open_incidents,
                  )
                : "—"
            }
            label="Open Incidents"
            helper="Correlated investigations currently requiring analyst review."
            tone="cyan"
          />


          <OverviewMetricCard
            eyebrow="Priority"
            value={
              incidentSummary
                ? formatOverviewNumber(
                    incidentSummary
                      .critical_incidents,
                  )
                : "—"
            }
            label="Critical Incidents"
            helper="Highest-priority incidents requiring immediate analyst attention."
            tone="critical"
          />
        </section>


        {/* =================================================
            Intelligence Overview
            ================================================= */}
        <section
          className="
            mt-4
            grid
            gap-4
            xl:grid-cols-[0.9fr_1.1fr]
          "
        >
          {/* Incident Severity */}
          <article
            className="
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-5
              shadow-[0_12px_35px_rgba(0,0,0,0.12)]
              transition-all
              duration-300
              hover:border-slate-600/70
              hover:bg-[#121c2b]
            "
          >
            <div
              className="
                flex
                items-start
                justify-between
                gap-4
              "
            >
              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.17em]
                    text-slate-500
                  "
                >
                  Incident Intelligence
                </p>

                <h2
                  className="
                    mt-1.5
                    text-lg
                    font-semibold
                    text-white
                  "
                >
                  Incident Severity
                </h2>
              </div>


              <div
                className="
                  text-right
                "
              >
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.13em]
                    text-slate-600
                  "
                >
                  Total
                </p>

                <p
                  className="
                    mt-1
                    text-xl
                    font-semibold
                    text-slate-200
                  "
                >
                  {incidentSummary
                    ? formatOverviewNumber(
                        incidentSummary
                          .total_incidents,
                      )
                    : "—"}
                </p>
              </div>
            </div>


            <div
              className="
                mt-6
                space-y-5
              "
            >
              {severityRows.map(
                ({
                  severity,
                  count,
                  percentage,
                }) => (
                  <div
                    key={
                      severity
                    }
                    className="
                      group
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-4
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2.5
                        "
                      >
                        <span
                          className={[
                            "h-2 w-2",
                            "rounded-full",

                            OVERVIEW_SEVERITY_STYLES[
                              severity
                            ].dot,
                          ].join(
                            " ",
                          )}
                        />

                        <span
                          className="
                            text-xs
                            font-medium
                            text-slate-300
                          "
                        >
                          {severity}
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
                            font-semibold
                            text-slate-200
                          "
                        >
                          {count}
                        </span>

                        {" · "}

                        {formatOverviewPercent(
                          percentage,
                        )}
                      </div>
                    </div>


                    <div
                      className="
                        mt-2.5
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
                          "transition-all",
                          "duration-500",
                          "group-hover:brightness-125",

                          OVERVIEW_SEVERITY_STYLES[
                            severity
                          ].bar,
                        ].join(
                          " ",
                        )}
                        style={{
                          width:
                            `${percentage * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>


            <div
              className="
                mt-6
                grid
                grid-cols-2
                gap-3
                border-t
                border-slate-800
                pt-5
              "
            >
              <div
                className="
                  rounded-xl
                  border
                  border-slate-800
                  bg-[#0b111c]
                  p-4
                "
              >
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.13em]
                    text-slate-600
                  "
                >
                  Correlated Events
                </p>

                <p
                  className="
                    mt-2
                    text-xl
                    font-semibold
                    text-slate-200
                  "
                >
                  {incidentSummary
                    ? formatOverviewNumber(
                        incidentSummary
                          .total_correlated_events,
                      )
                    : "—"}
                </p>
              </div>


              <div
                className="
                  rounded-xl
                  border
                  border-slate-800
                  bg-[#0b111c]
                  p-4
                "
              >
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.13em]
                    text-slate-600
                  "
                >
                  Incident Recall
                </p>

                <p
                  className="
                    mt-2
                    text-xl
                    font-semibold
                    text-emerald-300
                  "
                >
                  {evaluation
                    ? formatOverviewPercent(
                        evaluation
                          .incident_evaluation
                          .recall,
                        0,
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </article>


          {/* Intelligence Pipeline */}
          <article
            className="
              relative
              overflow-hidden
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-5
              shadow-[0_12px_35px_rgba(0,0,0,0.12)]
              transition-all
              duration-300
              hover:border-cyan-900/45
              hover:bg-[#121c2b]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                right-[-80px]
                top-[-90px]
                h-64 w-64
                rounded-full
                bg-cyan-400/[0.035]
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
                  text-slate-500
                "
              >
                Detection Architecture
              </p>

              <h2
                className="
                  mt-1.5
                  text-lg
                  font-semibold
                  text-white
                "
              >
                Intelligence Pipeline
              </h2>

              <p
                className="
                  mt-2
                  max-w-2xl
                  text-xs
                  leading-5
                  text-slate-500
                "
              >
                Raw enterprise telemetry
                is transformed into
                behavioral detections,
                correlated incidents and
                structured investigation
                intelligence.
              </p>


              <div
                className="
                  mt-6
                  grid
                  gap-3
                  md:grid-cols-4
                "
              >
                <div
                  className="
                    group
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all
                    duration-200
                    hover:-translate-y-1
                    hover:border-cyan-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Telemetry
                  </p>

                  <p
                    className="
                      mt-2
                      text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {mlSummary
                      ? formatOverviewNumber(
                          mlSummary
                            .events_scored,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    events
                  </p>
                </div>


                <div
                  className="
                    group
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all
                    duration-200
                    hover:-translate-y-1
                    hover:border-red-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    ML Alerts
                  </p>

                  <p
                    className="
                      mt-2
                      text-xl
                      font-semibold
                      text-red-300
                    "
                  >
                    {mlSummary
                      ? formatOverviewNumber(
                          mlSummary
                            .alert_count,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    critical signals
                  </p>
                </div>


                <div
                  className="
                    group
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all
                    duration-200
                    hover:-translate-y-1
                    hover:border-orange-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Correlation
                  </p>

                  <p
                    className="
                      mt-2
                      text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {incidentSummary
                      ? formatOverviewNumber(
                          incidentSummary
                            .total_incidents,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    incidents
                  </p>
                </div>


                <div
                  className="
                    group
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    p-4
                    transition-all
                    duration-200
                    hover:-translate-y-1
                    hover:border-emerald-900/50
                  "
                >
                  <p
                    className="
                      text-[10px]
                      uppercase
                      tracking-[0.12em]
                      text-slate-600
                    "
                  >
                    Investigation
                  </p>

                  <p
                    className="
                      mt-2
                      text-xl
                      font-semibold
                      text-emerald-300
                    "
                  >
                    {incidentSummary
                      ? formatOverviewNumber(
                          incidentSummary
                            .total_incidents,
                        )
                      : "—"}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    enriched cases
                  </p>
                </div>
              </div>


              {/* Pipeline connector */}
              <div
                className="
                  mt-5
                  hidden
                  items-center
                  md:flex
                "
              >
                {[
                  "Events",
                  "Isolation Forest",
                  "Correlation",
                  "Investigation",
                ].map(
                  (
                    step,
                    index,
                  ) => (
                    <div
                      key={
                        step
                      }
                      className="
                        flex
                        flex-1
                        items-center
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <span
                          className="
                            flex
                            h-6 w-6
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-cyan-900/60
                            bg-cyan-950/30
                            text-[10px]
                            font-semibold
                            text-cyan-300
                          "
                        >
                          {index + 1}
                        </span>

                        <span
                          className="
                            text-[10px]
                            text-slate-500
                          "
                        >
                          {step}
                        </span>
                      </div>


                      {index
                        < 3 && (
                        <div
                          className="
                            mx-3
                            h-px
                            flex-1
                            bg-gradient-to-r
                            from-cyan-900/50
                            to-slate-800
                          "
                        />
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          </article>
        </section>


        {/* =================================================
            Performance Intelligence
            ================================================= */}
        <section
          className="
            mt-4
            grid
            gap-4
            lg:grid-cols-3
          "
        >
          <div
            className="
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-5
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:border-cyan-900/50
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              ML Detection
            </p>


            <div
              className="
                mt-3
                flex
                items-baseline
                justify-between
                gap-3
              "
            >
              <p
                className="
                  text-2xl
                  font-semibold
                  text-white
                "
              >
                {model
                  ? formatOverviewPercent(
                      model.recall,
                    )
                  : "—"}
              </p>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-600
                "
              >
                Recall
              </span>
            </div>


            <p
              className="
                mt-3
                text-xs
                leading-5
                text-slate-500
              "
            >
              Event-level detection
              performance across the
              controlled evaluation set.
            </p>
          </div>


          <div
            className="
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-5
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:border-emerald-900/50
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              Incident Correlation
            </p>


            <div
              className="
                mt-3
                flex
                items-baseline
                justify-between
                gap-3
              "
            >
              <p
                className="
                  text-2xl
                  font-semibold
                  text-emerald-300
                "
              >
                {evaluation
                  ? formatOverviewPercent(
                      evaluation
                        .incident_evaluation
                        .recall,
                      0,
                    )
                  : "—"}
              </p>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-600
                "
              >
                Scenario Recall
              </span>
            </div>


            <p
              className="
                mt-3
                text-xs
                leading-5
                text-slate-500
              "
            >
              All five controlled attack
              instances were recovered at
              the incident level.
            </p>
          </div>


          <div
            className="
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-5
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:border-indigo-900/50
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.15em]
                text-slate-500
              "
            >
              Timeline Recovery
            </p>


            <div
              className="
                mt-3
                flex
                items-baseline
                justify-between
                gap-3
              "
            >
              <p
                className="
                  text-2xl
                  font-semibold
                  text-white
                "
              >
                {evaluation
                  ? (
                      `${evaluation
                        .incident_evaluation
                        .timeline_events_recovered} / ${
                        evaluation
                          .incident_evaluation
                          .timeline_events_total
                      }`
                    )
                  : "—"}
              </p>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-600
                "
              >
                Attack Events
              </span>
            </div>


            <p
              className="
                mt-3
                text-xs
                leading-5
                text-slate-500
              "
            >
              Temporal correlation
              reconstructed complete
              controlled attack timelines.
            </p>
          </div>
        </section>


        {/* =================================================
            Selected Incident Queue
            ================================================= */}
        <OverviewIncidentQueue
          incidents={
            priorityIncidents
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
          onOpenAllIncidents={() => {
            navigate(
              "/incidents",
            );
          }}
        />


        {/* =================================================
            Footer / Platform State
            ================================================= */}
        <footer
          className="
            mt-6
            flex
            flex-col
            gap-2
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
            SENTINEL Security Operations
            Intelligence Platform
          </p>

          <p>
            Isolation Forest
            {" "}

            {model
              ? `v${model.model_version}`
              : ""}

            {" · "}

            Multi-signal correlation

            {" · "}

            Structured investigation
          </p>
        </footer>
      </div>
    </main>
  );
}


export default OverviewPage;