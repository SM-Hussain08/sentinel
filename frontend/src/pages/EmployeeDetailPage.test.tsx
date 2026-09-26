import {
  act,
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
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getEmployeeActivity,
  getEmployeeDetail,
  SentinelApiError,
} from "../services/api";

import {
  makeEmployeeActivityPage,
  makeEmployeeDetail,
} from "../test/fixtures/employees";

import EmployeeDetailPage from "./EmployeeDetailPage";


vi.mock(
  "../services/api",
  async (
    importOriginal,
  ) => {
    const actual =
      await importOriginal<
        typeof import(
          "../services/api"
        )
      >();

    return {
      ...actual,

      getEmployeeActivity:
        vi.fn(),

      getEmployeeDetail:
        vi.fn(),
    };
  },
);


vi.mock(
  "../components/employees/detail/EmployeeDetailHeader",
  () => ({
    default: ({
      refreshLabel,
      isRefreshing,
      onBack,
      onRefresh,
    }: {
      refreshLabel: string;
      isRefreshing: boolean;
      onBack: () => void;
      onRefresh: () => void;
    }) => (
      <header>
        <span>
          {refreshLabel}
        </span>

        <button
          type="button"
          onClick={
            onBack
          }
        >
          Back to Employees
        </button>

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
            : "Refresh Employee"}
        </button>
      </header>
    ),
  }),
);


vi.mock(
  "../components/employees/detail/EmployeeDetailHero",
  () => ({
    default: ({
      employee,
    }: {
      employee: {
        user_id: string;
        name: string;
      };
    }) => (
      <div>
        Employee hero:
        {" "}
        {employee.user_id}
        {" "}
        {employee.name}
      </div>
    ),
  }),
);


vi.mock(
  "../components/employees/detail/EmployeeSecuritySummary",
  () => ({
    default: () => (
      <div>
        Security summary
      </div>
    ),
  }),
);


vi.mock(
  "../components/employees/detail/EmployeeBehaviorBaseline",
  () => ({
    default: () => (
      <div>
        Behavior baseline
      </div>
    ),
  }),
);


vi.mock(
  "../components/employees/detail/EmployeeRecentAnomalies",
  () => ({
    default: ({
      onOpenAnomaly,
    }: {
      onOpenAnomaly: (
        eventId: string,
      ) => void;
    }) => (
      <div>
        <span>
          Recent anomalies
        </span>

        <button
          type="button"
          onClick={() => {
            onOpenAnomaly(
              "EVT / SPECIAL",
            );
          }}
        >
          Open related anomaly
        </button>
      </div>
    ),
  }),
);


vi.mock(
  "../components/employees/detail/EmployeeIncidentHistory",
  () => ({
    default: ({
      onOpenIncident,
    }: {
      onOpenIncident: (
        incidentId: string,
      ) => void;
    }) => (
      <div>
        <span>
          Incident history
        </span>

        <button
          type="button"
          onClick={() => {
            onOpenIncident(
              "INC / SPECIAL",
            );
          }}
        >
          Open related incident
        </button>
      </div>
    ),
  }),
);


vi.mock(
  "../components/employees/detail/EmployeeActivityTimeline",
  () => ({
    default: ({
      activity,
      totalActivity,
      onOpenAnomaly,
      onOpenIncident,
    }: {
      activity: unknown[];
      totalActivity: number;
      onOpenAnomaly: (
        eventId: string,
      ) => void;
      onOpenIncident: (
        incidentId: string,
      ) => void;
    }) => (
      <div>
        <div>
          Activity items:
          {" "}
          {activity.length}
        </div>

        <div>
          Activity total:
          {" "}
          {totalActivity}
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenAnomaly(
              "EVT / TIMELINE",
            );
          }}
        >
          Open timeline anomaly
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenIncident(
              "INC / TIMELINE",
            );
          }}
        >
          Open timeline incident
        </button>
      </div>
    ),
  }),
);


const mockedGetEmployeeDetail =
  vi.mocked(
    getEmployeeDetail,
  );

const mockedGetEmployeeActivity =
  vi.mocked(
    getEmployeeActivity,
  );


function EmployeesDestination() {
  return (
    <div>
      Employees destination
    </div>
  );
}


function AnomalyDestination() {
  const {
    eventId,
  } = useParams();

  return (
    <div>
      Anomaly destination:
      {" "}
      {eventId}
    </div>
  );
}


function IncidentDestination() {
  const {
    incidentId,
  } = useParams();

  return (
    <div>
      Incident destination:
      {" "}
      {incidentId}
    </div>
  );
}


function renderPage(
  route =
    "/employees/EMP-001",
) {
  return render(
    <MemoryRouter
      initialEntries={[
        route,
      ]}
    >
      <Routes>
        <Route
          path="/employees/:userId"
          element={
            <EmployeeDetailPage />
          }
        />

        <Route
          path="/employees"
          element={
            <EmployeesDestination />
          }
        />

        <Route
          path="/anomalies/:eventId"
          element={
            <AnomalyDestination />
          }
        />

        <Route
          path="/incidents/:incidentId"
          element={
            <IncidentDestination />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


beforeEach(
  () => {
    vi.clearAllMocks();

    Object.defineProperty(
      window,
      "scrollTo",
      {
        configurable:
          true,

        value:
          vi.fn(),
      },
    );

    mockedGetEmployeeDetail
      .mockResolvedValue(
        makeEmployeeDetail(),
      );

    mockedGetEmployeeActivity
      .mockResolvedValue(
        makeEmployeeActivityPage(),
      );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
  },
);


describe(
  "EmployeeDetailPage",
  () => {
    it(
      "loads the employee workspace from the route parameter",
      async () => {
        renderPage();

        await waitFor(
          () => {
            expect(
              mockedGetEmployeeDetail,
            ).toHaveBeenCalledWith(
              "EMP-001",
            );

            expect(
              mockedGetEmployeeActivity,
            ).toHaveBeenCalledWith(
              "EMP-001",
              30,
              0,
            );
          },
        );

        expect(
          await screen.findByText(
            /Employee hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Refreshed just now",
          ),
        ).toBeInTheDocument();

        expect(
          window.scrollTo,
        ).toHaveBeenCalledWith({
          top:
            0,

          left:
            0,

          behavior:
            "auto",
        });
      },
    );


    it(
      "decodes an encoded employee route before requesting data",
      async () => {
        renderPage(
          "/employees/EMP%20%2F%20001",
        );

        await waitFor(
          () => {
            expect(
              mockedGetEmployeeDetail,
            ).toHaveBeenCalledWith(
              "EMP / 001",
            );

            expect(
              mockedGetEmployeeActivity,
            ).toHaveBeenCalledWith(
              "EMP / 001",
              30,
              0,
            );
          },
        );
      },
    );


    it(
      "renders employee not found for a 404 response",
      async () => {
        mockedGetEmployeeDetail
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Employee not found",
              404,
            ),
          );

        renderPage();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Employee not found",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /requested employee identity could not be located/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "returns to the employee directory from the not-found state",
      async () => {
        const user =
          userEvent.setup();

        mockedGetEmployeeDetail
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Employee not found",
              404,
            ),
          );

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Employee not found",
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "← Return to Employees",
            },
          ),
        );

        expect(
          screen.getByText(
            "Employees destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows the initial workspace failure and allows retry",
      async () => {
        const user =
          userEvent.setup();

        mockedGetEmployeeDetail
          .mockRejectedValueOnce(
            new Error(
              "backend unavailable",
            ),
          )
          .mockResolvedValueOnce(
            makeEmployeeDetail(),
          );

        renderPage();

        expect(
          await screen.findByText(
            "SENTINEL could not load this employee investigation workspace. Confirm that the backend and PostgreSQL are running.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "alert",
          ),
        ).toBeInTheDocument();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Try Again",
            },
          ),
        );

        expect(
          await screen.findByText(
            /Employee hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetEmployeeDetail,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "manually refreshes both employee detail and activity",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Employee hero:/,
        );

        expect(
          mockedGetEmployeeDetail,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetEmployeeActivity,
        ).toHaveBeenCalledTimes(
          1,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Employee",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetEmployeeDetail,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetEmployeeActivity,
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
      "surfaces manual refresh failure while preserving existing workspace data",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Employee hero:/,
        );

        mockedGetEmployeeDetail
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
                "Refresh Employee",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh this employee investigation workspace. Confirm that the backend and PostgreSQL are running.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Employee hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Security summary",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "silently refreshes the workspace every ten seconds",
      async () => {
        vi.useFakeTimers();

        renderPage();

        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );

        expect(
          mockedGetEmployeeDetail,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetEmployeeActivity,
        ).toHaveBeenCalledTimes(
          1,
        );

        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              10_000,
            );
          },
        );

        expect(
          mockedGetEmployeeDetail,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetEmployeeActivity,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          screen.queryByText(
            "Refreshing...",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "preserves rendered investigation data when a silent refresh fails",
      async () => {
        vi.useFakeTimers();

        mockedGetEmployeeDetail
          .mockResolvedValueOnce(
            makeEmployeeDetail(),
          )
          .mockRejectedValueOnce(
            new Error(
              "silent refresh failed",
            ),
          );

        renderPage();

        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );

        expect(
          screen.getByText(
            /Employee hero:/,
          ),
        ).toBeInTheDocument();

        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              10_000,
            );
          },
        );

        expect(
          screen.getByText(
            /Employee hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "SENTINEL could not refresh this employee investigation workspace. Confirm that the backend and PostgreSQL are running.",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "navigates back to the employee directory",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Employee hero:/,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Back to Employees",
            },
          ),
        );

        expect(
          screen.getByText(
            "Employees destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to an encoded related anomaly route",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Open related anomaly",
            },
          ),
        );

        expect(
          screen.getByText(
            "Anomaly destination: EVT / SPECIAL",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to an encoded related incident route",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Open related incident",
            },
          ),
        );

        expect(
          screen.getByText(
            "Incident destination: INC / SPECIAL",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
