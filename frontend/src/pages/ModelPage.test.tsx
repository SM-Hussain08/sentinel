import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getEvaluationSummary,
  getMLModelInfo,
  getMLSummary,
} from "../services/api";

import {
  makeEvaluationSummary,
} from "../test/fixtures/evaluation";

import {
  makeMLModelInfo,
  makeMLSummary,
} from "../test/fixtures/anomalies";

import ModelPage from "./ModelPage";


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

      getEvaluationSummary:
        vi.fn(),

      getMLModelInfo:
        vi.fn(),

      getMLSummary:
        vi.fn(),
    };
  },
);


const mockedGetEvaluation =
  vi.mocked(
    getEvaluationSummary,
  );

const mockedGetModel =
  vi.mocked(
    getMLModelInfo,
  );

const mockedGetSummary =
  vi.mocked(
    getMLSummary,
  );


beforeEach(
  () => {
    vi.clearAllMocks();

    mockedGetModel
      .mockResolvedValue(
        makeMLModelInfo(),
      );

    mockedGetSummary
      .mockResolvedValue(
        makeMLSummary(),
      );

    mockedGetEvaluation
      .mockResolvedValue(
        makeEvaluationSummary(),
      );
  },
);


describe(
  "ModelPage",
  () => {
    it(
      "loads model metadata, live ML summary and controlled evaluation evidence",
      async () => {
        render(
          <ModelPage />,
        );

        expect(
          screen.getByText(
            "Loading Model Intelligence",
          ),
        ).toBeInTheDocument();

        await waitFor(
          () => {
            expect(
              mockedGetModel,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetSummary,
            ).toHaveBeenCalledTimes(
              1,
            );

            expect(
              mockedGetEvaluation,
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
                "Model Intelligence",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                /Isolation Forest v1\.2/i,
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "PRODUCTION DETECTOR",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows an initial model intelligence failure",
      async () => {
        mockedGetEvaluation
          .mockRejectedValueOnce(
            new Error(
              "evaluation unavailable",
            ),
          );

        render(
          <ModelPage />,
        );

        expect(
          await screen.findByText(
            "SENTINEL could not load model intelligence. Confirm that the FastAPI backend is running.",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "manually refreshes all three model intelligence sources",
      async () => {
        const user =
          userEvent.setup();

        render(
          <ModelPage />,
        );

        await screen.findByRole(
          "heading",
          {
            name:
              "Model Intelligence",
          },
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Model",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              mockedGetModel,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetSummary,
            ).toHaveBeenCalledTimes(
              2,
            );

            expect(
              mockedGetEvaluation,
            ).toHaveBeenCalledTimes(
              2,
            );
          },
        );
      },
    );


    it(
      "shows refresh failure while preserving existing model intelligence",
      async () => {
        const user =
          userEvent.setup();

        render(
          <ModelPage />,
        );

        await screen.findByText(
          "PRODUCTION DETECTOR",
        );

        mockedGetSummary
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
                "Refresh Model",
            },
          ),
        );

        expect(
          await screen.findByText(
            "SENTINEL could not refresh model intelligence.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "PRODUCTION DETECTOR",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the selected model experiment and final selection",
      async () => {
        render(
          <ModelPage />,
        );

        expect(
          await screen.findByText(
            "Final Selection",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            "Isolation Forest V1",
          ).length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          screen.getByText(
            "WINNER",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "REJECTED",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "summarizes current SENTINEL scoring data without implying runtime health",
      async () => {
        render(
          <ModelPage />,
        );

        expect(
          await screen.findByText(
            "Current SENTINEL Data",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Current model-facing data",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /does not represent processor runtime health/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Scored Events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Critical Events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Selected Detector",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders an empty current scoring dataset without claiming the detector is offline",
      async () => {
        mockedGetSummary
          .mockResolvedValue(
            makeMLSummary({
              events_scored:
                0,

              alert_count:
                0,
            }),
          );

        render(
          <ModelPage />,
        );

        expect(
          await screen.findByText(
            "Current SENTINEL Data",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Detector ready — awaiting live telemetry",
          ),
        ).not.toBeInTheDocument();

        expect(
          screen.queryByText(
            "Operational telemetry active",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "renders controlled benchmark and incident recovery evidence",
      async () => {
        render(
          <ModelPage />,
        );

        expect(
          await screen.findByText(
            "Reproducible Evaluation",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Campaign Recovery",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            "Timeline Recovery",
          ).length,
        ).toBeGreaterThanOrEqual(
          2,
        );

        expect(
          screen.getByText(
            "Ground Truth Isolation",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Benchmark Evidence",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Controlled evaluation snapshot",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Evaluation Rows",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Detector F1",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
