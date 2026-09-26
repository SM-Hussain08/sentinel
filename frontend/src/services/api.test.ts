import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  SentinelApiError,
  analyzeEvent,
  getAnomalies,
  getEmployeeActivity,
  getEmployeeDetail,
  getEmployeeDirectory,
  getEmployeeWorkforceSummary,
  getEmployees,
  getEvent,
  getEvents,
  getEvaluationSummary,
  getIncidentDetail,
  getIncidentInvestigation,
  getIncidents,
  getIncidentsBySeverity,
  getIncidentsForEvent,
  getIncidentSummary,
  getIncidentTimeline,
  getMLAnomalies,
  getMLEventAnalysis,
  getMLModelInfo,
  getMLSummary,
  getMLAnomalyPage,
  generateAIInvestigation,
  getAIServiceStatus,
  getOperationsStatus,
  sendAIIncidentChatMessage,
} from "./api";

import {
  jsonResponse,
  textResponse,
} from "../test/http";

import {
  makeAnomalyResult,
} from "../test/fixtures/anomalies";

import {
  makeEmployeeActivityPage,
  makeEmployeeDetail,
  makeEmployeeDirectoryPage,
  makeEmployeeWorkforceSummary,
} from "../test/fixtures/employees";

import {
  makeIncidentDetail,
  makeIncidentInvestigation,
  makeIncidentListItem,
  makeIncidentSummary,
  makeIncidentTimelineEvent,
} from "../test/fixtures/incidents";

import {
  makeMLAnomaly,
  makeMLAnomalyFeedPage,
  makeMLEventAnalysis,
  makeMLModelInfo,
  makeMLSummary,
} from "../test/fixtures/anomalies";

import {
  makeAIChatResponse,
  makeAIInvestigationResponse,
  makeAIServiceStatus,
} from "../test/fixtures/ai";

import {
  makeOperationsStatus,
} from "../test/fixtures/operations";


describe(
  "SENTINEL API client core behavior",
  () => {
    const fetchMock =
      vi.fn();


    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        fetchMock,
      );
    });


    afterEach(() => {
      vi.unstubAllGlobals();
    });


    it(
      "returns parsed JSON for a successful request",
      async () => {
        const payload = [
          {
            id:
              "employee-db-001",

            user_id:
              "EMP-001",

            name:
              "Aisha Khan",

            department:
              "Finance",

            job_role:
              "Financial Analyst",

            normal_start_hour:
              9,

            normal_end_hour:
              17,

            typical_ip:
              "10.10.1.25",

            typical_location:
              "Karachi HQ",

            typical_login_frequency:
              8,

            typical_files_accessed:
              14,

            typical_data_transfer_bytes:
              2_500_000,

            behavior_profile:
              {},

            is_active:
              true,

            created_at:
              "2026-09-01T08:00:00Z",
          },
        ];

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
            {
              status: 200,
            },
          ),
        );

        const result =
          await getEmployees();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/employees",
          undefined,
        );
      },
    );


    it(
      "uses backend detail when a JSON error response provides one",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            {
              detail:
                "Employee data is unavailable.",
            },
            {
              status: 503,

              statusText:
                "Service Unavailable",
            },
          ),
        );

        await expect(
          getEmployees(),
        ).rejects.toMatchObject({
          name:
            "SentinelApiError",

          status:
            503,

          message:
            "Employee data is unavailable.",
        });
      },
    );


    it(
      "uses the generic HTTP message for a non-JSON error response",
      async () => {
        fetchMock.mockResolvedValue(
          textResponse(
            "upstream failure",
            {
              status:
                502,

              statusText:
                "Bad Gateway",
            },
          ),
        );

        await expect(
          getEmployees(),
        ).rejects.toMatchObject({
          name:
            "SentinelApiError",

          status:
            502,

          message:
            "SENTINEL API request failed: 502 Bad Gateway",
        });
      },
    );


    it(
      "uses the generic HTTP message when JSON contains no usable detail",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            {
              detail:
                "   ",
            },
            {
              status:
                500,

              statusText:
                "Internal Server Error",
            },
          ),
        );

        await expect(
          getEmployees(),
        ).rejects.toMatchObject({
          status:
            500,

          message:
            "SENTINEL API request failed: 500 Internal Server Error",
        });
      },
    );


    it(
      "preserves the HTTP status on SentinelApiError",
      () => {
        const error =
          new SentinelApiError(
            "Not found",
            404,
          );

        expect(
          error,
        ).toBeInstanceOf(
          Error,
        );

        expect(
          error.name,
        ).toBe(
          "SentinelApiError",
        );

        expect(
          error.status,
        ).toBe(
          404,
        );

        expect(
          error.message,
        ).toBe(
          "Not found",
        );
      },
    );


    it(
      "propagates network failures from fetch",
      async () => {
        fetchMock.mockRejectedValue(
          new TypeError(
            "Network request failed",
          ),
        );

        await expect(
          getEmployees(),
        ).rejects.toThrow(
          "Network request failed",
        );
      },
    );
  },
);


describe(
  "employee, event, and anomaly API contracts",
  () => {
    const fetchMock =
      vi.fn();


    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        fetchMock,
      );
    });


    afterEach(() => {
      vi.unstubAllGlobals();
    });


    it(
      "builds employee directory defaults correctly",
      async () => {
        const payload =
          makeEmployeeDirectoryPage();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getEmployeeDirectory();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/employees/directory?status=all&limit=30&offset=0",
          undefined,
        );
      },
    );


    it(
      "trims and serializes employee directory filters",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            makeEmployeeDirectoryPage(),
          ),
        );

        await getEmployeeDirectory({
          search:
            "  Aisha Khan  ",

          department:
            "  Finance  ",

          status:
            "active",

          limit:
            25,

          offset:
            50,
        });

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/employees/directory?search=Aisha+Khan&department=Finance&status=active&limit=25&offset=50",
          undefined,
        );
      },
    );


    it(
      "omits blank employee directory search and department values",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            makeEmployeeDirectoryPage(),
          ),
        );

        await getEmployeeDirectory({
          search:
            "   ",

          department:
            "   ",
        });

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/employees/directory?status=all&limit=30&offset=0",
          undefined,
        );
      },
    );


    it(
      "requests the workforce summary endpoint",
      async () => {
        const payload =
          makeEmployeeWorkforceSummary();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getEmployeeWorkforceSummary();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/employees/summary",
          undefined,
        );
      },
    );


    it(
      "URL-encodes employee identifiers",
      async () => {
        const payload =
          makeEmployeeDetail({
            user_id:
              "EMP / 01",
          });

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        await getEmployeeDetail(
          "EMP / 01",
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/employees/EMP%20%2F%2001",
          undefined,
        );
      },
    );


    it(
      "builds employee activity pagination correctly",
      async () => {
        const payload =
          makeEmployeeActivityPage();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        await getEmployeeActivity(
          "EMP / 01",
          40,
          80,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/employees/EMP%20%2F%2001/activity?limit=40&offset=80",
          undefined,
        );
      },
    );


    it(
      "requests events with the default limit",
      async () => {
        const payload = [
          {
            id:
              "event-db-001",

            event_id:
              "EVT-001",

            timestamp:
              "2026-09-23T09:30:00Z",

            employee_id:
              "employee-db-001",

            session_id:
              null,

            event_type:
              "LOGIN_SUCCESS",

            source_ip:
              "10.10.1.25",

            destination_ip:
              null,

            source_location:
              "Karachi HQ",

            resource_type:
              null,

            resource_name:
              null,

            bytes_sent:
              0,

            bytes_received:
              0,

            success:
              true,

            event_metadata:
              {},

            created_at:
              "2026-09-23T09:30:01Z",
          },
        ];

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getEvents();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/events?limit=50",
          undefined,
        );
      },
    );


    it(
      "uses a custom event limit",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            [],
          ),
        );

        await getEvents(
          125,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/events?limit=125",
          undefined,
        );
      },
    );


    it(
      "requests an individual event",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            {
              event_id:
                "EVT-001",
            },
          ),
        );

        await getEvent(
          "EVT-001",
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/events/EVT-001",
          undefined,
        );
      },
    );


    it(
      "requests the anomaly collection",
      async () => {
        const payload = [
          makeAnomalyResult(),
        ];

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getAnomalies();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/anomalies",
          undefined,
        );
      },
    );


    it(
      "posts anomaly analysis requests",
      async () => {
        const payload =
          makeAnomalyResult();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await analyzeEvent(
            "EVT-001",
          );

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/anomalies/analyze/EVT-001",
          {
            method:
              "POST",
          },
        );
      },
    );
  },
);


describe(
  "ML, incident, and evaluation API contracts",
  () => {
    const fetchMock =
      vi.fn();


    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        fetchMock,
      );
    });


    afterEach(() => {
      vi.unstubAllGlobals();
    });


    it(
      "requests selected ML model information",
      async () => {
        const payload =
          makeMLModelInfo();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getMLModelInfo();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ml/model",
          undefined,
        );
      },
    );


    it(
      "requests the ML summary",
      async () => {
        const payload =
          makeMLSummary();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getMLSummary();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ml/summary",
          undefined,
        );
      },
    );


    it(
      "requests ML anomalies with the default limit",
      async () => {
        const payload = [
          makeMLAnomaly(),
        ];

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getMLAnomalies();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ml/anomalies?limit=50",
          undefined,
        );
      },
    );


    it(
      "uses a custom ML anomaly limit",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            [],
          ),
        );

        await getMLAnomalies(
          125,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ml/anomalies?limit=125",
          undefined,
        );
      },
    );


    it(
      "URL-encodes ML event identifiers",
      async () => {
        const payload =
          makeMLEventAnalysis({
            event_id:
              "EVT / 01",
          });

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        await getMLEventAnalysis(
          "EVT / 01",
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ml/events/EVT%20%2F%2001",
          undefined,
        );
      },
    );


    it(
      "builds the default paged anomaly-feed query",
      async () => {
        const payload =
          makeMLAnomalyFeedPage();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getMLAnomalyPage();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ml/anomalies/paged?limit=50&offset=0",
          undefined,
        );
      },
    );


    it(
      "serializes anomaly-feed filtering and pagination",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            makeMLAnomalyFeedPage(),
          ),
        );

        await getMLAnomalyPage({
          riskLevel:
            "HIGH",

          search:
            "EMP-001",

          limit:
            25,

          offset:
            50,
        });

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ml/anomalies/paged?risk_level=HIGH&search=EMP-001&limit=25&offset=50",
          undefined,
        );
      },
    );


    it(
      "requests the incident summary",
      async () => {
        const payload =
          makeIncidentSummary();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getIncidentSummary();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/incidents/summary",
          undefined,
        );
      },
    );


    it(
      "requests incidents with the default limit",
      async () => {
        const payload = [
          makeIncidentListItem(),
        ];

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getIncidents();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/incidents?limit=50",
          undefined,
        );
      },
    );


    it(
      "filters incidents by severity",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            [
              makeIncidentListItem({
                severity:
                  "CRITICAL",
              }),
            ],
          ),
        );

        await getIncidentsBySeverity(
          "CRITICAL",
          20,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/incidents?severity=CRITICAL&limit=20",
          undefined,
        );
      },
    );


    it(
      "URL-encodes incident detail identifiers",
      async () => {
        const payload =
          makeIncidentDetail({
            incident_id:
              "INC / 01",
          });

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        await getIncidentDetail(
          "INC / 01",
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/incidents/INC%20%2F%2001",
          undefined,
        );
      },
    );


    it(
      "requests an incident timeline",
      async () => {
        const payload = [
          makeIncidentTimelineEvent(),
        ];

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getIncidentTimeline(
            "INC-001",
          );

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/incidents/INC-001/timeline",
          undefined,
        );
      },
    );


    it(
      "requests deterministic incident investigation",
      async () => {
        const payload =
          makeIncidentInvestigation();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getIncidentInvestigation(
            "INC-001",
          );

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/incidents/INC-001/investigation",
          undefined,
        );
      },
    );


    it(
      "requests incidents linked to an encoded event identifier",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            [
              makeIncidentListItem(),
            ],
          ),
        );

        await getIncidentsForEvent(
          "EVT / 01",
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/incidents/by-event/EVT%20%2F%2001",
          undefined,
        );
      },
    );


    it(
      "requests the evaluation summary",
      async () => {
        const payload = {
          registry_version:
            "1.0",

          generated_at:
            "2026-09-23T09:00:00Z",

          selected_model: {
            name:
              "selected-production-model",

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
              60,

            threshold_percentile:
              0.95,
          },

          experiments:
            [],

          incident_evaluation: {
            true_positive_incidents:
              8,

            false_positive_incidents:
              1,

            attack_instances_detected:
              8,

            attack_instances_total:
              9,

            precision:
              0.89,

            recall:
              0.89,

            f1_score:
              0.89,

            timeline_events_recovered:
              42,

            timeline_events_total:
              45,

            timeline_recovery_rate:
              0.933,
          },

          provenance: {
            ml_training_period:
              "training",

            ml_evaluation_period:
              "evaluation",

            incident_ground_truth_batch:
              "benchmark-001",

            ground_truth_policy:
              "evaluation-only",
          },

          component_generated_at: {
            selected_model:
              "2026-09-23T08:00:00Z",

            model_comparison:
              "2026-09-23T08:00:00Z",

            incident_evaluation:
              "2026-09-23T08:00:00Z",
          },

          benchmark: {
            name:
              "sentinel-controlled-benchmark",

            status:
              "passed",

            seed:
              42,

            reproducible:
              true,

            database_isolation:
              "sentinel_test",

            generated_at:
              "2026-09-23T08:00:00Z",

            elapsed_seconds:
              12.5,

            dataset: {
              employees:
                300,

              normal_events:
                1000,

              attack_events:
                100,

              total_events:
                1100,

              attack_instances:
                9,
            },

            operational_scoring: {
              scored_events:
                1100,

              risk_distribution: {
                NORMAL:
                  900,

                LOW:
                  100,

                MEDIUM:
                  50,

                HIGH:
                  30,

                CRITICAL:
                  20,
              },
            },

            incident_correlation: {
              total:
                9,

              severity_distribution: {
                MEDIUM:
                  3,

                HIGH:
                  3,

                CRITICAL:
                  3,
              },
            },

            canonical_signature: {
              employees:
                300,

              events:
                1100,

              selected_experiment:
                "sentinel-iforest-v1.2",

              selected_detector:
                "isolation-forest:1.2",

              model_f1:
                0.895,

              critical_scores:
                20,

              incidents:
                9,

              attack_instances_recovered:
                8,

              timeline_events_recovered:
                42,

              incident_precision:
                0.89,

              incident_recall:
                0.89,
            },
          },
        };

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getEvaluationSummary();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/evaluation/summary",
          undefined,
        );
      },
    );
  },
);


describe(
  "AI and operations API contracts",
  () => {
    const fetchMock =
      vi.fn();


    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        fetchMock,
      );
    });


    afterEach(() => {
      vi.unstubAllGlobals();
    });


    it(
      "requests AI service status",
      async () => {
        const payload =
          makeAIServiceStatus();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getAIServiceStatus();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ai/status",
          undefined,
        );
      },
    );


    it(
      "posts an AI investigation request using an encoded incident identifier",
      async () => {
        const payload =
          makeAIInvestigationResponse({
            incident_id:
              "INC / 01",
          });

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await generateAIInvestigation(
            "INC / 01",
          );

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ai/incidents/INC%20%2F%2001/investigation",
          {
            method:
              "POST",
          },
        );
      },
    );


    it(
      "posts AI incident chat with JSON headers and body",
      async () => {
        const payload =
          makeAIChatResponse();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const request = {
          message:
            "What is the strongest signal?",

          history: [
            {
              role:
                "user" as const,

              content:
                "Summarize this incident.",
            },

            {
              role:
                "assistant" as const,

              content:
                "The incident contains suspicious authentication activity.",
            },
          ],
        };

        const result =
          await sendAIIncidentChatMessage(
            "INC-001",
            request,
          );

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ai/incidents/INC-001/chat",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                request,
              ),
          },
        );
      },
    );


    it(
      "URL-encodes the incident identifier for AI chat",
      async () => {
        fetchMock.mockResolvedValue(
          jsonResponse(
            makeAIChatResponse(),
          ),
        );

        await sendAIIncidentChatMessage(
          "INC / 01",
          {
            message:
              "Explain the evidence.",

            history:
              [],
          },
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/ai/incidents/INC%20%2F%2001/chat",
          expect.objectContaining({
            method:
              "POST",
          }),
        );
      },
    );


    it(
      "requests operational runtime status",
      async () => {
        const payload =
          makeOperationsStatus();

        fetchMock.mockResolvedValue(
          jsonResponse(
            payload,
          ),
        );

        const result =
          await getOperationsStatus();

        expect(
          result,
        ).toEqual(
          payload,
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          "/api/v1/operations/status",
          undefined,
        );
      },
    );
  },
);
