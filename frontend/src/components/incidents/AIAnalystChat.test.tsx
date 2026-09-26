import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getAIServiceStatus,
  sendAIIncidentChatMessage,
  SentinelApiError,
} from "../../services/api";

import {
  getAIChatStorageKey,
} from "../../utils/incidentAIStorage";

import {
  makeAIChatResponse,
  makeAIServiceStatus,
} from "../../test/fixtures/ai";

import AIAnalystChat from "./AIAnalystChat";


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

      getAIServiceStatus:
        vi.fn(),

      sendAIIncidentChatMessage:
        vi.fn(),
    };
  },
);


const mockedGetStatus =
  vi.mocked(
    getAIServiceStatus,
  );

const mockedSend =
  vi.mocked(
    sendAIIncidentChatMessage,
  );


beforeEach(
  () => {
    vi.clearAllMocks();

    sessionStorage.clear();

    mockedGetStatus
      .mockResolvedValue(
        makeAIServiceStatus(),
      );

    mockedSend
      .mockResolvedValue(
        makeAIChatResponse(),
      );

    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      {
        configurable: true,

        value:
          vi.fn(),
      },
    );

    vi.spyOn(
      window,
      "requestAnimationFrame",
    ).mockImplementation(
      (
        callback:
          FrameRequestCallback,
      ) => {
        callback(
          0,
        );

        return 1;
      },
    );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  },
);


describe(
  "AIAnalystChat",
  () => {
    it(
      "checks Local AI readiness and enables the incident chat composer",
      async () => {
        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        const composer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );

        expect(
          mockedGetStatus,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          composer,
        ).toBeEnabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        ).toBeDisabled();
      },
    );


    it(
      "submits the incident question with Enter",
      async () => {
        mockedSend
          .mockRejectedValueOnce(
            new SentinelApiError(
              "timeout",
              504,
            ),
          );

        const user =
          userEvent.setup();

        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );


        const composer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );


        await user.type(
          composer,
          "Why is this suspicious?",
        );


        fireEvent.keyDown(
          composer,
          {
            key:
              "Enter",

            code:
              "Enter",
          },
        );


        await waitFor(
          () => {
            expect(
              mockedSend,
            ).toHaveBeenCalledWith(
              "INC-001",
              {
                message:
                  "Why is this suspicious?",

                history:
                  [],
              },
            );
          },
        );
      },
    );


    it(
      "keeps Shift+Enter available for multiline input without submitting",
      async () => {
        const user =
          userEvent.setup();

        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );


        const composer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );


        await user.type(
          composer,
          "First line",
        );


        const keyDownResult =
          fireEvent.keyDown(
            composer,
            {
              key:
                "Enter",

              code:
                "Enter",

              shiftKey:
                true,
            },
          );


        expect(
          keyDownResult,
        ).toBe(
          true,
        );

        expect(
          mockedSend,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      "disables chat when Local AI is unavailable",
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
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        expect(
          await screen.findByText(
            "Ollama is unavailable.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByPlaceholderText(
            "Local AI is unavailable...",
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
      "recovers after an AI status request failure",
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
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        expect(
          await screen.findByText(
            "Unable to reach Local AI.",
          ),
        ).toBeInTheDocument();

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
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          ),
        ).toBeEnabled();

        expect(
          mockedGetStatus,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "sends a grounded incident question and persists the completed conversation",
      async () => {
        vi.useFakeTimers();

        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );

        const composer =
          screen.getByPlaceholderText(
            "Ask a question about this incident...",
          );

        fireEvent.change(
          composer,
          {
            target: {
              value:
                "What evidence makes this incident suspicious?",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        );

        expect(
          mockedSend,
        ).toHaveBeenCalledWith(
          "INC-001",
          {
            message:
              "What evidence makes this incident suspicious?",

            history:
              [],
          },
        );

        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              5_000,
            );
          },
        );

        expect(
          screen.getByText(
            "The repeated failures followed by unusual access are the strongest authentication indicators in the supplied evidence.",
          ),
        ).toBeInTheDocument();

        const stored =
          sessionStorage.getItem(
            getAIChatStorageKey(
              "INC-001",
            ),
          );

        expect(
          stored,
        ).not.toBeNull();

        const parsed =
          JSON.parse(
            stored!,
          );

        expect(
          parsed,
        ).toHaveLength(
          2,
        );

        expect(
          parsed[0].role,
        ).toBe(
          "user",
        );

        expect(
          parsed[1].role,
        ).toBe(
          "assistant",
        );
      },
    );


    it(
      "announces active AI processing and exposes the chat as busy",
      async () => {
        vi.useFakeTimers({
          shouldAdvanceTime:
            true,
        });

        const user =
          userEvent.setup();

        let resolveSend:
          (
            value:
              ReturnType<
                typeof makeAIChatResponse
              >,
          ) => void;

        mockedSend
          .mockImplementation(
            () => (
              new Promise(
                (resolve) => {
                  resolveSend =
                    resolve;
                },
              )
            ),
          );


        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );


        const composer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );


        await user.type(
          composer,
          "Why is this suspicious?",
        );


        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        );


        await waitFor(
          () => {
            expect(
              mockedSend,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );


        const chatRegion =
          composer.closest(
            "section",
          );

        expect(
          chatRegion,
        ).not.toBeNull();

        expect(
          chatRegion,
        ).toHaveAttribute(
          "aria-busy",
          "true",
        );


        expect(
          screen.getByRole(
            "status",
          ),
        ).toBeInTheDocument();


        resolveSend!(
          makeAIChatResponse(),
        );


        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              5000,
            );
          },
        );


        await waitFor(
          () => {
            expect(
              chatRegion,
            ).toHaveAttribute(
              "aria-busy",
              "false",
            );
          },
        );
      },
    );


    it(
      "hydrates completed chat history from session storage",
      async () => {
        sessionStorage.setItem(
          getAIChatStorageKey(
            "INC-001",
          ),
          JSON.stringify([
            {
              id:
                "user-1",

              role:
                "user",

              content:
                "What happened?",
            },

            {
              id:
                "assistant-1",

              role:
                "assistant",

              content:
                "Cached grounded answer.",

              responseType:
                "ANSWER",

              generationDurationMs:
                1200,
            },
          ]),
        );

        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        expect(
          screen.getByText(
            "What happened?",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Cached grounded answer.",
          ),
        ).toBeInTheDocument();

        expect(
          mockedSend,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      "maps a timeout failure and allows retry without duplicating the user question",
      async () => {
        mockedSend
          .mockRejectedValueOnce(
            new SentinelApiError(
              "timeout",
              504,
            ),
          )
          .mockResolvedValueOnce(
            makeAIChatResponse(),
          );

        const user =
          userEvent.setup();

        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        const composer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );

        await user.type(
          composer,
          "Why is this suspicious?",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        );

        expect(
          await screen.findByText(
            "The local AI model took too long to respond. You can retry this question or ask a new one.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "alert",
          ),
        ).toHaveTextContent(
          "The local AI model took too long to respond.",
        );

        expect(
          screen.getAllByText(
            "Why is this suspicious?",
          ),
        ).toHaveLength(
          1,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Retry",
            },
          ),
        );

        expect(
          mockedSend,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedSend,
        ).toHaveBeenNthCalledWith(
          2,
          "INC-001",
          {
            message:
              "Why is this suspicious?",

            history:
              [],
          },
        );
      },
    );


    it(
      "maps provider-unavailable and invalid-response failures safely",
      async () => {
        mockedSend
          .mockRejectedValueOnce(
            new SentinelApiError(
              "provider unavailable",
              503,
            ),
          );

        const user =
          userEvent.setup();

        const {
          unmount,
        } = render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        const firstComposer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );

        await user.type(
          firstComposer,
          "Explain the authentication activity.",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        );

        expect(
          await screen.findByText(
            "The local AI provider is currently unavailable. You can retry this question after checking the local AI service.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "alert",
          ),
        ).toHaveTextContent(
          "The local AI provider is currently unavailable.",
        );

        expect(
          sessionStorage.getItem(
            getAIChatStorageKey(
              "INC-001",
            ),
          ),
        ).toBeNull();

        unmount();

        sessionStorage.clear();

        mockedSend
          .mockRejectedValueOnce(
            new SentinelApiError(
              "invalid response",
              502,
            ),
          );

        render(
          <AIAnalystChat
            incidentId="INC-002"
          />,
        );

        const secondComposer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );

        await user.type(
          secondComposer,
          "Explain the suspicious evidence.",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        );

        expect(
          await screen.findByText(
            "The local AI returned an invalid response. Nothing unvalidated was shown. You can retry the question.",
          ),
        ).toBeInTheDocument();

        expect(
          sessionStorage.getItem(
            getAIChatStorageKey(
              "INC-002",
            ),
          ),
        ).toBeNull();
      },
    );


    it(
      "sends completed conversation history with the next question",
      async () => {
        vi.useFakeTimers();

        sessionStorage.setItem(
          getAIChatStorageKey(
            "INC-001",
          ),
          JSON.stringify([
            {
              id:
                "user-old",

              role:
                "user",

              content:
                "What happened?",
            },

            {
              id:
                "assistant-old",

              role:
                "assistant",

              content:
                "Authentication failures were followed by unusual access.",

              responseType:
                "ANSWER",

              generationDurationMs:
                1200,

              retryContext: {
                question:
                  "What happened?",

                userMessageId:
                  "user-old",

                history:
                  [],
              },
            },
          ]),
        );

        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );

        fireEvent.change(
          screen.getByPlaceholderText(
            "Ask a question about this incident...",
          ),
          {
            target: {
              value:
                "What should I investigate next?",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        );

        expect(
          mockedSend,
        ).toHaveBeenCalledWith(
          "INC-001",
          {
            message:
              "What should I investigate next?",

            history: [
              {
                role:
                  "user",

                content:
                  "What happened?",
              },

              {
                role:
                  "assistant",

                content:
                  "Authentication failures were followed by unusual access.",
              },
            ],
          },
        );

        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              5_000,
            );
          },
        );
      },
    );


    it(
      "clears the current incident chat cache without affecting AI investigation storage",
      async () => {
        sessionStorage.setItem(
          getAIChatStorageKey(
            "INC-001",
          ),
          JSON.stringify([
            {
              id:
                "user-1",

              role:
                "user",

              content:
                "Cached question",
            },
          ]),
        );

        sessionStorage.setItem(
          "sentinel:incident-ai:investigation:INC-001",
          JSON.stringify({
            preserved:
              true,
          }),
        );

        const user =
          userEvent.setup();

        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );

        expect(
          screen.getByText(
            "Cached question",
          ),
        ).toBeInTheDocument();

        const clearButton =
          screen.queryByRole(
            "button",
            {
              name:
                /Clear Chat/i,
            },
          );

        expect(
          clearButton,
        ).not.toBeNull();

        await user.click(
          clearButton!,
        );

        expect(
          screen.queryByText(
            "Cached question",
          ),
        ).not.toBeInTheDocument();

        expect(
          sessionStorage.getItem(
            getAIChatStorageKey(
              "INC-001",
            ),
          ),
        ).toBeNull();

        expect(
          sessionStorage.getItem(
            "sentinel:incident-ai:investigation:INC-001",
          ),
        ).not.toBeNull();
      },
    );


    it(
      "rechecks Local AI status when the parent refresh signal changes",
      async () => {
        const {
          rerender,
        } = render(
          <AIAnalystChat
            incidentId="INC-001"
            statusRefreshSignal={
              1
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
          <AIAnalystChat
            incidentId="INC-001"
            statusRefreshSignal={
              2
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
      "loads a starter question into the chat composer",
      async () => {
        const user =
          userEvent.setup();


        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );


        const composer =
          await screen.findByPlaceholderText(
            "Ask a question about this incident...",
          );


        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Why is this activity suspicious?",
            },
          ),
        );


        expect(
          composer,
        ).toHaveValue(
          "Why is this activity suspicious?",
        );
      },
    );


    it(
      "retries the latest successful AI response for the same question",
      async () => {
        vi.useFakeTimers();


        render(
          <AIAnalystChat
            incidentId="INC-001"
          />,
        );


        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );


        const composer =
          screen.getByPlaceholderText(
            "Ask a question about this incident...",
          );


        fireEvent.change(
          composer,
          {
            target: {
              value:
                "Why is this activity suspicious?",
            },
          },
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Send",
            },
          ),
        );


        expect(
          mockedSend,
        ).toHaveBeenCalledTimes(
          1,
        );


        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              5_000,
            );
          },
        );


        const retryButton =
          screen.getByRole(
            "button",
            {
              name:
                "Retry",
            },
          );


        fireEvent.click(
          retryButton,
        );


        expect(
          mockedSend,
        ).toHaveBeenCalledTimes(
          2,
        );


        expect(
          mockedSend,
        ).toHaveBeenNthCalledWith(
          1,
          "INC-001",
          {
            message:
              "Why is this activity suspicious?",

            history:
              [],
          },
        );


        expect(
          mockedSend,
        ).toHaveBeenNthCalledWith(
          2,
          "INC-001",
          {
            message:
              "Why is this activity suspicious?",

            history:
              [],
          },
        );
      },
    );
  },
);
