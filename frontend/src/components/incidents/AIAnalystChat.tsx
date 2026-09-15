import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  AIChatHistoryMessage,
  AIChatResponseType,
  AIServiceStatus,
} from "../../types/ai";

import {
  getAIServiceStatus,
  sendAIIncidentChatMessage,
  SentinelApiError,
} from "../../services/api";

import {
  getAIChatStorageKey,
  readSessionValue,
  removeSessionValue,
  writeSessionValue,
} from "../../utils/incidentAIStorage";


interface AIAnalystChatProps {
  incidentId: string;

  statusRefreshSignal?: number;
}


interface RetryContext {
  question: string;

  userMessageId: string;

  history:
    AIChatHistoryMessage[];
}


interface DisplayMessage {
  id: string;

  role:
    | "user"
    | "assistant";

  content: string;

  responseType?:
    | AIChatResponseType;

  generationDurationMs?:
    | number;

  retryContext?:
    RetryContext;
}


interface FailedRequest
  extends RetryContext {
  message: string;

  status:
    number | null;
}


const MAX_MESSAGE_LENGTH =
  500;


const MINIMUM_RESPONSE_DISPLAY_MS =
  5000;


const RESPONSE_LABELS: Record<
  AIChatResponseType,
  string
> = {
  ANSWER:
    "Grounded answer",

  INVALID_QUESTION:
    "Question unclear",

  OUT_OF_SCOPE:
    "Outside incident scope",

  INSUFFICIENT_EVIDENCE:
    "Evidence limited",
};


const RESPONSE_STYLES: Record<
  AIChatResponseType,
  string
> = {
  ANSWER:
    "border-cyan-900/45 bg-cyan-950/10",

  INVALID_QUESTION:
    "border-amber-900/50 bg-amber-950/15",

  OUT_OF_SCOPE:
    "border-amber-900/50 bg-amber-950/15",

  INSUFFICIENT_EVIDENCE:
    "border-slate-700 bg-slate-900/55",
};


const RESPONSE_BADGE_STYLES: Record<
  AIChatResponseType,
  string
> = {
  ANSWER:
    "border-cyan-900/60 bg-cyan-950/30 text-cyan-300",

  INVALID_QUESTION:
    "border-amber-900/60 bg-amber-950/30 text-amber-300",

  OUT_OF_SCOPE:
    "border-amber-900/60 bg-amber-950/30 text-amber-300",

  INSUFFICIENT_EVIDENCE:
    "border-slate-700 bg-slate-900 text-slate-400",
};


function createMessageId() {
  return (
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
  );
}


function sleep(
  milliseconds: number,
) {
  return new Promise<void>(
    (
      resolve,
    ) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}


function getThinkingMessage(
  elapsedSeconds: number,
) {
  if (
    elapsedSeconds
    < 5
  ) {
    return {
      title:
        "Thinking through your question…",

      detail:
        "Preparing an incident-scoped response.",
    };
  }


  if (
    elapsedSeconds
    < 15
  ) {
    return {
      title:
        "Reviewing incident evidence…",

      detail:
        "Checking the available security context.",
    };
  }


  if (
    elapsedSeconds
    < 25
  ) {
    return {
      title:
        "Cross-checking timeline and risk signals…",

      detail:
        "Comparing relevant activity across the incident.",
    };
  }


  if (
    elapsedSeconds
    < 40
  ) {
    return {
      title:
        "Evaluating the available evidence…",

      detail:
        "Keeping the response grounded in SENTINEL data.",
    };
  }


  if (
    elapsedSeconds
    < 55
  ) {
    return {
      title:
        "Building a grounded response…",

      detail:
        "Organizing the evidence into a concise answer.",
    };
  }


  if (
    elapsedSeconds
    < 75
  ) {
    return {
      title:
        "Local AI is still processing…",

      detail:
        "CPU inference can take longer for evidence-heavy questions.",
    };
  }


  return {
    title:
      "This is taking longer than usual…",

    detail:
      "Local inference may take around 60–90 seconds. If it times out, you can retry.",
  };
}


function getResponseMetadata(
  message: DisplayMessage,
) {
  const duration =
    message
      .generationDurationMs;


  if (
    duration
    === 0
  ) {
    return {
      label:
        "AI guidance",

      timing:
        "instant",
    };
  }


  if (
    typeof duration
    !== "number"
  ) {
    return null;
  }


  if (
    message.responseType
    === "ANSWER"
  ) {
    return {
      label:
        "Grounded evidence",

      timing:
        `${(
          duration
          / 1000
        ).toFixed(
          1,
        )}s`,
    };
  }


  return {
    label:
      "Incident scope check",

    timing:
      `${(
        duration
        / 1000
      ).toFixed(
        1,
      )}s`,
  };
}


function AIAnalystChat({
  incidentId,
  statusRefreshSignal = 0,
}: AIAnalystChatProps) {
  const [
    status,
    setStatus,
  ] = useState<
    AIServiceStatus | null
  >(null);

  const [
    isLoadingStatus,
    setIsLoadingStatus,
  ] = useState(
    true,
  );

  const [
    statusError,
    setStatusError,
  ] = useState<
    string | null
  >(null);


  const [
    messages,
    setMessages,
  ] = useState<
    DisplayMessage[]
  >(() =>
    readSessionValue<
      DisplayMessage[]
    >(
      getAIChatStorageKey(
        incidentId,
      ),
    )
    ?? [],
  );

  const [
    input,
    setInput,
  ] = useState(
    "",
  );

  const [
    isSending,
    setIsSending,
  ] = useState(
    false,
  );

  const [
    elapsedSeconds,
    setElapsedSeconds,
  ] = useState(
    0,
  );

  const [
    failedRequest,
    setFailedRequest,
  ] = useState<
    FailedRequest | null
  >(null);


  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );


  const requestIdRef =
    useRef(
      0,
    );

  
  // ==========================================================
  // Precise Scroll Helper
  // ==========================================================

  function scrollToChatEnd() {
    /*
    * Wait until React has committed the
    * newly rendered chat content before
    * asking the browser to scroll.
    *
    * This function is called only for
    * explicit chat interactions:
    * - sending a question
    * - receiving an AI response
    * - rendering a request error
    * - retrying a request
    */
    window.requestAnimationFrame(
      () => {
        window.requestAnimationFrame(
          () => {
            messagesEndRef
              .current
              ?.scrollIntoView({
                behavior:
                  "smooth",

                block:
                  "nearest",
              });
          },
        );
      },
    );
  }


  // ==========================================================
  // Local AI status
  // ==========================================================

  useEffect(() => {
    let cancelled =
      false;


    async function loadStatus() {
      try {
        const result =
          await getAIServiceStatus();

        if (
          cancelled
        ) {
          return;
        }

        setStatus(
          result,
        );

        setStatusError(
          null,
        );
      } catch (
        error
      ) {
        if (
          cancelled
        ) {
          return;
        }

        setStatus(
          null,
        );

        setStatusError(
          error instanceof Error
            ? error.message
            : "Unable to check local AI status.",
        );
      } finally {
        if (
          !cancelled
        ) {
          setIsLoadingStatus(
            false,
          );
        }
      }
    }


    void loadStatus();


    return () => {
      cancelled =
        true;
    };
  }, [
    statusRefreshSignal,
  ]);


  // ==========================================================
  // Inference timer
  // ==========================================================

  useEffect(() => {
    if (
      !isSending
    ) {
      return;
    }


    const startedAt =
      Date.now();


    const timer =
      window.setInterval(
        () => {
          setElapsedSeconds(
            Math.floor(
              (
                Date.now()
                - startedAt
              )
              / 1000,
            ),
          );
        },
        1000,
      );


    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    isSending,
  ]);



  const aiReady =
    Boolean(
      status?.enabled
      && status.available,
    );


  const normalizedInput =
    input.trim();


  const canSend =
    Boolean(
      aiReady
      && normalizedInput
      && !isSending
      && normalizedInput.length
        <= MAX_MESSAGE_LENGTH,
    );


  const thinkingState =
    getThinkingMessage(
      elapsedSeconds,
    );


  // ==========================================================
  // Status refresh
  // ==========================================================

  async function handleRefreshStatus() {
    if (
      isLoadingStatus
    ) {
      return;
    }


    setIsLoadingStatus(
      true,
    );

    setStatusError(
      null,
    );


    try {
      const result =
        await getAIServiceStatus();

      setStatus(
        result,
      );
    } catch (
      error
    ) {
      setStatus(
        null,
      );

      setStatusError(
        error instanceof Error
          ? error.message
          : "Unable to check local AI status.",
      );
    } finally {
      setIsLoadingStatus(
        false,
      );
    }
  }


  // ==========================================================
  // Chat history
  // ==========================================================

  function buildHistory(
    sourceMessages:
      DisplayMessage[],
  ): AIChatHistoryMessage[] {
    return sourceMessages
      .slice(
        -6,
      )
      .map(
        (
          message,
        ) => ({
          role:
            message.role,

          content:
            message.content,
        }),
      );
  }


  /*
   * If the previous request failed and the analyst chooses to
   * ask something new, remove the failed user question first.
   */
  function removeFailedUserMessage(
    sourceMessages:
      DisplayMessage[],
  ) {
    if (
      !failedRequest
    ) {
      return sourceMessages;
    }


    return sourceMessages.filter(
      (
        message,
      ) => (
        message.id
        !== failedRequest
          .userMessageId
      ),
    );
  }


  // ==========================================================
  // Error formatting
  // ==========================================================

  function createFailure(
    error: unknown,
  ) {
    let message =
      "Unable to complete the AI chat request.";

    let statusCode:
      number | null =
      null;


    if (
      error
      instanceof SentinelApiError
    ) {
      statusCode =
        error.status;


      if (
        error.status
        === 504
      ) {
        message =
          "The local AI model took too long to respond. You can retry this question or ask a new one.";
      } else if (
        error.status
        === 503
      ) {
        message =
          "The local AI provider is currently unavailable. You can retry this question after checking the local AI service.";
      } else if (
        error.status
        === 502
      ) {
        message =
          "The local AI returned an invalid response. Nothing unvalidated was shown. You can retry the question.";
      } else if (
        error.status
        === 404
      ) {
        message =
          "This incident could not be found. You can retry if the incident becomes available again.";
      } else {
        message =
          error.message;
      }
    } else if (
      error
      instanceof Error
    ) {
      message =
        error.message;
    }


    return {
      message,
      statusCode,
    };
  }


  // ==========================================================
  // Request execution
  // ==========================================================

  async function executeRequest({
    question,
    history,
    userMessageId,
  }: RetryContext) {
    const requestId =
      requestIdRef.current
      + 1;


    requestIdRef.current =
      requestId;

    setFailedRequest(
      null,
    );

    setIsSending(
      true,
    );

    setElapsedSeconds(
      0,
    );


    try {
      const [
        response,
        ] = await Promise.all([
        sendAIIncidentChatMessage(
          incidentId,
          {
            message:
              question,

            history,
          },
        ),

        sleep(
          MINIMUM_RESPONSE_DISPLAY_MS,
        ),
      ]);


      /*
       * Ignore an obsolete response if a newer request has
       * already started.
       */
      if (
        requestIdRef.current
        !== requestId
      ) {
        return;
      }


      const assistantMessage:
        DisplayMessage = {
          id:
            createMessageId(),

          role:
            "assistant",

          content:
            response
              .content
              .answer,

          responseType:
            response
              .content
              .response_type,

          generationDurationMs:
            response
              .generation_duration_ms,

          retryContext: {
            question,

            userMessageId,

            history,
          },
        };


      setMessages(
        (
          current,
        ) => {
          const completedMessages = [
            ...current,
            assistantMessage,
          ];


          writeSessionValue(
            getAIChatStorageKey(
              incidentId,
            ),
            completedMessages,
          );


          return completedMessages;
        },
      );

      scrollToChatEnd();

    } catch (
      error
    ) {
      if (
        requestIdRef.current
        !== requestId
      ) {
        return;
      }


      const failure =
        createFailure(
          error,
        );


      setFailedRequest({
        question,

        userMessageId,

        history,

        message:
          failure.message,

        status:
          failure.statusCode,
      });

      // scrollToChatEnd();

    } finally {
      if (
        requestIdRef.current
        === requestId
      ) {
        setIsSending(
          false,
        );

        setElapsedSeconds(
          0,
        );
      }
    }
  }


  // ==========================================================
  // New user question
  // ==========================================================

  async function handleSend() {
    if (
      !canSend
    ) {
      return;
    }


    const question =
      normalizedInput;


    /*
     * Preserve the existing behavior:
     *
     * asking a NEW question after a failed request removes the
     * failed question from the visible conversation.
     */
    const baseMessages =
      removeFailedUserMessage(
        messages,
      );


    const history =
      buildHistory(
        baseMessages,
      );


    const userMessage:
      DisplayMessage = {
        id:
          createMessageId(),

        role:
          "user",

        content:
          question,
      };


    setMessages([
      ...baseMessages,
      userMessage,
    ]);

    setFailedRequest(
      null,
    );

    setInput(
      "",
    );

    scrollToChatEnd();


    await executeRequest({
      question,

      history,

      userMessageId:
        userMessage.id,
    });
  }


  // ==========================================================
  // Retry failed request
  // ==========================================================

  async function handleFailedRetry() {
    if (
      !failedRequest
      || isSending
      || !aiReady
    ) {
      return;
    }


    const retry =
      failedRequest;


    /*
     * The original user bubble already exists.
     * Only remove the failure card and execute the request.
     */
    setFailedRequest(
      null,
    );

    scrollToChatEnd();

    await executeRequest({
      question:
        retry.question,

      history:
        retry.history,

      userMessageId:
        retry.userMessageId,
    });
  }


  // ==========================================================
  // Retry successful / classified AI response
  // ==========================================================

  async function handleResponseRetry(
    assistantMessageId: string,
  ) {
    if (
      isSending
      || !aiReady
    ) {
      return;
    }


    const assistantIndex =
      messages.findIndex(
        (
          message,
        ) => (
          message.id
          === assistantMessageId
        ),
      );


    if (
      assistantIndex
      < 0
    ) {
      return;
    }


    const assistantMessage =
      messages[
        assistantIndex
      ];


    const retryContext =
      assistantMessage
        .retryContext;


    if (
      !retryContext
    ) {
      return;
    }


    /*
     * Rewind to the user question associated with this answer.
     *
     * The assistant answer and any later conversation are
     * removed. This prevents later messages from depending on
     * an answer which has just been regenerated.
     */
    const rewoundMessages =
      messages.slice(
        0,
        assistantIndex,
      );


    setMessages(
      rewoundMessages,
    );

    setFailedRequest(
      null,
    );


    await executeRequest(
      retryContext,
    );
  }


  // ==========================================================
  // Clear chat
  // ==========================================================

  function handleClearChat() {
    if (
      isSending
    ) {
      return;
    }


    requestIdRef.current +=
      1;


    setMessages(
      [],
    );

    removeSessionValue(
      getAIChatStorageKey(
        incidentId,
      ),
    );

    setFailedRequest(
      null,
    );

    setInput(
      "",
    );

    setElapsedSeconds(
      0,
    );
  }


  // ==========================================================
  // Keyboard behavior
  // ==========================================================

  function handleKeyDown(
    event:
      React.KeyboardEvent<
        HTMLTextAreaElement
      >,
  ) {
    if (
      event.key
      !== "Enter"
    ) {
      return;
    }


    if (
      event.shiftKey
    ) {
      return;
    }


    event.preventDefault();


    void handleSend();
  }


  // ==========================================================
  // Render
  // ==========================================================

  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-800
        bg-[#080d16]
        shadow-[0_18px_55px_rgba(0,0,0,0.18)]
      "
    >
      {/* Header */}
      <div
        className="
          border-b
          border-slate-800
          bg-[#0a101b]
          px-5
          py-4
        "
      >
        <div
          className="
            flex
            flex-col
            gap-3
            sm:flex-row
            sm:items-start
            sm:justify-between
          "
        >
          <div>
            <div
              className="
                mb-1.5
                flex
                flex-wrap
                items-center
                gap-2
              "
            >
              <span
                className="
                  rounded-md
                  border
                  border-cyan-900/50
                  bg-cyan-950/20
                  px-2
                  py-1
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.18em]
                  text-cyan-400
                "
              >
                Local AI
              </span>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.15em]
                  text-slate-600
                "
              >
                Incident scoped
              </span>
            </div>


            <h3
              className="
                text-sm
                font-semibold
                text-slate-100
              "
            >
              AI Analyst Chat
            </h3>


            <p
              className="
                mt-1
                max-w-2xl
                text-xs
                leading-5
                text-slate-500
              "
            >
              Ask grounded follow-up questions about
              this incident&apos;s evidence, timeline,
              risk signals, investigation, or
              containment.
            </p>
          </div>


          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
            "
          >
            {isLoadingStatus && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-slate-700
                  bg-[#0b111c]
                  px-3 py-1.5
                  text-[10px]
                  font-semibold
                  tracking-[0.1em]
                  text-slate-500
                "
              >
                <span
                  className="
                    h-1.5 w-1.5
                    animate-pulse
                    rounded-full
                    bg-slate-500
                  "
                />

                CHECKING AI
              </span>
            )}

            {!isLoadingStatus && aiReady && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-emerald-900/55
                  bg-emerald-950/20
                  px-3 py-1.5
                  text-[10px]
                  font-semibold
                  tracking-[0.1em]
                  text-emerald-300
                "
              >
                <span
                  className="
                    h-1.5 w-1.5
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_9px_rgba(52,211,153,0.75)]
                  "
                />

                LOCAL AI READY
              </span>
            )}

            {!isLoadingStatus && !aiReady && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-amber-900/55
                  bg-amber-950/20
                  px-3 py-1.5
                  text-[10px]
                  font-semibold
                  tracking-[0.1em]
                  text-amber-300
                "
              >
                <span
                  className="
                    h-1.5 w-1.5
                    rounded-full
                    bg-amber-400
                  "
                />

                AI UNAVAILABLE
              </span>
            )}


            {(messages.length
              > 0
              || failedRequest)
              && (
                <button
                  type="button"
                  onClick={
                    handleClearChat
                  }
                  disabled={
                    isSending
                  }
                  className="
                    rounded-md
                    border
                    border-slate-800
                    bg-slate-950/40
                    px-2.5
                    py-1.5
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.1em]
                    text-slate-500
                    transition
                    hover:border-slate-700
                    hover:text-slate-300
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  Clear Chat
                </button>
              )}
          </div>
        </div>
      </div>


      {/* Chat window */}
      <div
        className="
          max-h-[460px]
          min-h-[300px]
          overflow-y-auto
          px-4
          py-5
          sm:px-5
        "
      >
        {messages.length
          === 0
          && !failedRequest
          && (
            <div
              className="
                mx-auto
                flex
                min-h-[245px]
                max-w-xl
                flex-col
                items-center
                justify-center
                text-center
              "
            >
              <div
                className="
                  mb-4
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-cyan-900/40
                  bg-cyan-950/15
                  text-sm
                  font-bold
                  text-cyan-400
                "
              >
                AI
              </div>


              <p
                className="
                  text-sm
                  font-medium
                  text-slate-300
                "
              >
                Ask about this incident
              </p>


              <p
                className="
                  mt-2
                  max-w-md
                  text-xs
                  leading-5
                  text-slate-600
                "
              >
                Answers are restricted to SENTINEL&apos;s
                deterministic incident evidence. The
                assistant will tell you when a question is
                unclear, outside scope, or unsupported by
                available evidence.
              </p>


              <div
                className="
                  mt-5
                  flex
                  flex-wrap
                  justify-center
                  gap-2
                "
              >
                {[
                  "What happened in this incident?",
                  "Why is this activity suspicious?",
                  "What should I investigate first?",
                ].map(
                  (
                    suggestion,
                  ) => (
                    <button
                      key={
                        suggestion
                      }
                      type="button"
                      disabled={
                        !aiReady
                        || isSending
                      }
                      onClick={
                        () => {
                          setInput(
                            suggestion,
                          );
                        }
                      }
                      className="
                        rounded-lg
                        border
                        border-slate-800
                        bg-slate-950/50
                        px-3
                        py-2
                        text-[10px]
                        text-slate-500
                        transition
                        hover:border-cyan-900/50
                        hover:text-cyan-300
                        disabled:cursor-not-allowed
                        disabled:opacity-40
                      "
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}


        <div
          className="
            space-y-4
          "
        >
          {messages.map(
            (
              message,
            ) => {
              const isUser =
                message.role
                === "user";

              const latestAssistantMessage =
                [...messages]
                  .reverse()
                  .find(
                    (
                      candidate,
                    ) => (
                      candidate.role
                      === "assistant"
                    ),
                  );


              const isLatestAssistant =
                !isUser
                && latestAssistantMessage
                  ?.id
                  === message.id;


              const metadata =
                getResponseMetadata(
                  message,
                );


              const isInstantGuidance =
                message
                  .generationDurationMs
                === 0;


              return (
                <div
                  key={
                    message.id
                  }
                  className={`
                    flex
                    ${
                      isUser
                        ? "justify-end"
                        : "justify-start"
                    }
                  `}
                >
                  <div
                    className={`
                      max-w-[88%]
                      rounded-xl
                      border
                      px-4
                      py-3
                      sm:max-w-[78%]
                      ${
                        isUser
                          ? "border-slate-700 bg-slate-800/60"
                          : message.responseType
                            ? RESPONSE_STYLES[
                                message.responseType
                              ]
                            : "border-slate-800 bg-slate-900/50"
                      }
                    `}
                  >
                    <div
                      className="
                        mb-2
                        flex
                        flex-wrap
                        items-center
                        gap-2
                      "
                    >
                      <span
                        className={`
                          text-[9px]
                          font-bold
                          uppercase
                          tracking-[0.15em]
                          ${
                            isUser
                              ? "text-slate-400"
                              : "text-cyan-400"
                          }
                        `}
                      >
                        {isUser
                          ? "You"
                          : "AI Analyst"}
                      </span>


                      {!isUser
                        && message
                          .responseType
                        && (
                          <span
                            className={`
                              rounded-md
                              border
                              px-1.5
                              py-0.5
                              text-[8px]
                              font-semibold
                              uppercase
                              tracking-[0.1em]
                              ${
                                RESPONSE_BADGE_STYLES[
                                  message
                                    .responseType
                                ]
                              }
                            `}
                          >
                            {isInstantGuidance
                              ? "AI guidance"
                              : RESPONSE_LABELS[
                                  message
                                    .responseType
                                ]}
                          </span>
                        )}
                    </div>


                    <p
                      className="
                        whitespace-pre-wrap
                        text-xs
                        leading-5
                        text-slate-300
                      "
                    >
                      {
                        message
                          .content
                      }
                    </p>


                    {!isUser
                      && (
                        <div
                          className="
                            mt-3
                            flex
                            flex-wrap
                            items-center
                            justify-between
                            gap-3
                            border-t
                            border-slate-800/70
                            pt-2
                          "
                        >
                          {metadata
                            && (
                              <div
                                className="
                                  flex
                                  items-center
                                  gap-2
                                  text-[9px]
                                  uppercase
                                  tracking-[0.1em]
                                  text-slate-600
                                "
                              >
                                <span>
                                  {
                                    metadata
                                      .label
                                  }
                                </span>

                                <span>
                                  •
                                </span>

                                <span>
                                  {
                                    metadata
                                      .timing
                                  }
                                </span>
                              </div>
                            )}


                          {isLatestAssistant
                            && message
                              .retryContext
                            && (
                              <button
                                type="button"
                                disabled={
                                  isSending
                                  || !aiReady
                                }
                                onClick={
                                  () => {
                                    void handleResponseRetry(
                                      message.id,
                                    );
                                  }
                                }
                                className="
                                  rounded-md
                                  border
                                  border-slate-700
                                  bg-slate-950/35
                                  px-2.5
                                  py-1.5
                                  text-[8px]
                                  font-semibold
                                  uppercase
                                  tracking-[0.1em]
                                  text-slate-500
                                  transition
                                  hover:border-cyan-900/70
                                  hover:text-cyan-300
                                  disabled:cursor-not-allowed
                                  disabled:opacity-40
                                "
                              >
                                Retry
                              </button>
                            )}
                        </div>
                      )}
                  </div>
                </div>
              );
            },
          )}


          {/* Progressive processing */}
          {isSending
            && (
              <div
                className="
                  flex
                  justify-start
                "
              >
                <div
                  className="
                    max-w-[88%]
                    rounded-xl
                    border
                    border-cyan-900/35
                    bg-cyan-950/10
                    px-4
                    py-3
                    sm:max-w-[78%]
                  "
                >
                  <div
                    className="
                      flex
                      items-start
                      gap-3
                    "
                  >
                    <div
                      className="
                        mt-1
                        flex
                        shrink-0
                        gap-1
                      "
                    >
                      <span
                        className="
                          h-1.5
                          w-1.5
                          animate-pulse
                          rounded-full
                          bg-cyan-500
                        "
                      />

                      <span
                        className="
                          h-1.5
                          w-1.5
                          animate-pulse
                          rounded-full
                          bg-cyan-500
                          [animation-delay:150ms]
                        "
                      />

                      <span
                        className="
                          h-1.5
                          w-1.5
                          animate-pulse
                          rounded-full
                          bg-cyan-500
                          [animation-delay:300ms]
                        "
                      />
                    </div>


                    <div>
                      <p
                        className="
                          text-[10px]
                          font-medium
                          text-cyan-300/90
                        "
                      >
                        {
                          thinkingState
                            .title
                        }
                      </p>

                      <p
                        className="
                          mt-1
                          text-[9px]
                          leading-4
                          text-slate-600
                        "
                      >
                        {
                          thinkingState
                            .detail
                        }
                      </p>

                      {elapsedSeconds
                        >= 5
                        && (
                          <p
                            className="
                              mt-2
                              text-[9px]
                              tabular-nums
                              text-slate-700
                            "
                          >
                            {
                              elapsedSeconds
                            }
                            s elapsed
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}


          {/* Failed request */}
          {failedRequest
            && !isSending
            && (
              <div
                className="
                  flex
                  justify-start
                "
              >
                <div
                  className="
                    max-w-[88%]
                    rounded-xl
                    border
                    border-rose-900/45
                    bg-rose-950/10
                    px-4
                    py-3
                    sm:max-w-[78%]
                  "
                >
                  <div
                    className="
                      mb-2
                      flex
                      flex-wrap
                      items-center
                      gap-2
                    "
                  >
                    <span
                      className="
                        text-[9px]
                        font-bold
                        uppercase
                        tracking-[0.15em]
                        text-rose-300
                      "
                    >
                      AI Analyst
                    </span>

                    <span
                      className="
                        rounded-md
                        border
                        border-rose-900/60
                        bg-rose-950/30
                        px-1.5
                        py-0.5
                        text-[8px]
                        font-semibold
                        uppercase
                        tracking-[0.1em]
                        text-rose-300
                      "
                    >
                      Request failed
                    </span>
                  </div>


                  <p
                    className="
                      text-xs
                      leading-5
                      text-slate-300
                    "
                  >
                    {
                      failedRequest
                        .message
                    }
                  </p>


                  <div
                    className="
                      mt-3
                      flex
                      flex-wrap
                      items-center
                      gap-3
                      border-t
                      border-rose-900/20
                      pt-3
                    "
                  >
                    <button
                      type="button"
                      onClick={
                        () => {
                          void handleFailedRetry();
                        }
                      }
                      disabled={
                        !aiReady
                        || isSending
                      }
                      className="
                        rounded-md
                        border
                        border-rose-800/60
                        bg-rose-950/25
                        px-3
                        py-1.5
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-[0.1em]
                        text-rose-300
                        transition
                        hover:border-rose-700
                        hover:bg-rose-950/40
                        disabled:cursor-not-allowed
                        disabled:opacity-40
                      "
                    >
                      Retry
                    </button>


                    <span
                      className="
                        text-[9px]
                        leading-4
                        text-slate-600
                      "
                    >
                      Or ask a new question to continue.
                    </span>
                  </div>
                </div>
              </div>
            )}


          <div
            ref={
              messagesEndRef
            }
          />
        </div>
      </div>


      {/* Provider status */}
      {(statusError
        || (
          !isLoadingStatus
          && !aiReady
        ))
        && (
          <div
            className="
              border-t
              border-slate-800
              bg-slate-950/45
              px-5
              py-3
            "
          >
            <div
              className="
                flex
                flex-col
                gap-2
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <p
                className="
                  text-[10px]
                  leading-4
                  text-amber-400/80
                "
              >
                {statusError
                  ?? status?.message
                  ?? "Local AI is currently unavailable."}
              </p>


              {!aiReady
                && (
                  <button
                    type="button"
                    onClick={
                      () => {
                        void handleRefreshStatus();
                      }
                    }
                    disabled={
                      isLoadingStatus
                    }
                    className="
                      self-start
                      rounded-md
                      border
                      border-slate-700
                      bg-slate-900
                      px-2.5
                      py-1.5
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.1em]
                      text-slate-400
                      transition
                      hover:border-cyan-900
                      hover:text-cyan-300
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                      sm:self-auto
                    "
                  >
                    {isLoadingStatus
                      ? "Checking..."
                      : "Check Again"}
                  </button>
                )}
            </div>
          </div>
        )}


      {/* Composer */}
      <div
        className="
          border-t
          border-slate-800
          bg-[#0a101b]
          p-4
          sm:p-5
        "
      >
        <div
          className="
            rounded-xl
            border
            border-slate-800
            bg-[#070c14]
            p-2
            transition
            focus-within:border-cyan-900/70
          "
        >
          <textarea
            value={
              input
            }
            onChange={
              (
                event,
              ) => {
                setInput(
                  event
                    .target
                    .value
                    .slice(
                      0,
                      MAX_MESSAGE_LENGTH,
                    ),
                );
              }
            }
            onKeyDown={
              handleKeyDown
            }
            disabled={
              !aiReady
              || isSending
            }
            rows={
              2
            }
            placeholder={
              aiReady
                ? failedRequest
                  ? "Ask a new question or retry the failed request..."
                  : "Ask a question about this incident..."
                : "Local AI is unavailable..."
            }
            className="
              min-h-[56px]
              w-full
              resize-none
              bg-transparent
              px-2
              py-2
              text-xs
              leading-5
              text-slate-200
              outline-none
              placeholder:text-slate-700
              disabled:cursor-not-allowed
            "
          />


          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              border-t
              border-slate-800/70
              px-2
              pt-2
            "
          >
            <div
              className="
                flex
                items-center
                gap-3
                text-[9px]
                text-slate-600
              "
            >
              <span>
                Enter to send
              </span>

              <span
                className="
                  hidden
                  sm:inline
                "
              >
                Shift + Enter for new line
              </span>

              <span>
                {
                  input.length
                }
                /
                {
                  MAX_MESSAGE_LENGTH
                }
              </span>
            </div>


            <button
              type="button"
              disabled={
                !canSend
              }
              onClick={
                () => {
                  void handleSend();
                }
              }
              className="
                rounded-lg
                border
                border-cyan-800/60
                bg-cyan-950/30
                px-4
                py-2
                text-[10px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-cyan-300
                transition
                hover:border-cyan-600
                hover:bg-cyan-950/50
                disabled:cursor-not-allowed
                disabled:border-slate-800
                disabled:bg-slate-900/40
                disabled:text-slate-700
              "
            >
              {isSending
                ? "Processing..."
                : "Send"}
            </button>
          </div>
        </div>


        <div
          className="
            mt-2
            flex
            flex-col
            gap-1
            text-[9px]
            leading-4
            text-slate-700
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <span>
            AI responses are explanatory and remain
            restricted to the selected incident.
          </span>

          <span>
            Local inference • CPU
          </span>
        </div>
      </div>
    </section>
  );
}


export default AIAnalystChat;