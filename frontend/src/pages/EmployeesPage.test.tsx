import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getEmployeeDirectory,
  getEmployeeWorkforceSummary,
} from "../services/api";

import {
  makeEmployeeDirectoryItem,
  makeEmployeeDirectoryPage,
  makeEmployeeWorkforceSummary,
} from "../test/fixtures/employees";

import EmployeesPage from "./EmployeesPage";


vi.mock(
  "../services/api",
  () => ({
    getEmployeeDirectory:
      vi.fn(),

    getEmployeeWorkforceSummary:
      vi.fn(),
  }),
);


vi.mock(
  "../components/employees/EmployeePageHeader",
  () => ({
    default: ({
      refreshLabel,
      isRefreshing,
      onRefresh,
    }: {
      refreshLabel: string;
      isRefreshing: boolean;
      onRefresh: () => void;
    }) => (
      <header>
        <h1>
          Employee Intelligence
        </h1>

        <span>
          {refreshLabel}
        </span>

        <button
          type="button"
          disabled={
            isRefreshing
          }
          onClick={
            onRefresh
          }
        >
          {isRefreshing
            ? "Refreshing..."
            : "Refresh Employees"}
        </button>
      </header>
    ),
  }),
);


vi.mock(
  "../components/employees/EmployeeKpiGrid",
  () => ({
    default: ({
      summary,
    }: {
      summary: {
        total_employees:
          number;
      };
    }) => (
      <div>
        Workforce total:
        {" "}
        {summary.total_employees}
      </div>
    ),
  }),
);


vi.mock(
  "../components/employees/EmployeeFilters",
  () => ({
    default: ({
      searchQuery,
      departments,
      onSearchChange,
      onDepartmentChange,
      onStatusChange,
      onRiskChange,
      onSortChange,
    }: {
      searchQuery: string;
      departments: string[];
      onSearchChange: (
        value: string,
      ) => void;
      onDepartmentChange: (
        value: string,
      ) => void;
      onStatusChange: (
        value:
          | "all"
          | "active"
          | "inactive",
      ) => void;
      onRiskChange: (
        value:
          | "ALL"
          | "CRITICAL"
          | "HIGH"
          | "MEDIUM"
          | "LOW"
          | "NORMAL",
      ) => void;
      onSortChange: (
        value:
          | "RISK"
          | "ANOMALIES"
          | "INCIDENTS"
          | "RECENT"
          | "USER_ASC",
      ) => void;
    }) => (
      <section>
        <input
          aria-label="employee search"
          value={
            searchQuery
          }
          onChange={
            (event) => {
              onSearchChange(
                event.target.value,
              );
            }
          }
        />

        <div>
          Departments:
          {" "}
          {departments.join(
            ", ",
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onDepartmentChange(
              "Finance",
            );
          }}
        >
          Finance Department
        </button>

        <button
          type="button"
          onClick={() => {
            onStatusChange(
              "active",
            );
          }}
        >
          Active Employees
        </button>

        <button
          type="button"
          onClick={() => {
            onRiskChange(
              "CRITICAL",
            );
          }}
        >
          Critical Risk
        </button>

        <button
          type="button"
          onClick={() => {
            onSortChange(
              "USER_ASC",
            );
          }}
        >
          Sort User ID
        </button>

        <button
          type="button"
          onClick={() => {
            onSortChange(
              "ANOMALIES",
            );
          }}
        >
          Sort Anomalies
        </button>

        <button
          type="button"
          onClick={() => {
            onSortChange(
              "INCIDENTS",
            );
          }}
        >
          Sort Incidents
        </button>

        <button
          type="button"
          onClick={() => {
            onSortChange(
              "RECENT",
            );
          }}
        >
          Sort Recent
        </button>

        <button
          type="button"
          onClick={() => {
            onSortChange(
              "RISK",
            );
          }}
        >
          Sort Risk
        </button>
      </section>
    ),
  }),
);


vi.mock(
  "../components/employees/EmployeeDirectory",
  () => ({
    default: ({
      employees,
      totalResults,
      isLoading,
      onOpenEmployee,
    }: {
      employees: Array<{
        user_id: string;
        name: string;
      }>;
      totalResults: number;
      isLoading: boolean;
      onOpenEmployee: (
        userId: string,
      ) => void;
    }) => (
      <section>
        <div>
          Directory count:
          {" "}
          {totalResults}
        </div>

        {isLoading && (
          <div>
            Directory loading
          </div>
        )}

        {employees.map(
          (employee) => (
            <button
              key={
                employee.user_id
              }
              type="button"
              onClick={() => {
                onOpenEmployee(
                  employee.user_id,
                );
              }}
            >
              Open employee
              {" "}
              {employee.name}
            </button>
          ),
        )}
      </section>
    ),
  }),
);


vi.mock(
  "../components/employees/EmployeePagination",
  () => ({
    default: ({
      currentPage,
      totalPages,
      hasPrevious,
      hasNext,
      onPrevious,
      onNext,
    }: {
      currentPage: number;
      totalPages: number;
      hasPrevious: boolean;
      hasNext: boolean;
      onPrevious: () => void;
      onNext: () => void;
    }) => (
      <div>
        <span>
          Page
          {" "}
          {currentPage}
          {" "}
          of
          {" "}
          {Math.max(
            totalPages,
            1,
          )}
        </span>

        <button
          type="button"
          disabled={
            !hasPrevious
          }
          onClick={
            onPrevious
          }
        >
          Previous
        </button>

        <button
          type="button"
          disabled={
            !hasNext
          }
          onClick={
            onNext
          }
        >
          Next
        </button>
      </div>
    ),
  }),
);


const mockedGetDirectory =
  vi.mocked(
    getEmployeeDirectory,
  );

const mockedGetSummary =
  vi.mocked(
    getEmployeeWorkforceSummary,
  );


function EmployeeDestination() {
  const {
    userId,
  } = useParams();

  return (
    <div>
      Employee destination:
      {" "}
      {userId}
    </div>
  );
}


function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/employees",
      ]}
    >
      <Routes>
        <Route
          path="/employees"
          element={
            <EmployeesPage />
          }
        />

        <Route
          path="/employees/:userId"
          element={
            <EmployeeDestination />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


function makeDirectoryResponse(
  items = [
    makeEmployeeDirectoryItem(),
  ],
) {
  return makeEmployeeDirectoryPage({
    items,
    total:
      items.length,

    departments: [
      "Finance",
      "Engineering",
    ],
  });
}


beforeEach(
  () => {
    vi.clearAllMocks();

    mockedGetSummary
      .mockResolvedValue(
        makeEmployeeWorkforceSummary(),
      );

    mockedGetDirectory
      .mockResolvedValue(
        makeDirectoryResponse(),
      );
  },
);


describe(
  "EmployeesPage",
  () => {
    it(
      "loads workforce summary and employee directory on startup",
      async () => {
        renderPage();

        expect(
          screen.getByText(
            "Waiting for refresh",
          ),
        ).toBeInTheDocument();

        await waitFor(
          () => {
            expect(
              mockedGetSummary,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetDirectory,
            ).toHaveBeenCalledWith({
              search:
                undefined,

              department:
                undefined,

              status:
                "all",

              limit:
                200,

              offset:
                0,
            });
          },
        );

        expect(
          await screen.findByText(
            /Workforce total:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Departments: Finance, Engineering",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Directory count: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "debounces employee search before reloading the directory",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await waitFor(
          () => {
            expect(
              mockedGetDirectory,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        await user.type(
          screen.getByRole(
            "textbox",
            {
              name:
                "employee search",
            },
          ),
          "Aisha",
        );

        expect(
          mockedGetDirectory,
        ).toHaveBeenCalledTimes(
          1,
        );

        await waitFor(
          () => {
            expect(
              mockedGetDirectory,
            ).toHaveBeenLastCalledWith({
              search:
                "Aisha",

              department:
                undefined,

              status:
                "all",

              limit:
                200,

              offset:
                0,
            });
          },
          {
            timeout:
              1_000,
          },
        );
      },
    );


    it(
      "reloads server-side directory data when department changes",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await waitFor(
          () => {
            expect(
              mockedGetDirectory,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Finance Department",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetDirectory,
            ).toHaveBeenLastCalledWith({
              search:
                undefined,

              department:
                "Finance",

              status:
                "all",

              limit:
                200,

              offset:
                0,
            });
          },
        );
      },
    );


    it(
      "reloads server-side directory data when employment status changes",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await waitFor(
          () => {
            expect(
              mockedGetDirectory,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Active Employees",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetDirectory,
            ).toHaveBeenLastCalledWith({
              search:
                undefined,

              department:
                undefined,

              status:
                "active",

              limit:
                200,

              offset:
                0,
            });
          },
        );
      },
    );


    it(
      "applies risk filtering locally without requesting the directory again",
      async () => {
        const user =
          userEvent.setup();

        const criticalEmployee =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-CRITICAL",

            name:
              "Critical Employee",

            security: {
              ...makeEmployeeDirectoryItem()
                .security,

              highest_risk_level:
                "CRITICAL",
            },
          });

        const normalEmployee =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-NORMAL",

            name:
              "Normal Employee",

            security: {
              ...makeEmployeeDirectoryItem()
                .security,

              highest_risk_level:
                "NORMAL",
            },
          });

        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse([
              criticalEmployee,
              normalEmployee,
            ]),
          );

        renderPage();

        expect(
          await screen.findByText(
            "Directory count: 2",
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetDirectory,
        ).toHaveBeenCalledTimes(
          1,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Critical Risk",
            },
          ),
        );

        expect(
          screen.getByText(
            "Directory count: 1",
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetDirectory,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "sorts the complete employee result locally",
      async () => {
        const user =
          userEvent.setup();

        const baseSecurity =
          makeEmployeeDirectoryItem()
            .security;

        const employeeTwo =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-002",

            name:
              "Second Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "CRITICAL",
            },
          });

        const employeeOne =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-001",

            name:
              "First Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "NORMAL",
            },
          });

        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse([
              employeeTwo,
              employeeOne,
            ]),
          );

        renderPage();

        await screen.findByText(
          "Directory count: 2",
        );

        /*
        * Default page sorting is RISK,
        * so the CRITICAL employee should
        * appear first.
        */
        const beforeSort =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          );

        expect(
          beforeSort[0],
        ).toHaveTextContent(
          "Second Employee",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Sort User ID",
            },
          ),
        );

        /*
        * USER_ASC should reorder the
        * same locally held result set.
        */
        const afterSort =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          );

        expect(
          afterSort[0],
        ).toHaveTextContent(
          "First Employee",
        );

        /*
        * Sorting is client-side and
        * must not trigger another API
        * directory request.
        */
        expect(
          mockedGetDirectory,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "sorts employees by anomaly count",
      async () => {
        const user =
          userEvent.setup();

        const baseSecurity =
          makeEmployeeDirectoryItem()
            .security;


        const lowerAnomalies =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-001",

            name:
              "Lower Anomaly Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "NORMAL",

              anomaly_count:
                2,
            },
          });


        const higherAnomalies =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-002",

            name:
              "Higher Anomaly Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "NORMAL",

              anomaly_count:
                8,
            },
          });


        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse([
              lowerAnomalies,
              higherAnomalies,
            ]),
          );


        renderPage();


        await screen.findByText(
          "Directory count: 2",
        );


        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Sort Anomalies",
            },
          ),
        );


        const employees =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          );


        expect(
          employees[0],
        ).toHaveTextContent(
          "Higher Anomaly Employee",
        );


        expect(
          mockedGetDirectory,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "sorts employees by incident count",
      async () => {
        const user =
          userEvent.setup();

        const baseSecurity =
          makeEmployeeDirectoryItem()
            .security;


        const lowerIncidents =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-001",

            name:
              "Lower Incident Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "NORMAL",

              incident_count:
                1,
            },
          });


        const higherIncidents =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-002",

            name:
              "Higher Incident Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "NORMAL",

              incident_count:
                6,
            },
          });


        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse([
              lowerIncidents,
              higherIncidents,
            ]),
          );


        renderPage();


        await screen.findByText(
          "Directory count: 2",
        );


        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Sort Incidents",
            },
          ),
        );


        const employees =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          );


        expect(
          employees[0],
        ).toHaveTextContent(
          "Higher Incident Employee",
        );
      },
    );


    it(
      "sorts employees by most recent activity",
      async () => {
        const user =
          userEvent.setup();

        const baseSecurity =
          makeEmployeeDirectoryItem()
            .security;


        const noActivity =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-001",

            name:
              "No Activity Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "NORMAL",

              last_activity_at:
                null,
            },
          });


        const recentActivity =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-002",

            name:
              "Recent Activity Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "NORMAL",

              last_activity_at:
                "2026-09-24T15:00:00Z",
            },
          });


        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse([
              noActivity,
              recentActivity,
            ]),
          );


        renderPage();


        await screen.findByText(
          "Directory count: 2",
        );


        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Sort Recent",
            },
          ),
        );


        const employees =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          );


        expect(
          employees[0],
        ).toHaveTextContent(
          "Recent Activity Employee",
        );
      },
    );


    it(
      "breaks equal risk ties using anomalies and then incidents",
      async () => {
        const user =
          userEvent.setup();

        const baseSecurity =
          makeEmployeeDirectoryItem()
            .security;


        const lowerActivity =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-001",

            name:
              "Lower Activity Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "HIGH",

              anomaly_count:
                2,

              incident_count:
                1,
            },
          });


        const higherIncidents =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-002",

            name:
              "Higher Incident Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "HIGH",

              anomaly_count:
                2,

              incident_count:
                5,
            },
          });


        const higherAnomalies =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP-003",

            name:
              "Higher Anomaly Employee",

            security: {
              ...baseSecurity,

              highest_risk_level:
                "HIGH",

              anomaly_count:
                7,

              incident_count:
                0,
            },
          });


        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse([
              lowerActivity,
              higherIncidents,
              higherAnomalies,
            ]),
          );


        renderPage();


        await screen.findByText(
          "Directory count: 3",
        );


        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Sort Risk",
            },
          ),
        );


        const employees =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          );


        expect(
          employees[0],
        ).toHaveTextContent(
          "Higher Anomaly Employee",
        );

        expect(
          employees[1],
        ).toHaveTextContent(
          "Higher Incident Employee",
        );

        expect(
          employees[2],
        ).toHaveTextContent(
          "Lower Activity Employee",
        );
      },
    );


    it(
      "manually refreshes workforce and directory intelligence",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await waitFor(
          () => {
            expect(
              mockedGetSummary,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetDirectory,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Employees",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetSummary,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetDirectory,
            ).toHaveBeenCalledTimes(
              2,
            );
          },
        );

        expect(
          screen.getByText(
            "Refreshed just now",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows the initial directory load failure",
      async () => {
        mockedGetDirectory
          .mockRejectedValue(
            new Error(
              "directory unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "SENTINEL could not load employee security intelligence. Confirm that the backend and PostgreSQL are running.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "alert",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows the workforce-summary load failure",
      async () => {
        mockedGetSummary
          .mockRejectedValue(
            new Error(
              "summary unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "SENTINEL could not load workforce security intelligence. Confirm that the backend and PostgreSQL are running.",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows a manual refresh failure while preserving the page",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await waitFor(
          () => {
            expect(
              mockedGetSummary,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        mockedGetSummary
          .mockRejectedValueOnce(
            new Error(
              "refresh unavailable",
            ),
          );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Employees",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh employee intelligence.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Directory count: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to the encoded employee investigation route",
      async () => {
        const user =
          userEvent.setup();

        const employee =
          makeEmployeeDirectoryItem({
            user_id:
              "EMP / 001",

            name:
              "Encoded Employee",
          });

        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse([
              employee,
            ]),
          );

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                /Open employee Encoded Employee/,
            },
          ),
        );

        expect(
          screen.getByText(
            "Employee destination: EMP / 001",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "loads additional API chunks when the directory exceeds 200 employees",
      async () => {
        const firstItems =
          Array.from(
            {
              length:
                200,
            },
            (
              _,
              index,
            ) =>
              makeEmployeeDirectoryItem({
                id:
                  `id-${index}`,

                user_id:
                  `EMP-${index + 1}`,

                name:
                  `Employee ${index + 1}`,
              }),
          );

        const remainingItem =
          makeEmployeeDirectoryItem({
            id:
              "id-201",

            user_id:
              "EMP-201",

            name:
              "Employee 201",
          });

        mockedGetDirectory
          .mockResolvedValueOnce(
            makeEmployeeDirectoryPage({
              items:
                firstItems,

              total:
                201,

              departments: [
                "Finance",
              ],
            }),
          )
          .mockResolvedValueOnce(
            makeEmployeeDirectoryPage({
              items: [
                remainingItem,
              ],

              total:
                201,

              departments: [
                "Finance",
              ],
            }),
          );

        renderPage();

        await waitFor(
          () => {
            expect(
              mockedGetDirectory,
            ).toHaveBeenCalledTimes(
              2,
            );
          },
        );

        expect(
          mockedGetDirectory,
        ).toHaveBeenNthCalledWith(
          2,
          {
            search:
              undefined,

            department:
              undefined,

            status:
              "all",

            limit:
              200,

            offset:
              200,
          },
        );

        expect(
          screen.getByText(
            "Directory count: 201",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Page 1 of 7",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "moves between client-side employee pages",
      async () => {
        const user =
          userEvent.setup();

        const employees =
          Array.from(
            {
              length:
                31,
            },
            (
              _,
              index,
            ) =>
              makeEmployeeDirectoryItem({
                id:
                  `page-id-${index}`,

                user_id:
                  `EMP-${String(
                    index + 1,
                  ).padStart(
                    3,
                    "0",
                  )}`,

                name:
                  `Paged Employee ${index + 1}`,
              }),
          );

        mockedGetDirectory
          .mockResolvedValue(
            makeDirectoryResponse(
              employees,
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "Page 1 of 2",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          ),
        ).toHaveLength(
          30,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Next",
            },
          ),
        );

        expect(
          screen.getByText(
            "Page 2 of 2",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByRole(
            "button",
            {
              name:
                /Open employee/,
            },
          ),
        ).toHaveLength(
          1,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Previous",
            },
          ),
        );

        expect(
          screen.getByText(
            "Page 1 of 2",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
