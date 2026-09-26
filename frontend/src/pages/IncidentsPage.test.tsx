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
  getIncidents,
  getIncidentSummary,
} from "../services/api";

import {
  makeIncidentListItem,
  makeIncidentSummary,
} from "../test/fixtures/incidents";

import IncidentsPage from "./IncidentsPage";


vi.mock(
  "../services/api",
  () => ({
    getIncidents:
      vi.fn(),

    getIncidentSummary:
      vi.fn(),
  }),
);


vi.mock(
  "../components/incidents/IncidentKpiCard",
  () => ({
    default: ({
      label,
      value,
    }: {
      label: string;
      value:
        | string
        | number;
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
  "../components/incidents/IncidentQueue",
  () => ({
    default: ({
      incidents,
      totalFiltered,
      pageStart,
      onOpenIncident,
    }: {
      incidents: Array<{
        incident_id: string;
        title: string;
        severity: string;
      }>;
      totalFiltered: number;
      pageStart: number;
      onOpenIncident: (
        incidentId: string,
      ) => void;
    }) => (
      <section>
        <div>
          Queue total:
          {" "}
          {totalFiltered}
        </div>

        <div>
          Page start:
          {" "}
          {pageStart}
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
              Open incident
              {" "}
              {incident.incident_id}
              {" "}
              {incident.title}
              {" "}
              {incident.severity}
            </button>
          ),
        )}
      </section>
    ),
  }),
);


const mockedGetIncidents =
  vi.mocked(
    getIncidents,
  );

const mockedGetSummary =
  vi.mocked(
    getIncidentSummary,
  );


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


function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/incidents",
      ]}
    >
      <Routes>
        <Route
          path="/incidents"
          element={
            <IncidentsPage />
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


function expectPage(
  current: number,
  total: number,
) {
  expect(
    screen.getByText(
      (
        _content,
        element,
      ) => {
        if (
          element?.tagName
          !== "P"
        ) {
          return false;
        }

        const normalized =
          element.textContent
            ?.replace(
              /\s+/g,
              " ",
            )
            .trim();

        return normalized
          === `Page ${current} of ${total}`;
      },
    ),
  ).toBeInTheDocument();
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

    mockedGetIncidents
      .mockResolvedValue([
        makeIncidentListItem(),
      ]);

    mockedGetSummary
      .mockResolvedValue(
        makeIncidentSummary(),
      );
  },
);


describe(
  "IncidentsPage",
  () => {
    it(
      "loads incidents and summary on startup",
      async () => {
        renderPage();

        expect(
          screen.getByText(
            "Loading Incident Intelligence",
          ),
        ).toBeInTheDocument();

        await waitFor(
          () => {
            expect(
              mockedGetIncidents,
            ).toHaveBeenCalledWith(
              500,
            );

            expect(
              mockedGetSummary,
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
                "Investigation Workspace",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Queue total: 1",
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
      "filters incidents by search locally without another API request",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC-AUTH",

              title:
                "Suspicious Authentication",

              incident_type:
                "ACCOUNT_COMPROMISE",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-FILE",

              title:
                "Sensitive File Access",

              incident_type:
                "DATA_ACCESS",

              summary:
                "Unusual access to sensitive financial documents.",
            }),
          ]);

        renderPage();

        expect(
          await screen.findByText(
            "Queue total: 2",
          ),
        ).toBeInTheDocument();

        await user.type(
          screen.getByPlaceholderText(
            "Search incident, identity or type...",
          ),
          "authentication",
        );

        expect(
          screen.getByText(
            "Queue total: 1",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /INC-AUTH/,
            },
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetIncidents,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "matches search case-insensitively",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC-SEARCH",

              title:
                "Privileged Login Activity",
            }),
          ]);

        renderPage();

        await screen.findByText(
          "Queue total: 1",
        );

        await user.type(
          screen.getByPlaceholderText(
            "Search incident, identity or type...",
          ),
          "PRIVILEGED",
        );

        expect(
          screen.getByText(
            "Queue total: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "filters incidents by severity locally",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC-CRITICAL",

              severity:
                "CRITICAL",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-HIGH",

              severity:
                "HIGH",
            }),
          ]);

        renderPage();

        await screen.findByText(
          "Queue total: 2",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /^CRITICAL\b/,
            },
          ),
        );

        expect(
          screen.getByText(
            "Queue total: 1",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /INC-CRITICAL/,
            },
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetIncidents,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "sorts incidents by oldest first locally",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC-NEW",

              title:
                "New Incident",

              first_seen:
                "2026-09-23T12:00:00Z",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-OLD",

              title:
                "Old Incident",

              first_seen:
                "2026-09-22T12:00:00Z",
            }),
          ]);

        renderPage();

        await screen.findByText(
          "Queue total: 2",
        );

        /*
         * Default NEWEST ordering.
         */
        let rows =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open incident/,
            },
          );

        expect(
          rows[0],
        ).toHaveTextContent(
          "New Incident",
        );

        await user.selectOptions(
          screen.getByRole(
            "combobox",
            {
              name:
                "Sort incidents",
            },
          ),
          "OLDEST",
        );

        rows =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open incident/,
            },
          );

        expect(
          rows[0],
        ).toHaveTextContent(
          "Old Incident",
        );

        expect(
          mockedGetIncidents,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "sorts incidents by severity locally",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC-MEDIUM",

              title:
                "Medium Incident",

              severity:
                "MEDIUM",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-CRITICAL",

              title:
                "Critical Incident",

              severity:
                "CRITICAL",
            }),
          ]);

        renderPage();

        await screen.findByText(
          "Queue total: 2",
        );

        await user.selectOptions(
          screen.getByRole(
            "combobox",
            {
              name:
                "Sort incidents",
            },
          ),
          "SEVERITY",
        );

        const rows =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open incident/,
            },
          );

        expect(
          rows[0],
        ).toHaveTextContent(
          "Critical Incident",
        );
      },
    );


    it(
      "sorts incidents by event count locally",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC-FEW",

              title:
                "Few Events",

              event_count:
                2,
            }),

            makeIncidentListItem({
              incident_id:
                "INC-MANY",

              title:
                "Many Events",

              event_count:
                12,
            }),
          ]);

        renderPage();

        await screen.findByText(
          "Queue total: 2",
        );

        await user.selectOptions(
          screen.getByRole(
            "combobox",
            {
              name:
                "Sort incidents",
            },
          ),
          "EVENTS",
        );

        const rows =
          screen.getAllByRole(
            "button",
            {
              name:
                /Open incident/,
            },
          );

        expect(
          rows[0],
        ).toHaveTextContent(
          "Many Events",
        );
      },
    );


    it(
      "paginates incidents in groups of fifteen",
      async () => {
        const user =
          userEvent.setup();

        const incidents =
          Array.from(
            {
              length:
                16,
            },
            (
              _,
              index,
            ) =>
              makeIncidentListItem({
                incident_id:
                  `INC-${String(
                    index + 1,
                  ).padStart(
                    3,
                    "0",
                  )}`,

                title:
                  `Incident ${index + 1}`,

                first_seen:
                  new Date(
                    Date.UTC(
                      2026,
                      8,
                      23,
                      index,
                    ),
                  ).toISOString(),
              }),
          );

        mockedGetIncidents
          .mockResolvedValue(
            incidents,
          );

        renderPage();

        await screen.findByText(
          "15 incidents per page",
        );

        expectPage(
          1,
          2,
        );

        expect(
          screen.getAllByRole(
            "button",
            {
              name:
                /Open incident/,
            },
          ),
        ).toHaveLength(
          15,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Next →",
            },
          ),
        );

        expectPage(
          2,
          2,
        );

        expect(
          screen.getAllByRole(
            "button",
            {
              name:
                /Open incident/,
            },
          ),
        ).toHaveLength(
          1,
        );

        expect(
          window.scrollTo,
        ).toHaveBeenCalled();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "← Previous",
            },
          ),
        );

        expectPage(
          1,
          2,
        );
      },
    );


    it(
      "resets pagination when the search changes",
      async () => {
        const user =
          userEvent.setup();

        const incidents =
          Array.from(
            {
              length:
                16,
            },
            (
              _,
              index,
            ) =>
              makeIncidentListItem({
                incident_id:
                  `INC-RESET-${index + 1}`,

                title:
                  index === 0
                    ? "Special Match"
                    : `Other Incident ${index + 1}`,

                first_seen:
                  new Date(
                    Date.UTC(
                      2026,
                      8,
                      23,
                      index,
                    ),
                  ).toISOString(),
              }),
          );

        mockedGetIncidents
          .mockResolvedValue(
            incidents,
          );

        renderPage();

        await screen.findByText(
          "15 incidents per page",
        );

        expectPage(
          1,
          2,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Next →",
            },
          ),
        );

        expectPage(
          2,
          2,
        );

        await user.type(
          screen.getByPlaceholderText(
            "Search incident, identity or type...",
          ),
          "Special Match",
        );

        expectPage(
          1,
          1,
        );

        expect(
          screen.getByText(
            "Queue total: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "manually refreshes incident intelligence and summary",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Investigation Workspace",
          },
        );

        expect(
          mockedGetIncidents,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetSummary,
        ).toHaveBeenCalledTimes(
          1,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Incidents",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetIncidents,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetSummary,
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
      "shows the initial incident load failure",
      async () => {
        mockedGetIncidents
          .mockRejectedValueOnce(
            new Error(
              "backend unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "SENTINEL could not load incident intelligence. Confirm that the backend and PostgreSQL are running.",
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
      "shows manual refresh failure while preserving current incident intelligence",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          "Queue total: 1",
        );

        mockedGetIncidents
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
                "Refresh Incidents",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh incident intelligence.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Queue total: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to the encoded incident investigation route",
      async () => {
        const user =
          userEvent.setup();

        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC / SPECIAL",

              title:
                "Encoded Incident",
            }),
          ]);

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                /Open incident INC \/ SPECIAL/,
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
