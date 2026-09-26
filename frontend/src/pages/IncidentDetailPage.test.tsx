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
  getIncidentDetail,
  getIncidentInvestigation,
  getIncidentTimeline,
  SentinelApiError,
} from "../services/api";

import {
  makeIncidentDetail,
  makeIncidentInvestigation,
  makeIncidentTimelineEvent,
} from "../test/fixtures/incidents";

import IncidentDetailPage from "./IncidentDetailPage";


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

      getIncidentDetail:
        vi.fn(),

      getIncidentInvestigation:
        vi.fn(),

      getIncidentTimeline:
        vi.fn(),
    };
  },
);


vi.mock(
  "../components/incidents/IncidentHero",
  () => ({
    default: ({
      incident,
    }: {
      incident: {
        incident_id: string;
        title: string;
      };
    }) => (
      <div>
        Incident hero:
        {" "}
        {incident.incident_id}
        {" "}
        {incident.title}
      </div>
    ),
  }),
);


vi.mock(
  "../components/incidents/IncidentIndicators",
  () => ({
    default: ({
      indicators,
    }: {
      indicators: unknown[];
    }) => (
      <div>
        Indicator count:
        {" "}
        {indicators.length}
      </div>
    ),
  }),
);


vi.mock(
  "../components/incidents/IncidentTimeline",
  () => ({
    default: ({
      events,
    }: {
      events: Array<{
        event_id: string;
      }>;
    }) => (
      <div>
        <div>
          Timeline count:
          {" "}
          {events.length}
        </div>

        {events.map(
          (event) => (
            <span
              key={
                event.event_id
              }
            >
              Timeline event
              {" "}
              {event.event_id}
            </span>
          ),
        )}
      </div>
    ),
  }),
);


vi.mock(
  "../components/incidents/InvestigationPanel",
  () => ({
    default: ({
      investigation,
      severity,
    }: {
      investigation: {
        incident_id: string;
      };
      severity: string;
    }) => (
      <div>
        Investigation panel:
        {" "}
        {investigation.incident_id}
        {" "}
        {severity}
      </div>
    ),
  }),
);


vi.mock(
  "../components/incidents/DecisionSupportPanel",
  () => ({
    default: ({
      analystQuestions,
      containmentActions,
    }: {
      analystQuestions: string[];
      containmentActions: unknown[];
    }) => (
      <div>
        Decision support:
        {" "}
        {analystQuestions.length}
        {" "}
        questions,
        {" "}
        {containmentActions.length}
        {" "}
        actions
      </div>
    ),
  }),
);


vi.mock(
  "../components/incidents/AIInvestigator",
  () => ({
    default: ({
      incidentId,
      statusRefreshSignal,
    }: {
      incidentId: string;
      statusRefreshSignal: number;
    }) => (
      <div>
        AI investigator:
        {" "}
        {incidentId}
        {" "}
        signal
        {" "}
        {statusRefreshSignal}
      </div>
    ),
  }),
);


vi.mock(
  "../components/incidents/AIAnalystChat",
  () => ({
    default: ({
      incidentId,
      statusRefreshSignal,
    }: {
      incidentId: string;
      statusRefreshSignal: number;
    }) => (
      <div>
        AI analyst chat:
        {" "}
        {incidentId}
        {" "}
        signal
        {" "}
        {statusRefreshSignal}
      </div>
    ),
  }),
);


const mockedGetDetail =
  vi.mocked(
    getIncidentDetail,
  );

const mockedGetTimeline =
  vi.mocked(
    getIncidentTimeline,
  );

const mockedGetInvestigation =
  vi.mocked(
    getIncidentInvestigation,
  );


function IncidentsDestination() {
  return (
    <div>
      Incidents destination
    </div>
  );
}


function renderPage(
  route =
    "/incidents/INC-001",
) {
  return render(
    <MemoryRouter
      initialEntries={[
        route,
      ]}
    >
      <Routes>
        <Route
          path="/incidents/:incidentId"
          element={
            <IncidentDetailPage />
          }
        />

        <Route
          path="/incidents"
          element={
            <IncidentsDestination />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


beforeEach(
  () => {
    vi.clearAllMocks();

    mockedGetDetail
      .mockResolvedValue(
        makeIncidentDetail(),
      );

    mockedGetTimeline
      .mockResolvedValue([
        makeIncidentTimelineEvent(),
      ]);

    mockedGetInvestigation
      .mockResolvedValue(
        makeIncidentInvestigation(),
      );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
  },
);


describe(
  "IncidentDetailPage",
  () => {
    it(
      "loads detail, timeline and deterministic investigation from the route parameter",
      async () => {
        renderPage();

        expect(
          screen.getByText(
            "Loading Incident Investigation",
          ),
        ).toBeInTheDocument();

        await waitFor(
          () => {
            expect(
              mockedGetDetail,
            ).toHaveBeenCalledWith(
              "INC-001",
            );

            expect(
              mockedGetTimeline,
            ).toHaveBeenCalledWith(
              "INC-001",
            );

            expect(
              mockedGetInvestigation,
            ).toHaveBeenCalledWith(
              "INC-001",
            );
          },
        );

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Investigation Workspace",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Incident hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Timeline count: 1",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Investigation panel:/,
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
      "decodes an encoded incident route before requesting intelligence",
      async () => {
        renderPage(
          "/incidents/INC%20%2F%20001",
        );

        await waitFor(
          () => {
            expect(
              mockedGetDetail,
            ).toHaveBeenCalledWith(
              "INC / 001",
            );

            expect(
              mockedGetTimeline,
            ).toHaveBeenCalledWith(
              "INC / 001",
            );

            expect(
              mockedGetInvestigation,
            ).toHaveBeenCalledWith(
              "INC / 001",
            );
          },
        );
      },
    );


    it(
      "renders incident not found for a 404 response",
      async () => {
        mockedGetDetail
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Incident not found",
              404,
            ),
          );

        renderPage();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Incident not found",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /requested incident could not be located/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "returns to incident intelligence from the not-found state",
      async () => {
        const user =
          userEvent.setup();

        mockedGetDetail
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Incident not found",
              404,
            ),
          );

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Incident not found",
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "← Return to Incidents",
            },
          ),
        );

        expect(
          screen.getByText(
            "Incidents destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows the initial incident workspace failure",
      async () => {
        mockedGetDetail
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
                "Investigation unavailable",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "SENTINEL could not load this incident investigation. Confirm that the backend and PostgreSQL are running.",
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
      "manually refreshes all deterministic incident intelligence",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Incident hero:/,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Incident",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetDetail,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetTimeline,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetInvestigation,
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
      "shows manual refresh warning while preserving current incident intelligence",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Incident hero:/,
        );

        mockedGetDetail
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
                "Refresh Incident",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh this incident. Existing intelligence remains visible.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "SENTINEL could not refresh this incident.",
        );

        expect(
          screen.getByText(
            /Incident hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Timeline count: 1",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Investigation panel:/,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "silently refreshes all deterministic incident intelligence every ten seconds",
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
          mockedGetDetail,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetTimeline,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetInvestigation,
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
          mockedGetDetail,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetTimeline,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetInvestigation,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "preserves current intelligence and shows a warning when silent refresh fails",
      async () => {
        vi.useFakeTimers();

        mockedGetDetail
          .mockResolvedValueOnce(
            makeIncidentDetail(),
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
            /Incident hero:/,
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
            /Incident hero:/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Automatic refresh could not retrieve the latest incident data. Existing intelligence remains visible.",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders deterministic decision-support evidence",
      async () => {
        renderPage();

        expect(
          await screen.findByText(
            "Decision support: 1 questions, 1 actions",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Indicator count: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "provides the incident identity to both AI surfaces without testing AI internals",
      async () => {
        renderPage();

        expect(
          await screen.findByText(
            /AI investigator: INC-001/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /AI analyst chat: INC-001/,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates back to the incident queue",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          /Incident hero:/,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "← Back to Incidents",
            },
          ),
        );

        expect(
          screen.getByText(
            "Incidents destination",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
