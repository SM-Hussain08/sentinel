import {
  act,
  fireEvent,
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
  generateAIInvestigation,
  getAIServiceStatus,
  SentinelApiError,
} from "../../services/api";

import {
  getAIInvestigationStorageKey,
} from "../../utils/incidentAIStorage";

import {
  makeAIInvestigationResponse,
  makeAIServiceStatus,
} from "../../test/fixtures/ai";

import AIInvestigator from "./AIInvestigator";


vi.mock(
  "../../services/api",
  async (
    importOriginal,
  ) => {
    const actual =
      await importOriginal<
        typeof import(
          "../../services/api"
        )
      >();

    return {
      ...actual,

      generateAIInvestigation:
        vi.fn(),

      getAIServiceStatus:
        vi.fn(),
    };
  },
);


const mockedGenerate =
  vi.mocked(
    generateAIInvestigation,
  );

const mockedGetStatus =
  vi.mocked(
    getAIServiceStatus,
  );


beforeEach(
  () => {
    vi.clearAllMocks();

    sessionStorage.clear();

    mockedGetStatus
      .mockResolvedValue(
        makeAIServiceStatus(),
      );

    mockedGenerate
      .mockResolvedValue(
        makeAIInvestigationResponse(),
      );
  },
);


describe(
  "AIInvestigator",
  () => {
    it(
      "checks Local AI readiness and enables generation when available",
      async () => {
        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        await waitFor(
          () => {
            expect(
              mockedGetStatus,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        expect(
          screen.getByText(
            "Local AI is ready.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        ).toBeEnabled();
      },
    );


    it(
      "disables generation when Local AI is unavailable",
      async () => {
        mockedGetStatus
          .mockResolvedValue(
            makeAIServiceStatus({
              available:
                false,

              message:
                "Ollama is unavailable.",
            }),
          );

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        expect(
          await screen.findByText(
            "Ollama is unavailable.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Check Again",
            },
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows status failure and allows the analyst to check again",
      async () => {
        mockedGetStatus
          .mockRejectedValueOnce(
            new Error(
              "Unable to reach Local AI.",
            ),
          )
          .mockResolvedValueOnce(
            makeAIServiceStatus(),
          );

        const user =
          userEvent.setup();

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        expect(
          await screen.findByText(
            "AI status unavailable",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Unable to reach Local AI.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "alert",
          ),
        ).toHaveTextContent(
          "Unable to reach Local AI.",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Check Again",
            },
          ),
        );

        expect(
          await screen.findByText(
            "Local AI is ready.",
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetStatus,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "generates a grounded AI investigation and persists the successful result",
      async () => {
        const user =
          userEvent.setup();

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        const button =
          await screen.findByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          );

        await user.click(
          button,
        );

        await waitFor(
          () => {
            expect(
              mockedGenerate,
            ).toHaveBeenCalledWith(
              "INC-001",
            );
          },
        );

        expect(
          await screen.findByText(
            "The incident contains a suspicious authentication sequence supported by SENTINEL evidence.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Repeated authentication failures preceded unusual successful access.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Grounded:",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Yes",
          ),
        ).toBeInTheDocument();

        const stored =
          sessionStorage.getItem(
            getAIInvestigationStorageKey(
              "INC-001",
            ),
          );

        expect(
          stored,
        ).not.toBeNull();

        expect(
          JSON.parse(
            stored!,
          ).incident_id,
        ).toBe(
          "INC-001",
        );
      },
    );


    it(
      "announces active generation and exposes the investigator as busy",
      async () => {
        const user =
          userEvent.setup();

        let resolveGeneration:
          (
            value:
              ReturnType<
                typeof makeAIInvestigationResponse
              >,
          ) => void;

        mockedGenerate
          .mockImplementation(
            () => (
              new Promise(
                (resolve) => {
                  resolveGeneration =
                    resolve;
                },
              )
            ),
          );


        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );


        const button =
          await screen.findByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          );


        await user.click(
          button,
        );


        await waitFor(
          () => {
            expect(
              mockedGenerate,
            ).toHaveBeenCalledWith(
              "INC-001",
            );
          },
        );


        expect(
          screen.getByRole(
            "article",
          ),
        ).toHaveAttribute(
          "aria-busy",
          "true",
        );


        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "Preparing grounded incident context...",
        );


        resolveGeneration!(
          makeAIInvestigationResponse(),
        );


        await waitFor(
          () => {
            expect(
              screen.getByRole(
                "article",
              ),
            ).toHaveAttribute(
              "aria-busy",
              "false",
            );
          },
        );
      },
    );


    it(
      "hydrates a previously successful investigation from session storage",
      async () => {
        sessionStorage.setItem(
          getAIInvestigationStorageKey(
            "INC-001",
          ),
          JSON.stringify(
            makeAIInvestigationResponse({
              content: {
                executive_assessment:
                  "Cached investigation assessment.",

                why_suspicious:
                  [],

                timeline_interpretation:
                  "Cached timeline interpretation.",

                investigation_priorities:
                  [],

                containment_considerations:
                  [],

                confidence:
                  "MEDIUM",

                limitations:
                  [],
              },
            }),
          ),
        );

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        expect(
          screen.getByText(
            "Cached investigation assessment.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Regenerate Analysis",
            },
          ),
        ).toBeInTheDocument();

        expect(
          mockedGenerate,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      "maps generation timeout while keeping deterministic investigation authoritative",
      async () => {
        mockedGenerate
          .mockRejectedValueOnce(
            new SentinelApiError(
              "AI generation timed out.",
              504,
            ),
          );

        const user =
          userEvent.setup();

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        );

        expect(
          await screen.findByText(
            "Local AI timed out",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /The deterministic investigation remains fully available/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /deterministic investigation remains authoritative/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "alert",
          ),
        ).toHaveTextContent(
          "Local AI timed out",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Try Again",
            },
          ),
        ).toBeEnabled();
      },
    );


    it(
      "marks Local AI unavailable after a 503 generation failure",
      async () => {
        mockedGenerate
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Configured Ollama model is unavailable.",
              503,
            ),
          );

        const user =
          userEvent.setup();

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        );

        expect(
          await screen.findByText(
            "Local AI unavailable",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /deterministic investigation continues to work without the language model/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Check AI",
            },
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "rejects invalid AI output without displaying unvalidated content",
      async () => {
        mockedGenerate
          .mockRejectedValueOnce(
            new SentinelApiError(
              "Structured response validation failed.",
              502,
            ),
          );

        const user =
          userEvent.setup();

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        );

        expect(
          await screen.findByText(
            "AI response could not be validated",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /The unvalidated output was not displayed/,
          ),
        ).toBeInTheDocument();

        expect(
          sessionStorage.getItem(
            getAIInvestigationStorageKey(
              "INC-001",
            ),
          ),
        ).toBeNull();
      },
    );


    it(
      "retries a failed generation without changing the incident identity",
      async () => {
        mockedGenerate
          .mockRejectedValueOnce(
            new SentinelApiError(
              "AI generation timed out.",
              504,
            ),
          )
          .mockResolvedValueOnce(
            makeAIInvestigationResponse(),
          );

        const user =
          userEvent.setup();

        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        );

        await screen.findByText(
          "Local AI timed out",
        );

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
            "The incident contains a suspicious authentication sequence supported by SENTINEL evidence.",
          ),
        ).toBeInTheDocument();

        expect(
          mockedGenerate,
        ).toHaveBeenNthCalledWith(
          1,
          "INC-001",
        );

        expect(
          mockedGenerate,
        ).toHaveBeenNthCalledWith(
          2,
          "INC-001",
        );
      },
    );


    it(
      "rechecks Local AI status when the parent refresh signal changes",
      async () => {
        const {
          rerender,
        } = render(
          <AIInvestigator
            incidentId="INC-001"
            statusRefreshSignal={
              100
            }
          />,
        );

        await waitFor(
          () => {
            expect(
              mockedGetStatus,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        rerender(
          <AIInvestigator
            incidentId="INC-001"
            statusRefreshSignal={
              200
            }
          />,
        );

        await waitFor(
          () => {
            expect(
              mockedGetStatus,
            ).toHaveBeenCalledTimes(
              2,
            );
          },
        );
      },
    );


    it(
      "maps an unexpected generation failure without hiding deterministic investigation",
      async () => {
        mockedGenerate
          .mockRejectedValueOnce(
            new Error(
              "Unexpected local inference failure.",
            ),
          );


        const user =
          userEvent.setup();


        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );


        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        );


        expect(
          await screen.findByText(
            "AI generation failed",
          ),
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "Unexpected local inference failure.",
          ),
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            /The deterministic investigation remains available/i,
          ),
        ).toBeInTheDocument();


        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Try Again",
            },
          ),
        ).toBeEnabled();
      },
    );


    it(
      "updates generation progress during long local inference",
      async () => {
        vi.useFakeTimers();


        let resolveGeneration:
          (
            value:
              ReturnType<
                typeof makeAIInvestigationResponse
              >,
          ) => void;


        mockedGenerate
          .mockImplementation(
            () => (
              new Promise(
                (resolve) => {
                  resolveGeneration =
                    resolve;
                },
              )
            ),
          );


        render(
          <AIInvestigator
            incidentId="INC-001"
          />,
        );


        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Analysis",
            },
          ),
        );


        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "Preparing grounded incident context...",
        );


        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              10_000,
            );
          },
        );


        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "Local model is reviewing the evidence...",
        );


        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              15_000,
            );
          },
        );


        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "Generating analyst intelligence...",
        );


        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              20_000,
            );
          },
        );


        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "Local CPU inference is still running...",
        );


        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              25_000,
            );
          },
        );


        expect(
          screen.getByRole(
            "status",
          ),
        ).toHaveTextContent(
          "Generation is approaching the configured timeout window...",
        );


        resolveGeneration!(
          makeAIInvestigationResponse(),
        );


        await act(
          async () => {
            await Promise.resolve();
          },
        );
      },
    );
  },
);
