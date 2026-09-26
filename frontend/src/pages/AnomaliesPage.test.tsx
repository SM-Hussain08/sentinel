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
  getMLAnomalyPage,
  getMLModelInfo,
  getMLSummary,
} from "../services/api";

import {
  makeMLAnomaly,
  makeMLAnomalyFeedPage,
  makeMLModelInfo,
  makeMLSummary,
} from "../test/fixtures/anomalies";

import AnomaliesPage from "./AnomaliesPage";


vi.mock(
  "../services/api",
  () => ({
    getMLAnomalyPage:
      vi.fn(),

    getMLModelInfo:
      vi.fn(),

    getMLSummary:
      vi.fn(),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyStatCard",
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
  "../components/anomalies/AnomalyRiskDistribution",
  () => ({
    default: ({
      summary,
    }: {
      summary:
        | {
            alert_count:
              number;
          }
        | null;
    }) => (
      <div>
        Risk distribution:
        {" "}
        {summary
          ? summary.alert_count
          : "none"}
      </div>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyFilters",
  () => ({
    default: ({
      searchQuery,
      riskFilter,
      riskCounts,
      onSearchQueryChange,
      onSearch,
      onRiskChange,
    }: {
      searchQuery: string;
      riskFilter:
        | "ALL"
        | "CRITICAL"
        | "HIGH"
        | "MEDIUM"
        | "LOW";
      riskCounts: Record<
        string,
        number
      >;
      onSearchQueryChange: (
        value: string,
      ) => void;
      onSearch: () => void;
      onRiskChange: (
        value:
          | "ALL"
          | "CRITICAL"
          | "HIGH"
          | "MEDIUM"
          | "LOW",
      ) => void;
    }) => (
      <section>
        <input
          aria-label="anomaly search"
          value={
            searchQuery
          }
          onChange={
            (event) => {
              onSearchQueryChange(
                event.target.value,
              );
            }
          }
        />

        <div>
          Current risk:
          {" "}
          {riskFilter}
        </div>

        <div>
          Critical count:
          {" "}
          {riskCounts.CRITICAL}
        </div>

        <button
          type="button"
          onClick={
            onSearch
          }
        >
          Search Anomalies
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
      </section>
    ),
  }),
);


vi.mock(
  "../components/anomalies/AnomalyQueue",
  () => ({
    default: ({
      anomalies,
      totalResults,
      currentOffset,
      hasPrevious,
      hasNext,
      onOpenAnomaly,
      onPrevious,
      onNext,
    }: {
      anomalies: Array<{
        event_id: string;
        risk_level: string;
      }>;
      totalResults: number;
      currentOffset: number;
      hasPrevious: boolean;
      hasNext: boolean;
      onOpenAnomaly: (
        eventId: string,
      ) => void;
      onPrevious: () => void;
      onNext: () => void;
    }) => (
      <section>
        <div>
          Feed total:
          {" "}
          {totalResults}
        </div>

        <div>
          Feed offset:
          {" "}
          {currentOffset}
        </div>

        {anomalies.map(
          (anomaly) => (
            <button
              key={
                anomaly.event_id
              }
              type="button"
              onClick={() => {
                onOpenAnomaly(
                  anomaly.event_id,
                );
              }}
            >
              Open anomaly
              {" "}
              {anomaly.event_id}
              {" "}
              {anomaly.risk_level}
            </button>
          ),
        )}

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
      </section>
    ),
  }),
);


const mockedGetAnomalyPage =
  vi.mocked(
    getMLAnomalyPage,
  );

const mockedGetModelInfo =
  vi.mocked(
    getMLModelInfo,
  );

const mockedGetSummary =
  vi.mocked(
    getMLSummary,
  );


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


function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/anomalies",
      ]}
    >
      <Routes>
        <Route
          path="/anomalies"
          element={
            <AnomaliesPage />
          }
        />

        <Route
          path="/anomalies/:eventId"
          element={
            <AnomalyDestination />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


function makePage({
  items = [
    makeMLAnomaly(),
  ],
  total =
    items.length,
  offset = 0,
  hasPrevious =
    false,
  hasNext =
    false,
}: {
  items?: ReturnType<
    typeof makeMLAnomaly
  >[];
  total?: number;
  offset?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
} = {}) {
  return makeMLAnomalyFeedPage({
    items,
    total,
    offset,
    has_previous:
      hasPrevious,
    has_next:
      hasNext,
  });
}


beforeEach(
  () => {
    vi.clearAllMocks();

    mockedGetSummary
      .mockResolvedValue(
        makeMLSummary(),
      );

    mockedGetModelInfo
      .mockResolvedValue(
        makeMLModelInfo(),
      );

    mockedGetAnomalyPage
      .mockResolvedValue(
        makePage(),
      );
  },
);


describe(
  "AnomaliesPage",
  () => {
    it(
      "loads summary, model context and anomaly feed on startup",
      async () => {
        renderPage();

        expect(
          screen.getByText(
            "Loading Anomaly Intelligence",
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
              mockedGetModelInfo,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenCalledWith({
              limit:
                50,

              offset:
                0,
            });
          },
        );

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Anomaly Intelligence",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Feed total: 1",
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
      "applies explicit search only after the analyst submits it",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Anomaly Intelligence",
          },
        );

        expect(
          mockedGetAnomalyPage,
        ).toHaveBeenCalledTimes(
          1,
        );

        await user.type(
          screen.getByRole(
            "textbox",
            {
              name:
                "anomaly search",
            },
          ),
          "VPN",
        );

        expect(
          mockedGetAnomalyPage,
        ).toHaveBeenCalledTimes(
          1,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Search Anomalies",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenLastCalledWith({
              riskLevel:
                undefined,

              search:
                "VPN",

              limit:
                50,

              offset:
                0,
            });
          },
        );
      },
    );


    it(
      "trims search text before requesting anomaly detections",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Anomaly Intelligence",
          },
        );

        await user.type(
          screen.getByRole(
            "textbox",
            {
              name:
                "anomaly search",
            },
          ),
          "   login failure   ",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Search Anomalies",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenLastCalledWith({
              riskLevel:
                undefined,

              search:
                "login failure",

              limit:
                50,

              offset:
                0,
            });
          },
        );
      },
    );


    it(
      "loads a risk-filtered feed from the first page",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Anomaly Intelligence",
          },
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

        await waitFor(
          () => {
            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenLastCalledWith({
              riskLevel:
                "CRITICAL",

              search:
                undefined,

              limit:
                50,

              offset:
                0,
            });
          },
        );

        expect(
          screen.getByText(
            "Current risk: CRITICAL",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "preserves the applied search when changing risk filter",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Anomaly Intelligence",
          },
        );

        await user.type(
          screen.getByRole(
            "textbox",
            {
              name:
                "anomaly search",
            },
          ),
          "remote",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Search Anomalies",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenLastCalledWith({
              riskLevel:
                undefined,

              search:
                "remote",

              limit:
                50,

              offset:
                0,
            });
          },
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

        await waitFor(
          () => {
            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenLastCalledWith({
              riskLevel:
                "CRITICAL",

              search:
                "remote",

              limit:
                50,

              offset:
                0,
            });
          },
        );
      },
    );


    it(
      "moves to the next anomaly feed page",
      async () => {
        const user =
          userEvent.setup();

        mockedGetAnomalyPage
          .mockResolvedValueOnce(
            makePage({
              total:
                100,

              offset:
                0,

              hasNext:
                true,
            }),
          )
          .mockResolvedValueOnce(
            makePage({
              total:
                100,

              offset:
                50,

              hasPrevious:
                true,
            }),
          );

        renderPage();

        await waitFor(
          () => {
            expect(
              screen.getByText(
                "Feed offset: 0",
              ),
            ).toBeInTheDocument();
          },
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

        await waitFor(
          () => {
            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenLastCalledWith({
              riskLevel:
                undefined,

              search:
                undefined,

              limit:
                50,

              offset:
                50,
            });
          },
        );

        expect(
          screen.getByText(
            "Feed offset: 50",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "moves back to the previous anomaly feed page",
      async () => {
        const user =
          userEvent.setup();

        mockedGetAnomalyPage
          .mockResolvedValueOnce(
            makePage({
              total:
                100,

              offset:
                50,

              hasPrevious:
                true,
            }),
          )
          .mockResolvedValueOnce(
            makePage({
              total:
                100,

              offset:
                0,

              hasNext:
                true,
            }),
          );

        renderPage();

        await waitFor(
          () => {
            expect(
              screen.getByText(
                "Feed offset: 50",
              ),
            ).toBeInTheDocument();
          },
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

        await waitFor(
          () => {
            expect(
              mockedGetAnomalyPage,
            ).toHaveBeenLastCalledWith({
              riskLevel:
                undefined,

              search:
                undefined,

              limit:
                50,

              offset:
                0,
            });
          },
        );
      },
    );


    it(
      "manually refreshes summary, model context and the current anomaly page",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Anomaly Intelligence",
          },
        );

        expect(
          mockedGetSummary,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetModelInfo,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetAnomalyPage,
        ).toHaveBeenCalledTimes(
          1,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Detections",
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
              mockedGetModelInfo,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetAnomalyPage,
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
      "shows the initial load failure",
      async () => {
        mockedGetSummary
          .mockRejectedValueOnce(
            new Error(
              "backend unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "SENTINEL could not load anomaly intelligence. Confirm that the backend and PostgreSQL are running.",
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
      "shows requested-feed failure without destroying the current page",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Anomaly Intelligence",
          },
        );

        mockedGetAnomalyPage
          .mockRejectedValueOnce(
            new Error(
              "feed unavailable",
            ),
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
          await screen.findByText(
            "SENTINEL could not load the requested anomaly detections.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Anomaly Intelligence",
            },
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows manual refresh failure while preserving existing anomaly intelligence",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Anomaly Intelligence",
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
                "Refresh Detections",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh anomaly intelligence.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Feed total: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to the encoded anomaly analysis route",
      async () => {
        const user =
          userEvent.setup();

        const anomaly =
          makeMLAnomaly({
            event_id:
              "EVT / SPECIAL",
          });

        mockedGetAnomalyPage
          .mockResolvedValue(
            makePage({
              items: [
                anomaly,
              ],
            }),
          );

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                /Open anomaly EVT \/ SPECIAL/,
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
      "derives risk counts from the ML summary",
      async () => {
        const summary =
          makeMLSummary({
            risk_distribution: {
              critical:
                4,

              high:
                3,

              medium:
                2,

              low:
                1,

              normal:
                0,
            },
          });

        mockedGetSummary
          .mockResolvedValue(
            summary,
          );

        renderPage();

        expect(
          await screen.findByText(
            "Critical count: 4",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
