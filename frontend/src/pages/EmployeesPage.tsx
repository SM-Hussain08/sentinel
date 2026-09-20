import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getEmployeeDirectory,
  getEmployeeWorkforceSummary,
} from "../services/api";

import type {
  EmployeeDirectoryItem,
  EmployeeWorkforceSummary,
} from "../types/api";

import EmployeeDirectory from "../components/employees/EmployeeDirectory";
import EmployeeFilters from "../components/employees/EmployeeFilters";
import EmployeeKpiGrid from "../components/employees/EmployeeKpiGrid";
import EmployeePageHeader from "../components/employees/EmployeePageHeader";
import EmployeePagination from "../components/employees/EmployeePagination";

import {
  EMPLOYEE_RISK_RANK,
} from "../components/employees/employeeFormatters";

import type {
  EmployeeRiskFilter,
  EmployeeSortOption,
  EmployeeStatusFilter,
} from "../components/employees/employeeTypes";


const EMPLOYEES_PER_PAGE =
  30;

const EMPLOYEE_API_CHUNK_SIZE =
  200;

const SEARCH_DEBOUNCE_MS =
  300;


interface DirectoryLoadResult {
  items:
    EmployeeDirectoryItem[];

  departments:
    string[];
}


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


async function loadCompleteDirectory(
  search: string,
  department: string,
  status:
    EmployeeStatusFilter,
): Promise<DirectoryLoadResult> {
  const firstPage =
    await getEmployeeDirectory({
      search:
        search.trim()
          || undefined,

      department:
        department
          || undefined,

      status,

      limit:
        EMPLOYEE_API_CHUNK_SIZE,

      offset: 0,
    });

  const items = [
    ...firstPage.items,
  ];

  if (
    firstPage.total
    > firstPage.items.length
  ) {
    const remainingOffsets:
      number[] = [];

    for (
      let offset =
        EMPLOYEE_API_CHUNK_SIZE;
      offset < firstPage.total;
      offset +=
        EMPLOYEE_API_CHUNK_SIZE
    ) {
      remainingOffsets.push(
        offset,
      );
    }

    const remainingPages =
      await Promise.all(
        remainingOffsets.map(
          (offset) =>
            getEmployeeDirectory({
              search:
                search.trim()
                  || undefined,

              department:
                department
                  || undefined,

              status,

              limit:
                EMPLOYEE_API_CHUNK_SIZE,

              offset,
            }),
        ),
      );

    for (
      const page
      of remainingPages
    ) {
      items.push(
        ...page.items,
      );
    }
  }

  return {
    items,

    departments:
      firstPage.departments,
  };
}


function EmployeesPage() {
  const navigate =
    useNavigate();


  const [
    employees,
    setEmployees,
  ] = useState<
    EmployeeDirectoryItem[]
  >([]);


  const [
    workforceSummary,
    setWorkforceSummary,
  ] = useState<
    EmployeeWorkforceSummary
    | null
  >(null);


  const [
    departments,
    setDepartments,
  ] = useState<
    string[]
  >([]);


  const [
    searchQuery,
    setSearchQuery,
  ] = useState(
    "",
  );


  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState(
    "",
  );


  const [
    department,
    setDepartment,
  ] = useState(
    "",
  );


  const [
    status,
    setStatus,
  ] = useState<
    EmployeeStatusFilter
  >(
    "all",
  );


  const [
    riskFilter,
    setRiskFilter,
  ] = useState<
    EmployeeRiskFilter
  >(
    "ALL",
  );


  const [
    sortOption,
    setSortOption,
  ] = useState<
    EmployeeSortOption
  >(
    "RISK",
  );


  const [
    currentPage,
    setCurrentPage,
  ] = useState(
    1,
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
    string
    | null
  >(
    null,
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


  // ----------------------------------------------------------
  // Search debounce
  // ----------------------------------------------------------

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          setDebouncedSearch(
            searchQuery,
          );
        },
        SEARCH_DEBOUNCE_MS,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    searchQuery,
  ]);


  // ----------------------------------------------------------
  // Initial workforce summary
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled =
      false;


    async function loadSummary() {
      try {
        const summary =
          await getEmployeeWorkforceSummary();

        if (
          cancelled
        ) {
          return;
        }

        setWorkforceSummary(
          summary,
        );

        setError(
          null,
        );
      } catch {
        if (
          !cancelled
        ) {
          setError(
            "SENTINEL could not load workforce security intelligence. Confirm that the backend and PostgreSQL are running.",
          );
        }
      }
    }


    void loadSummary();


    return () => {
      cancelled = true;
    };
  }, []);


  // ----------------------------------------------------------
  // Directory load
  //
  // Search, department and employment status are server-side.
  // Risk and sorting are applied across the complete returned
  // employee set below.
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled =
      false;


    async function loadDirectory() {
      setIsLoading(
        true,
      );

      try {
        const result =
          await loadCompleteDirectory(
            debouncedSearch,
            department,
            status,
          );

        if (
          cancelled
        ) {
          return;
        }

        setEmployees(
          result.items,
        );

        setDepartments(
          result.departments,
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
            "SENTINEL could not load employee security intelligence. Confirm that the backend and PostgreSQL are running.",
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


    void loadDirectory();


    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    department,
    status,
  ]);


  // ----------------------------------------------------------
  // Refresh-age display
  //
  // This updates only the text label.
  // It does NOT fetch data automatically.
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
  // Manual refresh
  // ----------------------------------------------------------

  async function refreshEmployees() {
    setIsRefreshing(
      true,
    );

    try {
      const [
        summary,
        directory,
      ] = await Promise.all([
        getEmployeeWorkforceSummary(),

        loadCompleteDirectory(
          searchQuery,
          department,
          status,
        ),
      ]);


      setWorkforceSummary(
        summary,
      );

      setEmployees(
        directory.items,
      );

      setDepartments(
        directory.departments,
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
        "SENTINEL could not refresh employee intelligence.",
      );
    } finally {
      setIsRefreshing(
        false,
      );
    }
  }


  // ----------------------------------------------------------
  // Risk filtering + full-result sorting
  // ----------------------------------------------------------

  const filteredAndSortedEmployees =
    useMemo(() => {
      const filtered =
        riskFilter === "ALL"
          ? [
              ...employees,
            ]
          : employees.filter(
              (employee) =>
                employee
                  .security
                  .highest_risk_level
                === riskFilter,
            );


      return filtered.sort(
        (
          first,
          second,
        ) => {
          switch (
            sortOption
          ) {
            case "ANOMALIES": {
              const difference =
                second
                  .security
                  .anomaly_count
                - first
                  .security
                  .anomaly_count;

              if (
                difference
                !== 0
              ) {
                return difference;
              }

              break;
            }


            case "INCIDENTS": {
              const difference =
                second
                  .security
                  .incident_count
                - first
                  .security
                  .incident_count;

              if (
                difference
                !== 0
              ) {
                return difference;
              }

              break;
            }


            case "RECENT": {
              const firstTime =
                first
                  .security
                  .last_activity_at
                  ? new Date(
                      first
                        .security
                        .last_activity_at,
                    ).getTime()
                  : 0;

              const secondTime =
                second
                  .security
                  .last_activity_at
                  ? new Date(
                      second
                        .security
                        .last_activity_at,
                    ).getTime()
                  : 0;

              const difference =
                secondTime
                - firstTime;

              if (
                difference
                !== 0
              ) {
                return difference;
              }

              break;
            }


            case "USER_ASC":
              return first.user_id
                .localeCompare(
                  second.user_id,
                  undefined,
                  {
                    numeric: true,
                  },
                );


            case "RISK":
            default: {
              const riskDifference =
                EMPLOYEE_RISK_RANK[
                  second
                    .security
                    .highest_risk_level
                ]
                - EMPLOYEE_RISK_RANK[
                  first
                    .security
                    .highest_risk_level
                ];

              if (
                riskDifference
                !== 0
              ) {
                return riskDifference;
              }


              const anomalyDifference =
                second
                  .security
                  .anomaly_count
                - first
                  .security
                  .anomaly_count;

              if (
                anomalyDifference
                !== 0
              ) {
                return anomalyDifference;
              }


              const incidentDifference =
                second
                  .security
                  .incident_count
                - first
                  .security
                  .incident_count;

              if (
                incidentDifference
                !== 0
              ) {
                return incidentDifference;
              }

              break;
            }
          }


          return first.user_id
            .localeCompare(
              second.user_id,
              undefined,
              {
                numeric: true,
              },
            );
        },
      );
    }, [
      employees,
      riskFilter,
      sortOption,
    ]);


  // ----------------------------------------------------------
  // 30 employees per page
  // ----------------------------------------------------------

  const totalResults =
    filteredAndSortedEmployees
      .length;


  const totalPages =
    Math.ceil(
      totalResults
      / EMPLOYEES_PER_PAGE,
    );


  const safeCurrentPage =
    totalPages === 0
      ? 1
      : Math.min(
          currentPage,
          totalPages,
        );


  const pageOffset =
    (
      safeCurrentPage - 1
    )
    * EMPLOYEES_PER_PAGE;

  const visibleEmployees =
    filteredAndSortedEmployees
      .slice(
        pageOffset,
        pageOffset
          + EMPLOYEES_PER_PAGE,
      );


  const showingFrom =
    totalResults === 0
      ? 0
      : pageOffset + 1;


  const showingTo =
    totalResults === 0
      ? 0
      : Math.min(
          pageOffset
            + visibleEmployees.length,
          totalResults,
        );


  const hasPrevious =
    safeCurrentPage > 1;


  const hasNext =
    safeCurrentPage
    < totalPages;


  // ----------------------------------------------------------
  // Filter handlers
  // ----------------------------------------------------------

  function handleSearchChange(
    value: string,
  ) {
    setSearchQuery(
      value,
    );

    setCurrentPage(
      1,
    );
  }


  function handleDepartmentChange(
    value: string,
  ) {
    setDepartment(
      value,
    );

    setCurrentPage(
      1,
    );
  }


  function handleStatusChange(
    value:
      EmployeeStatusFilter,
  ) {
    setStatus(
      value,
    );

    setCurrentPage(
      1,
    );
  }


  function handleRiskChange(
    value:
      EmployeeRiskFilter,
  ) {
    setRiskFilter(
      value,
    );

    setCurrentPage(
      1,
    );
  }


  function handleSortChange(
    value:
      EmployeeSortOption,
  ) {
    setSortOption(
      value,
    );

    setCurrentPage(
      1,
    );
  }


  function openEmployee(
    userId: string,
  ) {
    navigate(
      `/employees/${encodeURIComponent(
        userId,
      )}`,
    );
  }


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
      <EmployeePageHeader
        refreshLabel={
          formatRefreshLabel(
            refreshAgeSeconds,
            lastRefreshedAt,
          )
        }
        isRefreshing={
          isRefreshing
        }
        onRefresh={
          refreshEmployees
        }
      />


      {error && (
        <div
          className="
            mt-6
            rounded-xl
            border
            border-red-900/60
            bg-red-950/20
            px-4 py-3
            text-xs
            leading-5
            text-red-300
          "
        >
          <div
            className="
              flex
              items-start
              gap-3
            "
          >
            <span
              className="
                mt-0.5
                text-red-400
              "
            >
              !
            </span>

            <p>
              {error}
            </p>
          </div>
        </div>
      )}


      <div
        className="
          mt-7
        "
      >
        {workforceSummary ? (
          <EmployeeKpiGrid
            summary={
              workforceSummary
            }
          />
        ) : (
          <section
            className="
              grid
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            {[
              "Workforce",
              "Critical Exposure",
              "Active Cases",
              "Behavioral Signals",
            ].map(
              (label) => (
                <div
                  key={label}
                  className="
                    h-[142px]
                    animate-pulse
                    rounded-2xl
                    border
                    border-slate-800
                    bg-[#101826]/70
                    p-5
                  "
                >
                  <div
                    className="
                      h-2.5
                      w-24
                      rounded
                      bg-slate-800
                    "
                  />

                  <div
                    className="
                      mt-5
                      h-8
                      w-16
                      rounded
                      bg-slate-800/80
                    "
                  />

                  <div
                    className="
                      mt-4
                      h-2.5
                      w-3/4
                      rounded
                      bg-slate-800/60
                    "
                  />
                </div>
              ),
            )}
          </section>
        )}
      </div>


      <div
        className="
          mt-6
        "
      >
        <EmployeeFilters
          searchQuery={
            searchQuery
          }
          department={
            department
          }
          status={
            status
          }
          risk={
            riskFilter
          }
          sort={
            sortOption
          }
          departments={
            departments
          }
          onSearchChange={
            handleSearchChange
          }
          onDepartmentChange={
            handleDepartmentChange
          }
          onStatusChange={
            handleStatusChange
          }
          onRiskChange={
            handleRiskChange
          }
          onSortChange={
            handleSortChange
          }
        />
      </div>


      <div
        className="
          mt-5
        "
      >
        <EmployeeDirectory
          key={[
            safeCurrentPage,
            riskFilter,
            sortOption,
            debouncedSearch,
            department,
            status,
          ].join(
            "-",
          )}
          employees={
            visibleEmployees
          }
          totalResults={
            totalResults
          }
          showingFrom={
            showingFrom
          }
          showingTo={
            showingTo
          }
          isLoading={
            isLoading
          }
          onOpenEmployee={
            openEmployee
          }
        />
      </div>


      <div
        className="
          mt-4
        "
      >
        <EmployeePagination
          currentPage={
            safeCurrentPage
          }
          totalPages={
            totalPages
          }
          showingFrom={
            showingFrom
          }
          showingTo={
            showingTo
          }
          totalResults={
            totalResults
          }
          hasPrevious={
            hasPrevious
          }
          hasNext={
            hasNext
          }
          onPrevious={() => {
            setCurrentPage(
              Math.max(
                safeCurrentPage - 1,
                1,
              ),
            );
          }}
          onNext={() => {
            setCurrentPage(
              Math.min(
                safeCurrentPage + 1,
                Math.max(
                  totalPages,
                  1,
                ),
              ),
            );
          }}
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


export default EmployeesPage;