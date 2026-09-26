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
  getIncidentsForEvent,
  getMLEventAnalysis,
  getMLModelInfo,
  SentinelApiError,
} from "../services/api";

import {
  makeMLEventAnalysis,
  makeMLModelInfo,
} from "../test/fixtures/anomalies";

import {
  makeIncidentListItem,
} from "../test/fixtures/incidents";

import AnomalyDetailPage from "./AnomalyDetailPage";


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

      getIncidentsForEvent:
        vi.fn(),

      getMLEventAnalysis:
        vi.fn(),

      getMLModelInfo:
        vi.fn(),
    };
  },
);


vi.mock(
  "../components/anomalies/AnomalyDetailHero",
  () => ({
    default: ({
      analysis,
    }: {
      analysis: {
        event_id: string;
      };
    }) => (
      <div>
        Analysis hero:
        {" "}
        {analysis.event_id}
      </div>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyDetailKpiCard",
  () => ({
    default: ({
      label,
      value,
    }: {
      label: string;
      value: string;
    }) => (
      <div>
        {label}
        :
        {" "}
        {value}
      </div>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyDetectorContext",
  () => ({
    default: () => (
      <div>
        Detector context
      </div>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyExplanation",
  () => ({
    default: () => (
      <div>
        Anomaly explanation
      </div>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyFeatureSignals",
  () => ({
    default: () => (
      <div>
        Feature signals
      </div>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyFeatureSnapshot",
  () => ({
    default: ({
      features,
    }: {
      features:
        Record<
          string,
          unknown
        >;
    }) => (
      <div>
        Feature count:
        {" "}
        {
          Object.keys(
            features,
          ).length
        }
      </div>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyLinkedIncidents",
  () => ({
    default: ({
      incidents,
      onOpenIncident,
    }: {
      incidents:
        Array<{
          incident_id: string;
        }>;

      onOpenIncident: (
        incidentId: string,
      ) => void;
    }) => (
      <div>
        <div>
          Linked incidents:
          {" "}
          {incidents.length}
        </div>

        {incidents.map(
          (incident) => (
            <button
              key={
                incident.incident_id
              }
              type="button"
              onClick={() => {
                onOpenIncident(
                  incident.incident_id,
                );
              }}
            >
              Open linked incident
              {" "}
              {incident.incident_id}
            </button>
          ),
        )}
      </div>
    ),
  }),
);


const mockedGetAnalysis =
  vi.mocked(
    getMLEventAnalysis,
  );

const mockedGetIncidents =
  vi.mocked(
    getIncidentsForEvent,
  );

const mockedGetModelInfo =
  vi.mocked(
    getMLModelInfo,
  );


function AnomaliesDestination() {
  return (
    <div>
      Anomalies destination
    </div>
  );
}


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
    "/anomalies/EVT-001",
) {
  return render(
    <MemoryRouter
      initialEntries={[
        route,
      ]}
    >
      <Routes>
        <Route
          path="/anomalies/:eventId"
          element={
            <AnomalyDetailPage />
          }
        />

        <Route
          path="/anomalies"
          element={
            <AnomaliesDestination />
          }
        />

        <Route
          path="/employees/:userId"
          element={
            <EmployeeDestination />
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

    mockedGetAnalysis
      .mockResolvedValue(
        makeMLEventAnalysis(),
      );

    mockedGetIncidents
      .mockResolvedValue([
        makeIncidentListItem(),
      ]);

    mockedGetModelInfo
      .mockResolvedValue(
        makeMLModelInfo(),
      );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
  },
);


describe(
  "AnomalyDetailPage",
  () => {
    it(
      "loads analysis, linked incidents and model context from the route parameter",
      async () => {
        renderPage();

        expect(
          screen.getByText(
            "Loading Anomaly Analysis",
          ),
        ).toBeInTheDocument();

        await waitFor(
          () => {
            expect(
              mockedGetAnalysis,
            ).toHaveBeenCalledWith(
              "EVT-001",
            );

            expect(
              mockedGetIncidents,
            ).toHaveBeenCalledWith(
              "EVT-001",
            );

            expect(
              mockedGetModelInfo,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Detection Analysis Workspace",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Analysis hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Refreshed just now",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "decodes an encoded event route before requesting data",
      async () => {
        renderPage(
          "/anomalies/EVT%20%2F%20001",
        );

        await waitFor(
          () => {
            expect(
              mockedGetAnalysis,
            ).toHaveBeenCalledWith(
              "EVT / 001",
            );

            expect(
              mockedGetIncidents,
            ).toHaveBeenCalledWith(
              "EVT / 001",
            );
          },
        );
      },
    );


    it(
      "renders detection not found for a 404",
      async () => {
        mockedGetAnalysis
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Not found",
              404,
            ),
          );

        renderPage();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Detection not found",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /No selected-detector anomaly analysis could be found/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "returns to anomaly intelligence from the not-found state",
      async () => {
        const user =
          userEvent.setup();

        mockedGetAnalysis
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Not found",
              404,
            ),
          );

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Detection not found",
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "← Return to Anomalies",
            },
          ),
        );

        expect(
          screen.getByText(
            "Anomalies destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows the initial analysis failure",
      async () => {
        mockedGetAnalysis
          .mockRejectedValueOnce(
            new Error(
              "backend unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Analysis unavailable",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "SENTINEL could not load this anomaly analysis. Confirm that the backend and PostgreSQL are running.",
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
      "manually refreshes analysis, incidents and model context",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Analysis hero:/,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Detection",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetAnalysis,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetIncidents,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetModelInfo,
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
      "shows manual refresh warning while preserving existing analysis",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Analysis hero:/,
        );

        mockedGetAnalysis
          .mockRejectedValueOnce(
            new Error(
              "refresh failed",
            ),
          );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Detection",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh this anomaly analysis. Existing intelligence remains visible.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "SENTINEL could not refresh this anomaly analysis.",
        );

        expect(
          screen.getByText(
            /Analysis hero:/,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "silently refreshes analysis and incident correlation every ten seconds",
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
          mockedGetAnalysis,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetIncidents,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetModelInfo,
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
          mockedGetAnalysis,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetIncidents,
        ).toHaveBeenCalledTimes(
          2,
        );

        /*
         * Background refresh deliberately
         * does not reload static model
         * metadata.
         */
        expect(
          mockedGetModelInfo,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "preserves current analysis and shows a warning when silent refresh fails",
      async () => {
        vi.useFakeTimers();

        mockedGetAnalysis
          .mockResolvedValueOnce(
            makeMLEventAnalysis(),
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
            /Analysis hero:/,
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
            /Analysis hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Automatic refresh could not retrieve the latest anomaly intelligence. Existing analysis remains visible.",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates back to anomaly intelligence",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Analysis hero:/,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "← Back to Anomalies",
            },
          ),
        );

        expect(
          screen.getByText(
            "Anomalies destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to the encoded employee workspace",
      async () => {
        const user =
          userEvent.setup();

        mockedGetAnalysis
          .mockResolvedValue(
            makeMLEventAnalysis({
              employee_user_id:
                "EMP / SPECIAL",
            }),
          );

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                /EMP \/ SPECIAL/,
            },
          ),
        );

        expect(
          screen.getByText(
            "Employee destination: EMP / SPECIAL",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to an encoded linked incident workspace",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC / SPECIAL",
            }),
          ]);

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                /Open linked incident INC \/ SPECIAL/,
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
