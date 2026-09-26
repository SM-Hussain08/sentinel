import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getEmployeeActivity,
  getEmployeeDetail,
  SentinelApiError,
} from "../services/api";

import type {
  EmployeeActivityPage,
  EmployeeDetail,
} from "../types/api";

import EmployeeActivityTimeline from "../components/employees/detail/EmployeeActivityTimeline";
import EmployeeBehaviorBaseline from "../components/employees/detail/EmployeeBehaviorBaseline";
import EmployeeDetailHeader from "../components/employees/detail/EmployeeDetailHeader";
import EmployeeDetailHero from "../components/employees/detail/EmployeeDetailHero";
import EmployeeIncidentHistory from "../components/employees/detail/EmployeeIncidentHistory";
import EmployeeRecentAnomalies from "../components/employees/detail/EmployeeRecentAnomalies";
import EmployeeSecuritySummary from "../components/employees/detail/EmployeeSecuritySummary";


const ACTIVITY_LIMIT =
  30;

const AUTO_REFRESH_MS =
  10_000;


function formatRefreshLabel(
  ageSeconds: number,
  refreshedAt:
    | number
    | null,
): string {
  if (
    refreshedAt === null
  ) {
    return "Waiting for refresh";
  }

  if (
    ageSeconds < 2
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


function EmployeeDetailPage() {
  const navigate =
    useNavigate();

  const {
    userId,
  } = useParams<{
    userId: string;
  }>();


  useLayoutEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [
    userId,
  ]);


  const [
    employee,
    setEmployee,
  ] = useState<
    EmployeeDetail
    | null
  >(
    null,
  );


  const [
    activity,
    setActivity,
  ] = useState<
    EmployeeActivityPage
    | null
  >(
    null,
  );


  const [
    isInitialLoading,
    setIsInitialLoading,
  ] = useState(
    true,
  );


  const [
    isManualRefreshing,
    setIsManualRefreshing,
  ] = useState(
    false,
  );


  const [
    error,
    setError,
  ] = useState<
    string
    | null
  >(
    null,
  );


  const [
    isNotFound,
    setIsNotFound,
  ] = useState(
    false,
  );


  const [
    lastRefreshedAt,
    setLastRefreshedAt,
  ] = useState<
    number
    | null
  >(
    null,
  );


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


  // ----------------------------------------------------------
  // Shared data loader
  //
  // Used by:
  // - manual refresh
  // - silent 10-second refresh
  //
  // Background refresh does not change the initial loading
  // state and therefore does not flash or disturb the page.
  // ----------------------------------------------------------

  const loadEmployeeWorkspace =
    useCallback(
      async (
        options?: {
          manual?: boolean;
        },
      ) => {
        if (
          !userId
        ) {
          return;
        }

        if (
          refreshInFlightRef.current
        ) {
          return;
        }

        refreshInFlightRef.current =
          true;

        const isManual =
          options?.manual
          ?? false;


        if (
          isManual
        ) {
          setIsManualRefreshing(
            true,
          );
        }


        try {
          const [
            employeeDetail,
            activityPage,
          ] = await Promise.all([
            getEmployeeDetail(
              userId,
            ),

            getEmployeeActivity(
              userId,
              ACTIVITY_LIMIT,
              0,
            ),
          ]);


          setEmployee(
            employeeDetail,
          );

          setActivity(
            activityPage,
          );

          setLastRefreshedAt(
            Date.now(),
          );

          setRefreshAgeSeconds(
            0,
          );

          setIsNotFound(
            false,
          );

          setError(
            null,
          );
        } catch (
          caughtError
        ) {
          if (
            caughtError
            instanceof SentinelApiError
            && caughtError.status
            === 404
          ) {
            setIsNotFound(
              true,
            );

            setEmployee(
              null,
            );

            setActivity(
              null,
            );

            setError(
              null,
            );

            return;
          }


          /*
           * Initial/manual failures are surfaced to the analyst.
           *
           * Silent automatic refresh failures deliberately do not
           * remove or replace already-rendered investigation data.
           */
          if (
            isManual
          ) {
            setError(
              "SENTINEL could not refresh this employee investigation workspace. Confirm that the backend and PostgreSQL are running.",
            );
          }
        } finally {
          if (
            isManual
          ) {
            setIsManualRefreshing(
              false,
            );
          }

          refreshInFlightRef.current =
            false;
        }
      },
      [
        userId,
      ],
    );


  // ----------------------------------------------------------
  // Initial page load
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled =
      false;


    async function loadInitialEmployee() {
      if (
        !userId
      ) {
        return;
      }

      setIsInitialLoading(
        true,
      );

      try {
        const [
          employeeDetail,
          activityPage,
        ] = await Promise.all([
          getEmployeeDetail(
            userId,
          ),

          getEmployeeActivity(
            userId,
            ACTIVITY_LIMIT,
            0,
          ),
        ]);


        if (
          cancelled
        ) {
          return;
        }


        setEmployee(
          employeeDetail,
        );

        setActivity(
          activityPage,
        );

        setLastRefreshedAt(
          Date.now(),
        );

        setRefreshAgeSeconds(
          0,
        );

        setIsNotFound(
          false,
        );

        setError(
          null,
        );
      } catch (
        caughtError
      ) {
        if (
          cancelled
        ) {
          return;
        }


        if (
          caughtError
          instanceof SentinelApiError
          && caughtError.status
          === 404
        ) {
          setIsNotFound(
            true,
          );

          setEmployee(
            null,
          );

          setActivity(
            null,
          );

          setError(
            null,
          );

          return;
        }


        setError(
          "SENTINEL could not load this employee investigation workspace. Confirm that the backend and PostgreSQL are running.",
        );
      } finally {
        if (
          !cancelled
        ) {
          setIsInitialLoading(
            false,
          );
        }
      }
    }


    void loadInitialEmployee();


    return () => {
      cancelled = true;
    };
  }, [
    userId,
  ]);


  // ----------------------------------------------------------
  // Silent 10-second refresh
  //
  // This does NOT:
  // - show the page loading state
  // - spin the manual refresh button
  // - reset scroll
  // - navigate
  // - clear existing data
  // ----------------------------------------------------------

  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          void loadEmployeeWorkspace();
        },
        AUTO_REFRESH_MS,
      );


    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, [
    loadEmployeeWorkspace,
  ]);


  // ----------------------------------------------------------
  // Refresh-age badge
  //
  // Purely visual timer.
  // It does NOT perform API requests.
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // Navigation helpers
  // ----------------------------------------------------------

  function openAnomaly(
    eventId: string,
  ) {
    navigate(
      `/anomalies/${encodeURIComponent(
        eventId,
      )}`,
    );
  }


  function openIncident(
    incidentId: string,
  ) {
    navigate(
      `/incidents/${encodeURIComponent(
        incidentId,
      )}`,
    );
  }


  // ----------------------------------------------------------
  // Initial loading state
  // ----------------------------------------------------------

  if (
    isInitialLoading
  ) {
    return (
      <main
        className="
          mx-auto
          w-full
          max-w-[1600px]
          px-5 py-7
          sm:px-7
          lg:px-8
        "
      >
        <div
          className="
            animate-pulse
          "
        >
          <div
            className="
              h-9
              w-28
              rounded-lg
              bg-slate-900
            "
          />

          <div
            className="
              mt-7
              h-3
              w-44
              rounded
              bg-cyan-950/60
            "
          />

          <div
            className="
              mt-4
              h-10
              w-80
              max-w-full
              rounded
              bg-slate-900
            "
          />

          <div
            className="
              mt-3
              h-4
              w-[620px]
              max-w-full
              rounded
              bg-slate-900/80
            "
          />

          <div
            className="
              mt-8
              h-[180px]
              rounded-2xl
              border
              border-slate-800
              bg-[#101826]/70
            "
          />

          <div
            className="
              mt-5
              grid
              gap-4
              lg:grid-cols-2
            "
          >
            <div
              className="
                h-[280px]
                rounded-2xl
                border
                border-slate-800
                bg-[#101826]/70
              "
            />

            <div
              className="
                h-[280px]
                rounded-2xl
                border
                border-slate-800
                bg-[#101826]/70
              "
            />
          </div>
        </div>
      </main>
    );
  }


  // ----------------------------------------------------------
  // 404 state
  // ----------------------------------------------------------

  if (
    isNotFound
    || !userId
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
              Employee Intelligence
            </p>

            <h1
              className="
                mt-3 text-2xl
                font-semibold
                text-white
              "
            >
              Employee not found
            </h1>

            <p
              className="
                mt-3 text-sm
                leading-6
                text-slate-500
              "
            >
              The requested employee identity could
              not be located in SENTINEL.
            </p>

            <button
              type="button"
              onClick={() => {
                navigate(
                  "/employees",
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
              ← Return to Employees
            </button>
          </section>
        </main>
      );
  }


  // ----------------------------------------------------------
  // Data unavailable after initial failure
  // ----------------------------------------------------------

  if (
    employee === null
    || activity === null
  ) {
    return (
      <main
        className="
          mx-auto
          w-full
          max-w-[1600px]
          px-5 py-7
          sm:px-7
          lg:px-8
        "
      >
        <EmployeeDetailHeader
          refreshLabel={
            formatRefreshLabel(
              refreshAgeSeconds,
              lastRefreshedAt,
            )
          }
          isRefreshing={
            isManualRefreshing
          }
          onBack={() => {
            navigate(
              "/employees",
            );
          }}
          onRefresh={() => {
            void loadEmployeeWorkspace({
              manual: true,
            });
          }}
        />

        <section
          role="alert"
          className="
            mt-8
            rounded-2xl
            border
            border-red-900/50
            bg-red-950/15
            px-6 py-12
            text-center
          "
        >
          <p
            className="
              text-sm
              text-red-300
            "
          >
            {error
              ?? "Employee investigation data is currently unavailable."}
          </p>

          <button
            type="button"
            onClick={() => {
              void loadEmployeeWorkspace({
                manual: true,
              });
            }}
            className="
              mt-5
              rounded-xl
              border
              border-slate-700
              bg-[#111a28]
              px-4 py-2.5
              text-xs
              font-semibold
              text-slate-300
              transition-all
              duration-200
              hover:border-cyan-800/70
              hover:bg-cyan-950/25
              hover:text-cyan-200
            "
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }


  // ----------------------------------------------------------
  // Investigation workspace
  // ----------------------------------------------------------

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-[1600px]
        px-5 py-7
        sm:px-7
        lg:px-8
      "
    >
      <EmployeeDetailHeader
        refreshLabel={
          formatRefreshLabel(
            refreshAgeSeconds,
            lastRefreshedAt,
          )
        }
        isRefreshing={
          isManualRefreshing
        }
        onBack={() => {
          navigate(
            "/employees",
          );
        }}
        onRefresh={() => {
          void loadEmployeeWorkspace({
            manual: true,
          });
        }}
      />


      {error && (
        <div
          role="alert"
          className="
            mt-5
            rounded-xl
            border
            border-red-900/50
            bg-red-950/15
            px-4 py-3
            text-xs
            text-red-300
          "
        >
          {error}
        </div>
      )}


      <div
        className="
          mt-7
        "
      >
        <EmployeeDetailHero
          employee={
            employee
          }
        />
      </div>


      <div
        className="
          mt-5
        "
      >
        <EmployeeSecuritySummary
          security={
            employee.security
          }
        />
      </div>


      <div
        className="
          mt-5
          grid
          gap-5
          xl:grid-cols-[0.9fr_1.1fr]
          xl:items-start
        "
      >
        <EmployeeBehaviorBaseline
          baseline={
            employee.baseline
          }
        />

        <EmployeeRecentAnomalies
          anomalies={
            employee
              .recent_anomalies
          }
          onOpenAnomaly={
            openAnomaly
          }
        />
      </div>


      <div
        className="
          mt-5
        "
      >
        <EmployeeIncidentHistory
          incidents={
            employee.incidents
          }
          onOpenIncident={
            openIncident
          }
        />
      </div>


      <div
        className="
          mt-5
        "
      >
        <EmployeeActivityTimeline
          activity={
            activity.items
          }
          totalActivity={
            activity.total
          }
          onOpenAnomaly={
            openAnomaly
          }
          onOpenIncident={
            openIncident
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
        SENTINEL employee security views display
        operational identity context, behavioral
        baselines and observable security activity
        only. Private simulator ground-truth labels
        are never exposed in the analyst workspace.
      </footer>
    </main>
  );
}


export default EmployeeDetailPage;