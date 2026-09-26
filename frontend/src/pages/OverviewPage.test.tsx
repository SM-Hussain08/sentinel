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
} from "../types/api";

import {
  makeEmployee,
} from "../test/fixtures/employees";

import {
  makeIncidentListItem,
  makeIncidentSummary,
} from "../test/fixtures/incidents";

import {
  makeMLModelInfo,
  makeMLSummary,
} from "../test/fixtures/anomalies";

import {
  makeOperationsStatus,
} from "../test/fixtures/operations";

import OverviewPage from "./OverviewPage";


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

      getEmployees:
        vi.fn(),

      getEvaluationSummary:
        vi.fn(),

      getIncidents:
        vi.fn(),

      getIncidentSummary:
        vi.fn(),

      getMLModelInfo:
        vi.fn(),

      getMLSummary:
        vi.fn(),

      getOperationsStatus:
        vi.fn(),
    };
  },
);


vi.mock(
  "../components/overview/OverviewMetricCard",
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
  "../components/overview/OverviewRefreshControls",
  () => ({
    default: ({
      isRefreshing,
      isBackgroundRefreshing,
      processorStatus,
      onRefresh,
    }: {
      isRefreshing: boolean;
      isBackgroundRefreshing: boolean;
      processorStatus:
        | {
          health: string;
        }
        | null;

      onRefresh: () => void;
    }) => (
      <div>
        <div>
          Processor:
          {" "}
          {
            processorStatus?.health
            ?? "UNAVAILABLE"
          }
        </div>

        <div>
          Background:
          {" "}
          {
            isBackgroundRefreshing
              ? "yes"
              : "no"
          }
        </div>

        <button
          type="button"
          disabled={
            isRefreshing
            || isBackgroundRefreshing
          }
          onClick={
            onRefresh
          }
        >
          {isRefreshing
            ? "Refreshing Overview"
            : "Refresh Overview"}
        </button>
      </div>
    ),
  }),
);


vi.mock(
  "../components/overview/OverviewIncidentQueue",
  () => ({
    default: ({
      incidents,
      onOpenIncident,
      onOpenAllIncidents,
    }: {
      incidents:
        Array<{
          incident_id: string;
        }>;

      onOpenIncident: (
        incidentId: string,
      ) => void;

      onOpenAllIncidents:
        () => void;
    }) => (
      <div>
        <div>
          Priority count:
          {" "}
          {incidents.length}
        </div>

        <div>
          Priority order:
          {" "}
          {
            incidents
              .map(
                (
                  incident,
                ) =>
                  incident
                    .incident_id,
              )
              .join(",")
          }
        </div>

        {incidents.map(
          (
            incident,
          ) => (
            <button
              key={
                incident
                  .incident_id
              }
              type="button"
              onClick={() => {
                onOpenIncident(
                  incident
                    .incident_id,
                );
              }}
            >
              Open
              {" "}
              {
                incident
                  .incident_id
              }
            </button>
          ),
        )}

        <button
          type="button"
          onClick={
            onOpenAllIncidents
          }
        >
          View all incidents
        </button>
      </div>
    ),
  }),
);


const mockedGetEmployees =
  vi.mocked(
    getEmployees,
  );

const mockedGetEvaluation =
  vi.mocked(
    getEvaluationSummary,
  );

const mockedGetIncidents =
  vi.mocked(
    getIncidents,
  );

const mockedGetIncidentSummary =
  vi.mocked(
    getIncidentSummary,
  );

const mockedGetModelInfo =
  vi.mocked(
    getMLModelInfo,
  );

const mockedGetMLSummary =
  vi.mocked(
    getMLSummary,
  );

const mockedGetOperations =
  vi.mocked(
    getOperationsStatus,
  );


function makeEvaluationSummary(
  overrides:
    Partial<EvaluationSummary> = {},
): EvaluationSummary {
  return {
    registry_version:
      "1.0",

    generated_at:
      "2026-09-23T09:30:00Z",

    selected_model: {
      name:
        "Isolation Forest v1.2",

      detector_name:
        "isolation-forest",

      version:
        "1.2",

      feature_count:
        17,

      training_rows:
        10_000,

      evaluation_rows:
        2_000,

      precision:
        0.91,

      recall:
        0.88,

      f1_score:
        0.895,

      false_positive_rate:
        0.03,

      false_positives:
        12,

      threshold_percentile:
        0.95,
    },

    experiments: [],

    incident_evaluation: {
      true_positive_incidents:
        5,

      false_positive_incidents:
        0,

      attack_instances_detected:
        5,

      attack_instances_total:
        5,

      precision:
        1,

      recall:
        1,

      f1_score:
        1,

      timeline_events_recovered:
        20,

      timeline_events_total:
        20,

      timeline_recovery_rate:
        1,
    },

    provenance: {
      ml_training_period:
        "synthetic training set",

      ml_evaluation_period:
        "controlled evaluation set",

      incident_ground_truth_batch:
        "benchmark-v1",

      ground_truth_policy:
        "evaluation-only",
    },

    component_generated_at: {
      selected_model:
        "2026-09-23T09:30:00Z",

      model_comparison:
        "2026-09-23T09:30:00Z",

      incident_evaluation:
        "2026-09-23T09:30:00Z",
    },

    benchmark: {
      name:
        "SENTINEL controlled benchmark",

      status:
        "PASS",

      seed:
        42,

      reproducible:
        true,

      database_isolation:
        "isolated",

      generated_at:
        "2026-09-23T09:30:00Z",

      elapsed_seconds:
        12.5,

      dataset: {
        employees:
          300,

        normal_events:
          1_000,

        attack_events:
          20,

        total_events:
          1_020,

        attack_instances:
          5,
      },

      operational_scoring: {
        scored_events:
          1_020,

        risk_distribution: {
          NORMAL:
            900,

          LOW:
            70,

          MEDIUM:
            30,

          HIGH:
            15,

          CRITICAL:
            5,
        },
      },

      incident_correlation: {
        total:
          5,

        severity_distribution: {
          CRITICAL:
            2,

          HIGH:
            2,

          MEDIUM:
            1,
        },
      },

      canonical_signature: {
        employees:
          300,

        events:
          1_020,

        selected_experiment:
          "isolation-forest-v1.2",

        selected_detector:
          "isolation-forest",

        model_f1:
          0.895,

        critical_scores:
          5,

        incidents:
          5,

        attack_instances_recovered:
          5,

        timeline_events_recovered:
          20,

        incident_precision:
          1,

        incident_recall:
          1,
      },
    },

    ...overrides,
  };
}


function IncidentsDestination() {
  return (
    <div>
      Incidents destination
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


function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/",
      ]}
    >
      <Routes>
        <Route
          path="/"
          element={
            <OverviewPage />
          }
        />

        <Route
          path="/incidents"
          element={
            <IncidentsDestination />
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

    mockedGetEmployees
      .mockResolvedValue([
        makeEmployee(),
        makeEmployee({
          id:
            "employee-db-002",

          user_id:
            "EMP-002",

          name:
            "Bilal Ahmed",
        }),
      ]);

    mockedGetIncidentSummary
      .mockResolvedValue(
        makeIncidentSummary(),
      );

    mockedGetIncidents
      .mockResolvedValue([
        makeIncidentListItem(),
      ]);

    mockedGetMLSummary
      .mockResolvedValue(
        makeMLSummary(),
      );

    mockedGetModelInfo
      .mockResolvedValue(
        makeMLModelInfo(),
      );

    mockedGetEvaluation
      .mockResolvedValue(
        makeEvaluationSummary(),
      );

    mockedGetOperations
      .mockResolvedValue(
        makeOperationsStatus(),
      );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
  },
);


describe(
  "OverviewPage",
  () => {
    it(
      "loads the complete security posture on startup",
      async () => {
        renderPage();

        expect(
          screen.getByText(
            "Loading Security Operations",
          ),
        ).toBeInTheDocument();

        await waitFor(
          () => {
            expect(
              mockedGetEmployees,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetIncidentSummary,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetIncidents,
            ).toHaveBeenCalledWith(
              50,
            );

            expect(
              mockedGetMLSummary,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetModelInfo,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetEvaluation,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetOperations,
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
                "Security Operations Overview",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Monitored Identities: 2",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Processor: HEALTHY",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "treats operations status as optional during initial load",
      async () => {
        mockedGetOperations
          .mockRejectedValueOnce(
            new Error(
              "operations unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Security Operations Overview",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Processor: UNAVAILABLE",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            /could not load the current security posture/i,
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "shows the security posture error when a required source fails",
      async () => {
        mockedGetMLSummary
          .mockRejectedValueOnce(
            new Error(
              "ML unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "SENTINEL could not load the current security posture. Confirm that PostgreSQL and the FastAPI backend are running.",
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
      "manually refreshes the complete intelligence dataset",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByRole(
          "heading",
          {
            name:
              "Security Operations Overview",
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Overview",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetEmployees,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetIncidentSummary,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetIncidents,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetMLSummary,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetModelInfo,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetEvaluation,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetOperations,
            ).toHaveBeenCalledTimes(
              2,
            );
          },
        );
      },
    );


    it(
      "shows a manual refresh warning while preserving existing dashboard data",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          "Monitored Identities: 2",
        );

        mockedGetMLSummary
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
                "Refresh Overview",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh the current intelligence feed. Existing dashboard data remains visible.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Monitored Identities: 2",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Priority count: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "silently refreshes the complete intelligence dataset every ten seconds",
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
          mockedGetEmployees,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetOperations,
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
          mockedGetEmployees,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetIncidentSummary,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetIncidents,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetMLSummary,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetModelInfo,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetEvaluation,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetOperations,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "preserves current dashboard data and warns when automatic refresh fails",
      async () => {
        vi.useFakeTimers();

        mockedGetMLSummary
          .mockResolvedValueOnce(
            makeMLSummary(),
          )
          .mockRejectedValueOnce(
            new Error(
              "background failure",
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
            "Monitored Identities: 2",
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
            "Automatic refresh could not retrieve the latest security intelligence. Existing dashboard data remains visible.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Monitored Identities: 2",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Priority count: 1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "selects at most five incidents using severity, status and recency priority",
      async () => {
        mockedGetIncidents
          .mockResolvedValue([
            makeIncidentListItem({
              incident_id:
                "INC-MEDIUM",

              severity:
                "MEDIUM",

              status:
                "OPEN",

              first_seen:
                "2026-09-23T11:00:00Z",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-HIGH-CLOSED",

              severity:
                "HIGH",

              status:
                "CLOSED",

              first_seen:
                "2026-09-23T12:00:00Z",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-CRITICAL-OLD",

              severity:
                "CRITICAL",

              status:
                "OPEN",

              first_seen:
                "2026-09-23T08:00:00Z",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-HIGH-OPEN",

              severity:
                "HIGH",

              status:
                "OPEN",

              first_seen:
                "2026-09-23T09:00:00Z",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-CRITICAL-NEW",

              severity:
                "CRITICAL",

              status:
                "OPEN",

              first_seen:
                "2026-09-23T10:00:00Z",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-CRITICAL-RESOLVED",

              severity:
                "CRITICAL",

              status:
                "RESOLVED",

              first_seen:
                "2026-09-23T13:00:00Z",
            }),
          ]);

        renderPage();

        expect(
          await screen.findByText(
            "Priority count: 5",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Priority order: INC-CRITICAL-NEW,INC-CRITICAL-OLD,INC-CRITICAL-RESOLVED,INC-HIGH-OPEN,INC-HIGH-CLOSED",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Open INC-MEDIUM",
            },
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "navigates to an encoded priority incident workspace",
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
                "Open INC / SPECIAL",
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


    it(
      "navigates to the complete incident queue",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "View all incidents",
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
