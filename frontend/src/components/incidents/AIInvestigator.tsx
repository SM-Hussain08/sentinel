import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  AIConfidence,
  AIInvestigationResponse,
  AIServiceStatus,
} from "../../types/ai";

import {
  generateAIInvestigation,
  getAIServiceStatus,
  SentinelApiError,
} from "../../services/api";

import {
  getAIInvestigationStorageKey,
  readSessionValue,
  writeSessionValue,
} from "../../utils/incidentAIStorage";

import SectionHeader from "../shared/SectionHeader";


interface AIInvestigatorProps {
  incidentId: string;

  statusRefreshSignal?: number;
}


interface GenerationFailure {
  status: number | null;
  message: string;
}


const CONFIDENCE_STYLES: Record<
  AIConfidence,
  string
> = {
  LOW:
    "border-amber-900/55 bg-amber-950/20 text-amber-300",

  MEDIUM:
    "border-cyan-900/55 bg-cyan-950/20 text-cyan-300",

  HIGH:
    "border-emerald-900/55 bg-emerald-950/20 text-emerald-300",
};


function IntelligenceList({
  items,
  emptyMessage,
}: {
  items: string[];
  emptyMessage: string;
}) {
  if (
    items.length === 0
  ) {
    return (
      <p
        className="
          text-xs
          leading-5
          text-slate-600
        "
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      className="
        space-y-2.5
      "
    >
      {items.map(
        (
          item,
          index,
        ) => (
          <div
            key={
              `${item}-${index}`
            }
            className="
              flex
              gap-3
            "
          >
            <div
              className="
                mt-0.5
                flex h-5 w-5
                shrink-0
                items-center
                justify-center
                rounded-md
                border
                border-slate-800
                bg-[#0b111c]
                text-[9px]
                font-semibold
                text-cyan-500
              "
            >
              {index + 1}
            </div>

            <p
              className="
                text-xs
                leading-5
                text-slate-400
              "
            >
              {item}
            </p>
          </div>
        ),
      )}
    </div>
  );
}


function AIInvestigator({
  incidentId,
  statusRefreshSignal = 0,
}: AIInvestigatorProps) {
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
    investigation,
    setInvestigation,
  ] = useState<
    AIInvestigationResponse | null
  >(() =>
    readSessionValue<
      AIInvestigationResponse
    >(
      getAIInvestigationStorageKey(
        incidentId,
      ),
    ),
  );

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(
    false,
  );

  const [
    generationFailure,
    setGenerationFailure,
  ] = useState<
    GenerationFailure | null
  >(null);

  const [
    elapsedSeconds,
    setElapsedSeconds,
  ] = useState(
    0,
  );


  const generationRequestId =
    useRef(0);


  /*
   * Initial local AI health check.
   */
  useEffect(() => {
    let cancelled = false;

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
      cancelled = true;
    };
  }, [
    statusRefreshSignal,
  ]);


  /*
   * Elapsed generation timer.
   */
  useEffect(() => {
    if (
      !isGenerating
    ) {
      return;
    }

    const startedAt =
      Date.now();

    const timer =
      window.setInterval(
        () => {
          const elapsed =
            Math.floor(
              (
                Date.now()
                - startedAt
              )
              / 1000,
            );

          setElapsedSeconds(
            elapsed,
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
    isGenerating,
  ]);


  const aiReady =
    status?.enabled
    && status.available;


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


  async function handleGenerate() {
    if (
      !aiReady
      || isGenerating
    ) {
      return;
    }

    const requestId =
      generationRequestId.current
      + 1;

    generationRequestId.current =
      requestId;

    setIsGenerating(
      true,
    );

    setGenerationFailure(
      null,
    );

    setInvestigation(
      null,
    );

    setElapsedSeconds(
      0,
    );

    try {
      const result =
        await generateAIInvestigation(
          incidentId,
        );

      if (
        generationRequestId.current
        !== requestId
      ) {
        return;
      }

      setInvestigation(
        result,
      );

      writeSessionValue(
        getAIInvestigationStorageKey(
          incidentId,
        ),
        result,
      );

    } catch (
      error
    ) {
      if (
        generationRequestId.current
        !== requestId
      ) {
        return;
      }

      if (
        error
        instanceof SentinelApiError
      ) {
        setGenerationFailure({
          status:
            error.status,

          message:
            error.message,
        });

        /*
         * If the provider became unavailable,
         * immediately reflect that state in
         * the current panel.
         */
        if (
          error.status === 503
        ) {
          setStatus(
            status
              ? {
                  ...status,
                  available:
                    false,
                  message:
                    error.message,
                }
              : null,
          );
        }

        return;
      }

      setGenerationFailure({
        status:
          null,

        message:
          error instanceof Error
            ? error.message
            : "Local AI investigation could not be generated.",
      });
    } finally {
      if (
        generationRequestId.current
        === requestId
      ) {
        setIsGenerating(
          false,
        );
      }
    }
  }


  function generationMessage() {
    if (
      elapsedSeconds < 10
    ) {
      return "Preparing grounded incident context...";
    }

    if (
      elapsedSeconds < 25
    ) {
      return "Local model is reviewing the evidence...";
    }

    if (
      elapsedSeconds < 45
    ) {
      return "Generating analyst intelligence...";
    }

    if (
      elapsedSeconds < 70
    ) {
      return "Local CPU inference is still running...";
    }

    return "Generation is approaching the configured timeout window...";
  }


  function failureTitle() {
    if (
      generationFailure?.status
      === 504
    ) {
      return "Local AI timed out";
    }

    if (
      generationFailure?.status
      === 503
    ) {
      return "Local AI unavailable";
    }

    if (
      generationFailure?.status
      === 502
    ) {
      return "AI response could not be validated";
    }

    return "AI generation failed";
  }


  function failureGuidance() {
    if (
      generationFailure?.status
      === 504
    ) {
      return (
        "The local model exceeded SENTINEL's generation timeout. "
        + "The deterministic investigation remains fully available. "
        + "You can retry the analysis."
      );
    }

    if (
      generationFailure?.status
      === 503
    ) {
      return (
        "The configured local AI provider or model is currently "
        + "unavailable. SENTINEL's deterministic investigation "
        + "continues to work without the language model."
      );
    }

    if (
      generationFailure?.status
      === 502
    ) {
      return (
        "The local model returned output that did not satisfy "
        + "SENTINEL's required structured response schema. "
        + "The unvalidated output was not displayed."
      );
    }

    return (
      "The local AI request could not be completed. "
      + "The deterministic investigation remains available."
    );
  }


  const content =
    investigation?.content;


  return (
    <article
      aria-busy={
        isGenerating
      }
      className="
        relative
        overflow-hidden
        rounded-2xl
        border
        border-cyan-900/40
        bg-[#101826]/90
        p-5
        shadow-[0_12px_35px_rgba(0,0,0,0.12)]
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          right-[-100px]
          top-[-100px]
          h-64 w-64
          rounded-full
          bg-cyan-400/[0.035]
          blur-[100px]
        "
      />

      <div
        className="
          relative
        "
      >
        <div
          className="
            flex flex-col
            gap-4
            lg:flex-row
            lg:items-start
            lg:justify-between
          "
        >
          <div>
            <span
              className="
                mb-1.5
                inline-flex
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

            <SectionHeader
              eyebrow="Evidence-grounded analyst intelligence"
              title="AI Investigator"
            />

            <p
              className="
                mt-3
                max-w-3xl
                text-xs
                leading-5
                text-slate-500
              "
            >
              SENTINEL explains structured
              incident evidence after anomaly
              detection, correlation and
              deterministic investigation.
            </p>
          </div>

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
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

            {!isLoadingStatus
              && aiReady && (
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

            {!isLoadingStatus
              && !aiReady && (
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
          </div>
        </div>


        <div
          className="
            mt-5
            grid
            gap-3
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <div
            className="
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              Incident
            </p>

            <p
              className="
                mt-2
                font-mono
                text-xs
                text-cyan-400
              "
            >
              {incidentId}
            </p>
          </div>

          <div
            className="
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              Provider
            </p>

            <p
              className="
                mt-2
                text-sm
                font-semibold
                text-slate-200
              "
            >
              {
                status?.provider
                  ?? "—"
              }
            </p>
          </div>

          <div
            className="
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              Model
            </p>

            <p
              className="
                mt-2
                text-sm
                font-semibold
                text-slate-200
              "
            >
              {
                status?.model
                  ?? "—"
              }
            </p>
          </div>

          <div
            className="
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              Grounding
            </p>

            <p
              className="
                mt-2
                text-sm
                font-semibold
                text-slate-200
              "
            >
              Deterministic evidence
            </p>
          </div>
        </div>


        {statusError && (
          <div
            role="alert"
            className="
              mt-4
              rounded-xl
              border
              border-amber-900/55
              bg-amber-950/15
              p-4
            "
          >
            <div
              className="
                flex
                flex-col
                gap-3
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.13em]
                    text-amber-400
                  "
                >
                  AI status unavailable
                </p>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-5
                    text-amber-200/80
                  "
                >
                  {statusError}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  isLoadingStatus
                }
                onClick={() => {
                  void handleRefreshStatus();
                }}
                className="
                  shrink-0
                  rounded-lg
                  border
                  border-amber-800/60
                  bg-amber-950/20
                  px-3 py-2
                  text-[10px]
                  font-semibold
                  text-amber-300
                  transition-colors
                  hover:bg-amber-950/35
                  disabled:cursor-wait
                  disabled:opacity-50
                "
              >
                Check Again
              </button>
            </div>
          </div>
        )}


        {!statusError
          && status
          && (
            <div
              className="
                mt-4
                flex
                flex-col
                gap-3
                rounded-xl
                border
                border-slate-800
                bg-[#0b111c]
                px-4 py-3
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <p
                className="
                  text-xs
                  leading-5
                  text-slate-500
                "
              >
                {status.message}
              </p>

              {!status.available && (
                <button
                  type="button"
                  disabled={
                    isLoadingStatus
                  }
                  onClick={() => {
                    void handleRefreshStatus();
                  }}
                  className="
                    shrink-0
                    rounded-lg
                    border
                    border-slate-700
                    px-3 py-2
                    text-[10px]
                    font-semibold
                    text-slate-400
                    transition-colors
                    hover:border-cyan-900
                    hover:text-cyan-300
                    disabled:cursor-wait
                    disabled:opacity-50
                  "
                >
                  Check Again
                </button>
              )}
            </div>
          )}


        {generationFailure && (
          <div
            role="alert"
            className="
              mt-5
              rounded-xl
              border
              border-red-900/55
              bg-red-950/15
              p-5
            "
          >
            <div
              className="
                flex
                flex-col
                gap-4
                lg:flex-row
                lg:items-start
                lg:justify-between
              "
            >
              <div
                className="
                  max-w-4xl
                "
              >
                <p
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.14em]
                    text-red-400
                  "
                >
                  {failureTitle()}
                </p>

                <p
                  className="
                    mt-3
                    text-sm
                    leading-6
                    text-red-200/90
                  "
                >
                  {
                    generationFailure
                      .message
                  }
                </p>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-5
                    text-slate-500
                  "
                >
                  {failureGuidance()}
                </p>
              </div>

              <div
                className="
                  flex
                  shrink-0
                  flex-wrap
                  gap-2
                "
              >
                {generationFailure
                  .status === 503 && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleRefreshStatus();
                    }}
                    className="
                      rounded-lg
                      border
                      border-slate-700
                      bg-[#0b111c]
                      px-3 py-2
                      text-[10px]
                      font-semibold
                      text-slate-300
                      transition-colors
                      hover:border-cyan-900
                      hover:text-cyan-300
                    "
                  >
                    Check AI
                  </button>
                )}

                {generationFailure
                  .status !== 503 && (
                  <button
                    type="button"
                    disabled={
                      !aiReady
                      || isGenerating
                    }
                    onClick={() => {
                      void handleGenerate();
                    }}
                    className="
                      rounded-lg
                      border
                      border-red-800/60
                      bg-red-950/20
                      px-3 py-2
                      text-[10px]
                      font-semibold
                      text-red-300
                      transition-colors
                      hover:bg-red-950/35
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>

            <div
              className="
                mt-4
                rounded-lg
                border
                border-slate-800
                bg-[#0b111c]
                px-3 py-2.5
              "
            >
              <p
                className="
                  text-[10px]
                  leading-4
                  text-slate-600
                "
              >
                No failed or unvalidated AI
                output is used as incident
                evidence. SENTINEL's
                deterministic investigation
                remains authoritative.
              </p>
            </div>
          </div>
        )}


        {isGenerating && (
          <div
            role="status"
            className="
              mt-5
              overflow-hidden
              rounded-xl
              border
              border-cyan-900/50
              bg-cyan-950/10
              p-5
            "
          >
            <div
              className="
                flex
                items-center
                gap-4
              "
            >
              <div
                className="
                  flex h-10 w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-cyan-800/60
                  bg-cyan-950/30
                "
              >
                <div
                  className="
                    h-4 w-4
                    animate-spin
                    rounded-full
                    border-2
                    border-cyan-900
                    border-t-cyan-300
                  "
                />
              </div>

              <div
                className="
                  min-w-0 flex-1
                "
              >
                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    justify-between
                    gap-2
                  "
                >
                  <p
                    className="
                      text-sm
                      font-medium
                      text-slate-200
                    "
                  >
                    AI investigation in progress
                  </p>

                  <span
                    className="
                      font-mono
                      text-xs
                      text-cyan-400
                    "
                  >
                    {elapsedSeconds}s
                  </span>
                </div>

                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  {generationMessage()}
                </p>
              </div>
            </div>

            <div
              className="
                mt-4
                h-1
                overflow-hidden
                rounded-full
                bg-slate-900
              "
            >
              <div
                className="
                  h-full
                  w-1/2
                  animate-pulse
                  rounded-full
                  bg-cyan-500/60
                "
              />
            </div>

            <p
              className="
                mt-3
                text-[10px]
                leading-4
                text-slate-600
              "
            >
              Local CPU inference can take
              approximately 30–90 seconds.
              Deterministic investigation
              remains available while the
              local model is running.
            </p>
          </div>
        )}


        {content
          && investigation
          && !isGenerating && (
            <div
              className="
                mt-5
                space-y-4
              "
            >
              <div
                className="
                  rounded-xl
                  border
                  border-emerald-900/45
                  bg-emerald-950/10
                  p-5
                "
              >
                <div
                  className="
                    flex
                    flex-col
                    gap-4
                    lg:flex-row
                    lg:items-start
                    lg:justify-between
                  "
                >
                  <div
                    className="
                      max-w-4xl
                    "
                  >
                    <p
                      className="
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-[0.14em]
                        text-emerald-400
                      "
                    >
                      Executive Assessment
                    </p>

                    <p
                      className="
                        mt-3
                        text-sm
                        leading-7
                        text-slate-200
                      "
                    >
                      {
                        content
                          .executive_assessment
                      }
                    </p>
                  </div>

                  <div
                    className="
                      flex
                      shrink-0
                      flex-wrap
                      gap-2
                    "
                  >
                    <span
                      className={[
                        "rounded-full",
                        "border",
                        "px-3 py-1.5",
                        "text-[10px]",
                        "font-semibold",
                        "tracking-[0.11em]",
                        CONFIDENCE_STYLES[
                          content.confidence
                        ],
                      ].join(" ")}
                    >
                      {
                        content.confidence
                      }
                      {" "}
                      CONFIDENCE
                    </span>

                    {investigation
                      .grounded_on_deterministic_evidence && (
                      <span
                        className="
                          rounded-full
                          border
                          border-cyan-900/55
                          bg-cyan-950/20
                          px-3 py-1.5
                          text-[10px]
                          font-semibold
                          tracking-[0.11em]
                          text-cyan-300
                        "
                      >
                        GROUNDED
                      </span>
                    )}
                  </div>
                </div>
              </div>


              <div
                className="
                  grid
                  gap-4
                  xl:grid-cols-2
                "
              >
                <section
                  className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    p-5
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.14em]
                      text-cyan-500
                    "
                  >
                    Why Suspicious
                  </p>

                  <div
                    className="
                      mt-4
                    "
                  >
                    <IntelligenceList
                      items={
                        content
                          .why_suspicious
                      }
                      emptyMessage="No additional suspicious indicators were produced."
                    />
                  </div>
                </section>


                <section
                  className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    p-5
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.14em]
                      text-cyan-500
                    "
                  >
                    Timeline Interpretation
                  </p>

                  <p
                    className="
                      mt-4
                      text-xs
                      leading-6
                      text-slate-400
                    "
                  >
                    {
                      content
                        .timeline_interpretation
                    }
                  </p>
                </section>
              </div>


              <div
                className="
                  grid
                  gap-4
                  xl:grid-cols-2
                "
              >
                <section
                  className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    p-5
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.14em]
                      text-cyan-500
                    "
                  >
                    Investigation Priorities
                  </p>

                  <div
                    className="
                      mt-4
                    "
                  >
                    <IntelligenceList
                      items={
                        content
                          .investigation_priorities
                      }
                      emptyMessage="No additional investigation priorities were produced."
                    />
                  </div>
                </section>


                <section
                  className="
                    rounded-xl
                    border
                    border-orange-950/45
                    bg-orange-950/5
                    p-5
                  "
                >
                  <p
                    className="
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.14em]
                      text-orange-400
                    "
                  >
                    Containment Considerations
                  </p>

                  <div
                    className="
                      mt-4
                    "
                  >
                    <IntelligenceList
                      items={
                        content
                          .containment_considerations
                      }
                      emptyMessage="No additional containment considerations were produced."
                    />
                  </div>
                </section>
              </div>


              <section
                className="
                  rounded-xl
                  border
                  border-slate-800
                  bg-[#0b111c]
                  p-5
                "
              >
                <p
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.14em]
                    text-slate-500
                  "
                >
                  Limitations
                </p>

                <div
                  className="
                    mt-4
                  "
                >
                  <IntelligenceList
                    items={
                      content.limitations
                    }
                    emptyMessage="No additional limitations were returned."
                  />
                </div>
              </section>


              <div
                className="
                  flex
                  flex-col
                  gap-3
                  rounded-xl
                  border
                  border-slate-800
                  bg-[#0b111c]
                  px-4 py-3
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <div
                  className="
                    flex
                    flex-wrap
                    gap-x-5
                    gap-y-2
                    text-[10px]
                    text-slate-600
                  "
                >
                  <span>
                    Model:
                    {" "}
                    <span
                      className="
                        text-slate-400
                      "
                    >
                      {
                        investigation.model
                      }
                    </span>
                  </span>

                  <span>
                    Provider:
                    {" "}
                    <span
                      className="
                        text-slate-400
                      "
                    >
                      {
                        investigation.provider
                      }
                    </span>
                  </span>

                  <span>
                    Grounded:
                    {" "}
                    <span
                      className="
                        text-slate-400
                      "
                    >
                      {
                        investigation
                          .grounded_on_deterministic_evidence
                          ? "Yes"
                          : "No"
                      }
                    </span>
                  </span>
                </div>

                <p
                  className="
                    shrink-0
                    font-mono
                    text-[10px]
                    text-emerald-300
                  "
                >
                  {(
                    investigation
                      .generation_duration_ms
                    / 1000
                  ).toFixed(1)}
                  s generation
                </p>
              </div>
            </div>
          )}


        <div
          className="
            mt-5
            flex
            flex-col
            gap-3
            rounded-xl
            border
            border-cyan-950/50
            bg-cyan-950/10
            p-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-sm
                font-medium
                text-slate-200
              "
            >
              {
                investigation
                  ? "Regenerate AI investigation"
                  : "Generate AI investigation"
              }
            </p>

            <p
              className="
                mt-1
                text-xs
                leading-5
                text-slate-500
              "
            >
              AI analysis is explanatory
              guidance generated from
              SENTINEL's structured evidence.
              It does not replace analyst
              validation.
            </p>
          </div>

          <button
            type="button"
            disabled={
              !aiReady
              || isGenerating
            }
            onClick={() => {
              void handleGenerate();
            }}
            className="
              shrink-0
              rounded-xl
              border
              border-cyan-800/60
              bg-cyan-950/30
              px-4 py-2.5
              text-xs
              font-semibold
              text-cyan-300
              transition-all
              duration-200
              hover:-translate-y-0.5
              hover:border-cyan-600/70
              hover:bg-cyan-900/30
              disabled:cursor-not-allowed
              disabled:opacity-40
              disabled:hover:translate-y-0
            "
          >
            {
              isGenerating
                ? "Generating..."
                : investigation
                  ? "Regenerate Analysis"
                  : "Generate Analysis"
            }
          </button>
        </div>
      </div>
    </article>
  );
}


export default AIInvestigator;