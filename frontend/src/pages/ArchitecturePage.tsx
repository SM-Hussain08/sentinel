import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getAIServiceStatus,
  getOperationsStatus,
} from "../services/api";

import type {
  OperationsStatus,
  ProcessorRuntimeStatus,
  RuntimeHealthState,
} from "../types/api";

import type {
  AIServiceStatus,
} from "../types/ai";


const AUTO_REFRESH_MS =
  10_000;


// ============================================================
// Static architecture content
// ============================================================

const ARCHITECTURE_STAGES = [
  {
    code: "01",
    eyebrow:
      "Telemetry",
    title:
      "Enterprise Event Sources",
    description:
      "Identity, authentication, file, network, database and other enterprise security activity enters SENTINEL as normalized events.",
  },

  {
    code: "02",
    eyebrow:
      "Persistence",
    title:
      "Event Store",
    description:
      "Security telemetry is persisted in PostgreSQL, providing a durable operational record for processing and investigation.",
  },

  {
    code: "03",
    eyebrow:
      "Runtime",
    title:
      "Event Processor",
    description:
      "The always-on processor independently discovers newly persisted events and advances them through SENTINEL's intelligence pipeline.",
  },

  {
    code: "04",
    eyebrow:
      "Detection",
    title:
      "Behavioral Intelligence",
    description:
      "Event features are transformed into behavioral anomaly scores and historical risk classifications using the selected production detector.",
  },

  {
    code: "05",
    eyebrow:
      "Correlation",
    title:
      "Incident Intelligence",
    description:
      "Related behavioral signals are correlated into persistent security incidents using deterministic correlation rules.",
  },

  {
    code: "06",
    eyebrow:
      "Investigation",
    title:
      "Analyst Evidence",
    description:
      "Incidents are enriched with timelines, affected identities, supporting events and deterministic investigation context.",
  },

  {
    code: "07",
    eyebrow:
      "Experience",
    title:
      "SOC Workspace",
    description:
      "Analysts review anomalies, incidents, identities and investigation evidence through the SENTINEL operational interface.",
  },
] as const;


const CORE_CAPABILITIES = [
  {
    code: "EP",
    tone:
      "cyan",
    title:
      "Event Processing",
    description:
      "Persistent worker state, automatic discovery and independent processing of newly arriving security events.",
  },

  {
    code: "BD",
    tone:
      "emerald",
    title:
      "Behavioral Detection",
    description:
      "Feature-driven behavioral anomaly scoring with production detector lineage and historical risk classification.",
  },

  {
    code: "IC",
    tone:
      "orange",
    title:
      "Incident Correlation",
    description:
      "Deterministic multi-event correlation converts related signals into durable investigation cases.",
  },

  {
    code: "IN",
    tone:
      "indigo",
    title:
      "Investigation Intelligence",
    description:
      "Structured timelines, evidence context and analyst-oriented investigation summaries remain available without an LLM.",
  },

  {
    code: "ID",
    tone:
      "cyan",
    title:
      "Identity Context",
    description:
      "Employee behavioral baselines connect security activity with the identities and operational context behind it.",
  },

  {
    code: "AI",
    tone:
      "violet",
    title:
      "Local AI Assistance",
    description:
      "Optional host-local AI interprets deterministic SENTINEL evidence and supports incident investigation without controlling detection.",
  },
] as const;


const DESIGN_PRINCIPLES = [
  {
    code: "01",
    title:
      "Deterministic Core",
    description:
      "Detection, correlation and investigation remain operational without a language model.",
  },

  {
    code: "02",
    title:
      "Persistent Runtime",
    description:
      "Processor identity, activation boundary and operational state survive service restarts.",
  },

  {
    code: "03",
    title:
      "Evidence Grounded",
    description:
      "AI receives operational SENTINEL evidence rather than hidden labels or private evaluation truth.",
  },

  {
    code: "04",
    title:
      "Local-First AI",
    description:
      "Optional inference is provided through a locally configured Ollama runtime.",
  },

  {
    code: "05",
    title:
      "Analyst-Oriented UX",
    description:
      "The frontend observes, investigates and explains security intelligence without controlling runtime services.",
  },
] as const;


// ============================================================
// Formatting
// ============================================================

function formatCount(
  value:
    number
    | null
    | undefined,
): string {
  if (
    value === null
    || value === undefined
  ) {
    return "—";
  }

  return value.toLocaleString();
}


function formatDateTime(
  value:
    string
    | null
    | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    },
  );
}


function formatRelativeTime(
  value:
    string
    | null
    | undefined,
  nowMs: number,
): string {
  if (!value) {
    return "Unavailable";
  }

  const timestamp =
    new Date(
      value,
    ).getTime();

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return "Unavailable";
  }

  if (
    nowMs <= 0
  ) {
    return "Available";
  }

  const ageSeconds =
    Math.max(
      0,
      Math.floor(
        (
          nowMs
          - timestamp
        ) / 1000,
      ),
    );

  if (
    ageSeconds < 5
  ) {
    return "Just now";
  }

  if (
    ageSeconds < 60
  ) {
    return `${ageSeconds}s ago`;
  }

  if (
    ageSeconds < 3600
  ) {
    const minutes =
      Math.floor(
        ageSeconds / 60,
      );

    return `${minutes} ${
      minutes === 1
        ? "min"
        : "mins"
    } ago`;
  }

  return `At ${
    new Date(
      value,
    ).toLocaleTimeString(
      undefined,
      {
        hour:
          "numeric",

        minute:
          "2-digit",
      },
    )
  }`;
}


function formatRefreshAge(
  refreshedAt:
    number
    | null,
  nowMs: number,
): string {
  if (
    refreshedAt === null
  ) {
    return "Waiting for refresh";
  }

  if (
    nowMs <= 0
  ) {
    return "Refreshed just now";
  }

  const seconds =
    Math.max(
      0,
      Math.floor(
        (
          nowMs
          - refreshedAt
        ) / 1000,
      ),
    );

  if (
    seconds < 5
  ) {
    return "Refreshed just now";
  }

  if (
    seconds < 60
  ) {
    return `Refreshed ${seconds}s ago`;
  }

  if (
    seconds < 3600
  ) {
    const minutes =
      Math.floor(
        seconds / 60,
      );

    return `Refreshed ${minutes} ${
      minutes === 1
        ? "min"
        : "mins"
    } ago`;
  }

  return `Last refreshed at ${
    new Date(
      refreshedAt,
    ).toLocaleTimeString(
      undefined,
      {
        hour:
          "numeric",

        minute:
          "2-digit",
      },
    )
  }`;
}


// ============================================================
// Runtime visual states
// ============================================================

interface RuntimePresentation {
  label: string;

  supporting:
    string;

  dotClass:
    string;

  labelClass:
    string;

  borderClass:
    string;

  panelClass:
    string;

  sideBarClass:
    string;

  glowClass:
    string;

  badgeClass:
    string;
}


function getRuntimePresentation(
  health:
    RuntimeHealthState,
  operational: boolean,
): RuntimePresentation {
  if (
    health === "HEALTHY"
    && operational
  ) {
    return {
      label:
        "Operational",

      supporting:
        "The SENTINEL event-processing core is active, receiving heartbeats and processing security telemetry.",

      dotClass:
        "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]",

      labelClass:
        "text-emerald-300",

      borderClass:
        "border-emerald-900/55",

      panelClass:
        "bg-[#101826]/90",

      sideBarClass:
        "bg-emerald-400/55",

      glowClass:
        "bg-emerald-400/[0.04]",

      badgeClass:
        "border-emerald-800/45 bg-emerald-950/30 text-emerald-300",
    };
  }

  if (
    health === "ERROR"
  ) {
    return {
      label:
        "Runtime Error",

      supporting:
        "The processor reported an operational failure. Persisted runtime state remains available for inspection.",

      dotClass:
        "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.6)]",

      labelClass:
        "text-rose-300",

      borderClass:
        "border-rose-900/55",

      panelClass:
        "bg-[#101826]/90",

      sideBarClass:
        "bg-rose-400/50",

      glowClass:
        "bg-rose-400/[0.03]",

      badgeClass:
        "border-rose-900/50 bg-rose-950/25 text-rose-300",
    };
  }

  if (
    health === "STALE"
  ) {
    return {
      label:
        "Heartbeat Stale",

      supporting:
        "The processor has not reported within the expected runtime window. Last-known state remains visible.",

      dotClass:
        "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]",

      labelClass:
        "text-amber-300",

      borderClass:
        "border-amber-900/50",

      panelClass:
        "bg-[#101826]/90",

      sideBarClass:
        "bg-amber-400/45",

      glowClass:
        "bg-amber-400/[0.025]",

      badgeClass:
        "border-amber-900/45 bg-amber-950/20 text-amber-300",
    };
  }

  if (
    health === "STOPPED"
  ) {
    return {
      label:
        "Processor Stopped",

      supporting:
        "Operational processing is offline. SENTINEL retains the previous processor identity, counters and runtime history.",

      dotClass:
        "bg-slate-500",

      labelClass:
        "text-slate-300",

      borderClass:
        "border-slate-800",

      panelClass:
        "bg-[#0b111c]",

      sideBarClass:
        "bg-slate-600/45",

      glowClass:
        "bg-slate-400/[0.015]",

      badgeClass:
        "border-slate-700 bg-slate-950/35 text-slate-400",
    };
  }

  return {
    label:
      "Runtime Unknown",

    supporting:
      "Current processor health could not be determined. Last-known runtime information remains visible where available.",

    dotClass:
      "bg-slate-600",

    labelClass:
      "text-slate-400",

    borderClass:
      "border-slate-800",

    panelClass:
      "bg-[#0b111c]",

    sideBarClass:
      "bg-slate-700/50",

    glowClass:
      "bg-slate-500/[0.015]",

    badgeClass:
      "border-slate-800 bg-slate-950/35 text-slate-500",
  };
}


// ============================================================
// Shared components
// ============================================================

interface RuntimeMetricProps {
  label: string;

  value: string;

  detail?: string;

  muted?: boolean;
}


function RuntimeMetric({
  label,
  value,
  detail,
  muted = false,
}: RuntimeMetricProps) {
  return (
    <div
      className={[
        "group",
        "rounded-xl",
        "border",
        "p-4",
        "transition-all",
        "duration-200",
        muted
          ? (
            "border-slate-800/80 "
            + "bg-[#0b1018]/65 "
            + "opacity-75 "
            + "hover:opacity-90"
          )
          : (
            "border-slate-700/55 "
            + "bg-[#0b111c] "
            + "hover:-translate-y-0.5 "
            + "hover:border-cyan-900/55 "
            + "hover:bg-[#121c2b]"
          ),
      ].join(" ")}
    >
      <p
        className="
          text-[9px]
          font-semibold
          uppercase
          tracking-[0.14em]
          text-slate-600
        "
      >
        {label}
      </p>

      <p
        className={[
          "mt-2",
          "font-mono",
          "text-sm",
          "font-medium",
          muted
            ? "text-slate-400"
            : "text-slate-100",
        ].join(" ")}
      >
        {value}
      </p>

      {detail && (
        <p
          className="
            mt-1.5
            text-[9px]
            leading-4
            text-slate-600
          "
        >
          {detail}
        </p>
      )}
    </div>
  );
}


interface CapabilityCardProps {
  code: string;

  tone:
    | "cyan"
    | "emerald"
    | "orange"
    | "indigo"
    | "violet";

  title: string;

  description: string;
}


function CapabilityCard({
  code,
  tone,
  title,
  description,
}: CapabilityCardProps) {
  const toneClasses = {
    cyan: {
      border:
        "group-hover:border-cyan-800/60",

      icon:
        "border-cyan-900/45 bg-cyan-950/20 text-cyan-300",

      line:
        "bg-cyan-400",
    },

    emerald: {
      border:
        "group-hover:border-emerald-800/55",

      icon:
        "border-emerald-900/45 bg-emerald-950/20 text-emerald-300",

      line:
        "bg-emerald-400",
    },

    orange: {
      border:
        "group-hover:border-orange-800/55",

      icon:
        "border-orange-900/45 bg-orange-950/20 text-orange-300",

      line:
        "bg-orange-400",
    },

    indigo: {
      border:
        "group-hover:border-indigo-800/55",

      icon:
        "border-indigo-900/45 bg-indigo-950/20 text-indigo-300",

      line:
        "bg-indigo-400",
    },

    violet: {
      border:
        "group-hover:border-violet-800/55",

      icon:
        "border-violet-900/45 bg-violet-950/20 text-violet-300",

      line:
        "bg-violet-400",
    },
  }[tone];


  return (
    <article
      className={[
        "group",
        "relative",
        "overflow-hidden",
        "rounded-2xl",
        "border",
        "border-slate-700/55",
        "bg-[#101826]/90",
        "p-5",
        "shadow-[0_12px_35px_rgba(0,0,0,0.12)]",
        "transition-all",
        "duration-300",
        "hover:-translate-y-1",
        "hover:bg-[#121c2b]",
        "hover:shadow-[0_18px_40px_rgba(0,0,0,0.16)]",
        toneClasses.border,
      ].join(" ")}
    >
      <span
        className={[
          "absolute",
          "bottom-4",
          "left-0",
          "top-4",
          "w-[2px]",
          "rounded-r-full",
          "opacity-55",
          "transition-all",
          "duration-300",
          "group-hover:opacity-100",
          toneClasses.line,
        ].join(" ")}
      />

      <div
        className={[
          "flex",
          "h-10",
          "w-10",
          "items-center",
          "justify-center",
          "rounded-xl",
          "border",
          "font-mono",
          "text-[10px]",
          "font-semibold",
          "transition-all",
          "duration-200",
          toneClasses.icon,
        ].join(" ")}
      >
        {code}
      </div>

      <h3
        className="
          mt-4
          text-sm
          font-semibold
          text-slate-200
          transition-colors
          group-hover:text-white
        "
      >
        {title}
      </h3>

      <p
        className="
          mt-2
          text-[11px]
          leading-5
          text-slate-500
        "
      >
        {description}
      </p>
    </article>
  );
}


interface PrincipleCardProps {
  code: string;

  title: string;

  description: string;
}


function PrincipleCard({
  code,
  title,
  description,
}: PrincipleCardProps) {
  return (
    <article
      className="
        group
        relative
        overflow-hidden
        rounded-xl
        border
        border-slate-700/50
        bg-[#0b111c]
        p-4
        transition-all
        duration-250
        hover:-translate-y-0.5
        hover:border-cyan-900/55
        hover:bg-[#121c2b]
      "
    >
      <span
        className="
          absolute
          bottom-0
          left-0
          top-0
          w-[2px]
          bg-cyan-500/25
          transition-all
          duration-300
          group-hover:bg-cyan-400/70
        "
      />

      <div
        className="
          flex
          items-start
          gap-3
        "
      >
        <span
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-lg
            border
            border-slate-800
            bg-[#0b111c]
            font-mono
            text-[9px]
            text-cyan-400
            transition
            group-hover:border-cyan-900/70
          "
        >
          {code}
        </span>

        <div>
          <h3
            className="
              text-xs
              font-semibold
              text-slate-300
              transition-colors
              group-hover:text-white
            "
          >
            {title}
          </h3>

          <p
            className="
              mt-1.5
              text-[10px]
              leading-5
              text-slate-500
            "
          >
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}


// ============================================================
// Page
// ============================================================

function ArchitecturePage() {
  const navigate =
    useNavigate();


  const [
    operations,
    setOperations,
  ] = useState<
    OperationsStatus
    | null
  >(
    null,
  );


  const [
    aiStatus,
    setAIStatus,
  ] = useState<
    AIServiceStatus
    | null
  >(
    null,
  );


  const [
    initialLoading,
    setInitialLoading,
  ] = useState(
    true,
  );


  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(
    false,
  );


  const [
    refreshWarning,
    setRefreshWarning,
  ] = useState<
    string
    | null
  >(
    null,
  );


  const [
    lastRefreshedAt,
    setLastRefreshedAt,
  ] = useState<
    number
    | null
  >(
    null,
  );


  const [
    nowMs,
    setNowMs,
  ] = useState(
    0,
  );


  // ==========================================================
  // Initial load
  // ==========================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadInitialArchitecture() {
        const [
          operationsResult,
          aiResult,
        ] =
          await Promise.allSettled([
            getOperationsStatus(),

            getAIServiceStatus(),
          ]);


        if (
          cancelled
        ) {
          return;
        }


        let loadedAnything =
          false;


        if (
          operationsResult.status
          === "fulfilled"
        ) {
          setOperations(
            operationsResult.value,
          );

          loadedAnything =
            true;
        }


        if (
          aiResult.status
          === "fulfilled"
        ) {
          setAIStatus(
            aiResult.value,
          );

          loadedAnything =
            true;
        }


        if (
          loadedAnything
        ) {
          setLastRefreshedAt(
            Date.now(),
          );

          setRefreshWarning(
            null,
          );
        } else {
          setRefreshWarning(
            "Architecture runtime telemetry is currently unavailable.",
          );
        }


        setInitialLoading(
          false,
        );
      }


      void loadInitialArchitecture();


      return () => {
        cancelled =
          true;
      };
    },
    [],
  );


  // ==========================================================
  // Silent 10-second refresh
  // ==========================================================

  const refreshSilently =
    useCallback(
      async () => {
        const [
          operationsResult,
          aiResult,
        ] =
          await Promise.allSettled([
            getOperationsStatus(),

            getAIServiceStatus(),
          ]);


        let refreshedAnything =
          false;


        if (
          operationsResult.status
          === "fulfilled"
        ) {
          setOperations(
            operationsResult.value,
          );

          refreshedAnything =
            true;
        }


        if (
          aiResult.status
          === "fulfilled"
        ) {
          setAIStatus(
            aiResult.value,
          );

          refreshedAnything =
            true;
        }


        if (
          refreshedAnything
        ) {
          setLastRefreshedAt(
            Date.now(),
          );

          setRefreshWarning(
            null,
          );
        } else {
          setRefreshWarning(
            "Live architecture telemetry could not be refreshed. Existing status remains visible.",
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      const interval =
        window.setInterval(
          () => {
            void refreshSilently();
          },
          AUTO_REFRESH_MS,
        );


      return () => {
        window.clearInterval(
          interval,
        );
      };
    },
    [
      refreshSilently,
    ],
  );


  // ==========================================================
  // Display clock
  // ==========================================================

  useEffect(
    () => {
      const interval =
        window.setInterval(
          () => {
            setNowMs(
              Date.now(),
            );
          },
          1_000,
        );


      return () => {
        window.clearInterval(
          interval,
        );
      };
    },
    [],
  );


  // ==========================================================
  // Manual refresh
  // ==========================================================

  async function refreshArchitecture() {
    if (
      isRefreshing
    ) {
      return;
    }


    setIsRefreshing(
      true,
    );


    try {
      await refreshSilently();
    } finally {
      setIsRefreshing(
        false,
      );
    }
  }


  // ==========================================================
  // Derived runtime state
  // ==========================================================

  const processor:
    ProcessorRuntimeStatus
    | null =
      operations?.sentinel
      ?? null;


  const runtimeVisual =
    useMemo(
      () =>
        getRuntimePresentation(
          processor?.health
          ?? "UNKNOWN",

          processor?.operational
          ?? false,
        ),
      [
        processor?.health,
        processor?.operational,
      ],
    );


  const aiConfigured =
    aiStatus?.enabled
    ?? false;


  const aiAvailable =
    aiStatus?.available
    ?? false;


  const aiOffline =
    !aiAvailable;


  // ==========================================================
  // Render
  // ==========================================================

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-[1600px]
        px-5
        pb-20
        pt-6
        sm:px-7
        lg:px-10
      "
    >
      {/* =====================================================
          HEADER
      ====================================================== */}
      <section
        className="
          flex
          flex-col
          gap-6
          xl:flex-row
          xl:items-end
          xl:justify-between
        "
      >
        <div
          className="
            min-w-0
            max-w-[980px]
          "
        >
          <div
            className="
              flex
              items-center
              gap-2.5
            "
          >
            <span
              className="
                h-2
                w-2
                rounded-full
                bg-cyan-400
                shadow-[0_0_14px_rgba(34,211,238,0.8)]
              "
            />

            <p
              className="
                text-[11px]
                font-semibold
                uppercase
                tracking-[0.22em]
                text-cyan-400
              "
            >
              Platform Architecture
            </p>
          </div>


          <h1
            className="
              mt-5
              text-3xl
              font-semibold
              tracking-[-0.035em]
              text-white
              sm:text-4xl
            "
          >
            SENTINEL Security Intelligence Platform
          </h1>


          <p
            className="
              mt-3
              max-w-[980px]
              text-sm
              leading-7
              text-slate-500
              sm:text-[15px]
            "
          >
            A modular security intelligence system that transforms
            enterprise telemetry into behavioral detections,
            correlated incidents and investigation-ready evidence.
          </p>
        </div>


        <div
          className="
            flex
            shrink-0
            flex-wrap
            items-center
            gap-2.5
          "
        >
          <div
            className="
              flex
              h-11
              items-center
              gap-2.5
              rounded-xl
              border
              border-slate-800
              bg-[#0a1019]/90
              px-4
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-emerald-400
                shadow-[0_0_9px_rgba(52,211,153,0.6)]
              "
            />

            <span
              className="
                whitespace-nowrap
                text-[11px]
                font-medium
                tabular-nums
                text-slate-500
              "
            >
              {
                formatRefreshAge(
                  lastRefreshedAt,
                  nowMs,
                )
              }
            </span>
          </div>


          <button
            type="button"
            disabled={
              isRefreshing
            }
            onClick={() => {
              void refreshArchitecture();
            }}
            className="
              group
              flex
              h-11
              items-center
              gap-2.5
              rounded-xl
              border
              border-slate-700
              bg-[#101722]
              px-4
              text-[11px]
              font-semibold
              text-slate-300
              shadow-[0_10px_30px_rgba(0,0,0,0.16)]
              transition-all
              duration-200
              hover:border-cyan-800/70
              hover:bg-cyan-950/20
              hover:text-cyan-200
              disabled:cursor-wait
              disabled:opacity-60
            "
          >
            <span
              className={[
                "inline-block",
                "text-sm",
                "transition-transform",
                "duration-300",
                isRefreshing
                  ? "animate-spin"
                  : "group-hover:rotate-180",
              ].join(" ")}
            >
              ↻
            </span>

            {isRefreshing
              ? "Refreshing"
              : "Refresh Architecture"}
          </button>
        </div>
      </section>


      {refreshWarning && (
        <div
          className="
            mt-5
            rounded-xl
            border
            border-amber-900/40
            bg-amber-950/10
            px-4
            py-3
            text-[11px]
            text-amber-300
          "
        >
          {refreshWarning}
        </div>
      )}


      {/* =====================================================
          INITIAL LOAD
      ====================================================== */}
      {initialLoading
        && operations === null
        && aiStatus === null ? (
        <section
          className="
            mt-7
            rounded-2xl
            border
            border-slate-700/55
            bg-[#101826]/90
            p-8
            shadow-[0_16px_45px_rgba(0,0,0,0.18)]
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <span
              className="
                h-2
                w-2
                animate-pulse
                rounded-full
                bg-cyan-400
              "
            />

            <p
              className="
                text-xs
                uppercase
                tracking-[0.14em]
                text-slate-500
              "
            >
              Loading platform architecture
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* =================================================
              SENTINEL CORE RUNTIME
          ================================================== */}
          <section
            className={[
              "group",
              "relative",
              "mt-7",
              "overflow-hidden",
              "rounded-2xl",
              "border",
              "p-6",
              "shadow-[0_16px_45px_rgba(0,0,0,0.14)]",
              "transition-all",
              "duration-300",
              "hover:shadow-[0_22px_60px_rgba(6,182,212,0.06)]",
              runtimeVisual.borderClass,
              runtimeVisual.panelClass,
            ].join(" ")}
          >
            {/* State side bar */}
            <span
              className={[
                "absolute",
                "bottom-5",
                "left-0",
                "top-5",
                "w-[3px]",
                "rounded-r-full",
                runtimeVisual.sideBarClass,
              ].join(" ")}
            />


            {/* Live background glow */}
            <div
              className={[
                "pointer-events-none",
                "absolute",
                "-right-28",
                "-top-32",
                "h-96",
                "w-96",
                "rounded-full",
                "blur-[110px]",
                runtimeVisual.glowClass,
                processor?.operational
                  ? "animate-pulse"
                  : "",
              ].join(" ")}
            />


            <div
              className="
                relative
              "
            >
              <div
                className="
                  flex
                  flex-col
                  gap-6
                  xl:flex-row
                  xl:items-start
                  xl:justify-between
                "
              >
                <div
                  className="
                    max-w-3xl
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-3
                    "
                  >
                    <span
                      className={[
                        "h-2.5",
                        "w-2.5",
                        "rounded-full",
                        processor?.operational
                          ? "animate-pulse"
                          : "",
                        runtimeVisual.dotClass,
                      ].join(" ")}
                    />

                    <p
                      className="
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.18em]
                        text-slate-400
                      "
                    >
                      SENTINEL Core Runtime
                    </p>
                  </div>


                  <h2
                    className={[
                      "mt-4",
                      "text-2xl",
                      "font-semibold",
                      "tracking-[-0.025em]",
                      runtimeVisual.labelClass,
                    ].join(" ")}
                  >
                    {runtimeVisual.label}
                  </h2>


                  <p
                    className="
                      mt-2
                      max-w-2xl
                      text-xs
                      leading-6
                      text-slate-400
                    "
                  >
                    {runtimeVisual.supporting}
                  </p>


                  <div
                    className="
                      mt-5
                    "
                  >
                    <span
                      className={[
                        "inline-flex",
                        "items-center",
                        "rounded-lg",
                        "border",
                        "px-3",
                        "py-1.5",
                        "text-[9px]",
                        "font-semibold",
                        "uppercase",
                        "tracking-[0.14em]",
                        runtimeVisual.badgeClass,
                      ].join(" ")}
                    >
                      {processor?.operational
                        ? "Live Processing"
                        : "Last Known Runtime"}
                    </span>
                  </div>
                </div>


                <div
                  className="
                    grid
                    min-w-0
                    gap-3
                    sm:grid-cols-2
                    xl:min-w-[430px]
                  "
                >
                  <RuntimeMetric
                    label="Processor"
                    value={
                      processor
                        ?.worker_id
                      ?? "Unavailable"
                    }
                    muted={
                      !processor
                        ?.operational
                    }
                  />

                  <RuntimeMetric
                    label="Runtime Version"
                    value={
                      processor
                        ?.worker_version
                      ?? "—"
                    }
                    muted={
                      !processor
                        ?.operational
                    }
                  />

                  <RuntimeMetric
                    label="Last Heartbeat"
                    value={
                      formatRelativeTime(
                        processor
                          ?.last_heartbeat_at,
                        nowMs,
                      )
                    }
                    muted={
                      !processor
                        ?.operational
                    }
                  />

                  <RuntimeMetric
                    label={
                      processor?.operational
                        ? "Activated"
                        : "Last Stop"
                    }
                    value={
                      formatDateTime(
                        processor
                          ?.operational
                          ? processor
                              ?.activated_at
                          : processor
                              ?.stopped_at,
                      )
                    }
                    muted={
                      !processor
                        ?.operational
                    }
                  />
                </div>
              </div>


              <div
                className="
                  mt-7
                  grid
                  gap-3
                  sm:grid-cols-2
                  xl:grid-cols-5
                "
              >
                <RuntimeMetric
                  label="Events Processed"
                  value={
                    formatCount(
                      processor
                        ?.counters
                        .events_processed,
                    )
                  }
                  detail="Operational events handled by this processor lineage."
                  muted={
                    !processor
                      ?.operational
                  }
                />

                <RuntimeMetric
                  label="Scores Created"
                  value={
                    formatCount(
                      processor
                        ?.counters
                        .scores_created,
                    )
                  }
                  detail="Behavioral anomaly scores produced by processing."
                  muted={
                    !processor
                      ?.operational
                  }
                />

                <RuntimeMetric
                  label="Incidents Created"
                  value={
                    formatCount(
                      processor
                        ?.counters
                        .incidents_created,
                    )
                  }
                  muted={
                    !processor
                      ?.operational
                  }
                />

                <RuntimeMetric
                  label="Incidents Updated"
                  value={
                    formatCount(
                      processor
                        ?.counters
                        .incidents_updated,
                    )
                  }
                  muted={
                    !processor
                      ?.operational
                  }
                />

                <RuntimeMetric
                  label="Live Backlog"
                  value={
                    formatCount(
                      processor
                        ?.counters
                        .live_backlog,
                    )
                  }
                  detail="Eligible events awaiting operational processing."
                  muted={
                    !processor
                      ?.operational
                  }
                />
              </div>


              {!processor?.operational
                && processor
                  ?.last_heartbeat_at && (
                <div
                  className="
                    mt-5
                    flex
                    flex-col
                    gap-2
                    rounded-xl
                    border
                    border-slate-700/50
                    bg-[#0a0f16]/60
                    px-4
                    py-3
                    text-[10px]
                    text-slate-500
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <span>
                    Persisted runtime history remains visible while
                    operational processing is offline.
                  </span>

                  <span
                    className="
                      shrink-0
                      font-mono
                      text-slate-400
                    "
                  >
                    Last heartbeat{" "}
                    {
                      formatRelativeTime(
                        processor
                          .last_heartbeat_at,
                        nowMs,
                      )
                    }
                  </span>
                </div>
              )}
            </div>
          </section>


          {/* =================================================
              ARCHITECTURE FLOW
          ================================================== */}
          <section
            className="
              relative
              mt-4
              overflow-hidden
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-6
              shadow-[0_16px_45px_rgba(0,0,0,0.14)]
              sm:p-7
            "
          >
            <span
              className="
                absolute
                bottom-7
                left-0
                top-7
                w-[2px]
                rounded-r-full
                bg-gradient-to-b
                from-cyan-300
                via-cyan-500
                to-indigo-600
                opacity-70
              "
            />


            <div
              className="
                flex
                flex-col
                gap-5
                lg:flex-row
                lg:items-end
                lg:justify-between
              "
            >
              <div
                className="
                  max-w-3xl
                "
              >
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.18em]
                    text-cyan-400
                  "
                >
                  Intelligence Architecture
                </p>

                <h2
                  className="
                    mt-2
                    text-xl
                    font-semibold
                    text-white
                  "
                >
                  How SENTINEL turns telemetry into investigation
                </h2>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-6
                    text-slate-400
                  "
                >
                  SENTINEL separates event persistence, operational
                  processing, behavioral detection, deterministic
                  correlation and analyst investigation into clear
                  responsibilities.
                </p>
              </div>


              <button
                type="button"
                onClick={() => {
                  navigate(
                    "/model",
                  );
                }}
                className="
                  group
                  flex
                  w-fit
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-cyan-800/50
                  bg-cyan-950/20
                  px-4
                  py-2.5
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.12em]
                  text-cyan-300
                  transition-all
                  duration-200
                  hover:-translate-y-0.5
                  hover:border-cyan-600/70
                  hover:bg-cyan-950/35
                  hover:text-cyan-200
                "
              >
                View Model Intelligence

                <span
                  className="
                    transition-transform
                    duration-200
                    group-hover:translate-x-1
                  "
                >
                  →
                </span>
              </button>
            </div>


            <div
              className="
                relative
                mt-7
              "
            >
              <div
                className="
                  pointer-events-none
                  absolute
                  left-[6%]
                  right-[6%]
                  top-[48px]
                  hidden
                  h-px
                  bg-gradient-to-r
                  from-cyan-900/20
                  via-cyan-500/55
                  to-indigo-900/20
                  xl:block
                "
              />


              <div
                className="
                  relative
                  grid
                  gap-3
                  md:grid-cols-2
                  xl:grid-cols-7
                "
              >
                {ARCHITECTURE_STAGES.map(
                  (
                    stage,
                    index,
                  ) => (
                    <article
                      key={
                        stage.code
                      }
                      className="
                        group
                        relative
                        min-h-[215px]
                        rounded-2xl
                        border
                        border-slate-800
                        bg-[#0b111c]
                        p-4
                        shadow-[0_10px_28px_rgba(0,0,0,0.16)]
                        transition-all
                        duration-300
                        hover:-translate-y-1.5
                        hover:border-cyan-800/55
                        hover:bg-[#0e1724]
                        hover:shadow-[0_20px_45px_rgba(0,0,0,0.25),0_0_24px_rgba(34,211,238,0.035)]
                      "
                    >
                      <span
                        className="
                          absolute
                          bottom-4
                          left-0
                          top-4
                          w-[2px]
                          rounded-r-full
                          bg-cyan-500/20
                          transition-all
                          duration-300
                          group-hover:bg-cyan-400/80
                        "
                      />


                      <div
                        className="
                          relative
                          z-10
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-full
                          border
                          border-cyan-800/60
                          bg-cyan-950/35
                          font-mono
                          text-[10px]
                          font-semibold
                          text-cyan-300
                          shadow-[0_0_18px_rgba(34,211,238,0.06)]
                          transition-all
                          duration-200
                          group-hover:border-cyan-600/70
                          group-hover:bg-cyan-950/55
                          group-hover:shadow-[0_0_24px_rgba(34,211,238,0.1)]
                        "
                      >
                        {stage.code}
                      </div>


                      <p
                        className="
                          mt-5
                          text-[9px]
                          font-semibold
                          uppercase
                          tracking-[0.14em]
                          text-slate-600
                        "
                      >
                        {stage.eyebrow}
                      </p>


                      <h3
                        className="
                          mt-2
                          text-xs
                          font-semibold
                          text-slate-200
                          transition-colors
                          group-hover:text-white
                        "
                      >
                        {stage.title}
                      </h3>


                      <p
                        className="
                          mt-2
                          text-[10px]
                          leading-5
                          text-slate-500
                        "
                      >
                        {stage.description}
                      </p>


                      {index
                        < ARCHITECTURE_STAGES.length - 1
                        && (
                          <span
                            className="
                              absolute
                              -right-[9px]
                              top-[41px]
                              z-20
                              hidden
                              h-4
                              w-4
                              items-center
                              justify-center
                              rounded-full
                              border
                              border-cyan-800/60
                              bg-[#101826]
                              text-[8px]
                              text-cyan-400
                              shadow-[0_0_12px_rgba(34,211,238,0.1)]
                              xl:flex
                            "
                          >
                            ›
                          </span>
                        )}
                    </article>
                  ),
                )}
              </div>
            </div>


            {/* Optional AI branch */}
            <div
              className="
                relative
                mt-5
                overflow-hidden
                rounded-2xl
                border
                border-dashed
                border-indigo-800/45
                bg-gradient-to-r
                from-indigo-950/20
                via-[#101826]
                to-[#101826]
                p-5
              "
            >
              <span
                className="
                  absolute
                  bottom-3
                  left-0
                  top-3
                  w-[2px]
                  rounded-r-full
                  bg-indigo-400/60
                "
              />

              <div
                className="
                  flex
                  flex-col
                  gap-4
                  lg:flex-row
                  lg:items-center
                  lg:justify-between
                "
              >
                <div
                  className="
                    flex
                    max-w-3xl
                    items-start
                    gap-4
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-indigo-800/50
                      bg-indigo-950/30
                      font-mono
                      text-[9px]
                      font-semibold
                      text-indigo-300
                    "
                  >
                    AI
                  </div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-[0.15em]
                        text-indigo-300
                      "
                    >
                      Optional Assistive Branch
                    </p>

                    <p
                      className="
                        mt-1.5
                        text-xs
                        font-medium
                        text-slate-200
                      "
                    >
                      Local AI augments investigation after deterministic
                      SENTINEL evidence already exists.
                    </p>

                    <p
                      className="
                        mt-1.5
                        text-[10px]
                        leading-5
                        text-slate-500
                      "
                    >
                      It does not generate anomaly scores, decide that an
                      attack occurred, or control incident correlation.
                    </p>
                  </div>
                </div>


                <div
                  className="
                    shrink-0
                    rounded-lg
                    border
                    border-indigo-900/45
                    bg-indigo-950/20
                    px-3
                    py-2
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-indigo-300
                  "
                >
                  Evidence-grounded assistance
                </div>
              </div>
            </div>
          </section>


          {/* =================================================
              CAPABILITIES
          ================================================== */}
          <section
            className="
              mt-4
            "
          >
            <div
              className="
                max-w-3xl
              "
            >
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-cyan-400
                "
              >
                Platform Components
              </p>

              <h2
                className="
                  mt-2
                  text-xl
                  font-semibold
                  text-white
                "
              >
                Core security intelligence capabilities
              </h2>

              <p
                className="
                  mt-2
                  text-xs
                  leading-6
                  text-slate-500
                "
              >
                Each layer has a focused responsibility while sharing
                persistent operational evidence across the platform.
              </p>
            </div>


            <div
              className="
                mt-5
                grid
                gap-4
                md:grid-cols-2
                xl:grid-cols-3
              "
            >
              {CORE_CAPABILITIES.map(
                (
                  capability,
                ) => (
                  <CapabilityCard
                    key={
                      capability.code
                    }
                    code={
                      capability.code
                    }
                    tone={
                      capability.tone
                    }
                    title={
                      capability.title
                    }
                    description={
                      capability.description
                    }
                  />
                ),
              )}
            </div>
          </section>


          {/* =================================================
              LOCAL AI
          ================================================== */}
          <section
            className={[
              "group",
              "relative",
              "mt-5",
              "overflow-hidden",
              "rounded-2xl",
              "border",
              "p-6",
              "shadow-[0_16px_45px_rgba(0,0,0,0.14)]",
              "transition-all",
              "duration-300",
              "sm:p-7",
              aiAvailable
                ? (
                  "border-emerald-900/55 "
                  + "bg-[#101826]/90"
                )
                : aiConfigured
                  ? (
                    "border-amber-900/45 "
                    + "bg-[#101826]/90"
                  )
                  : (
                    "border-slate-800 "
                    + "bg-gradient-to-br "
                    + "from-[#111720] "
                    + "to-[#0d131c]"
                  ),
            ].join(" ")}
          >
            {/* Accent rail */}
            <span
              className={[
                "absolute",
                "bottom-5",
                "left-0",
                "top-5",
                "w-[3px]",
                "rounded-r-full",
                aiAvailable
                  ? (
                    "bg-gradient-to-b "
                    + "from-emerald-300 "
                    + "via-emerald-500 "
                    + "to-indigo-500"
                  )
                  : aiConfigured
                    ? (
                      "bg-gradient-to-b "
                      + "from-amber-300 "
                      + "to-amber-700"
                    )
                    : "bg-slate-700",
              ].join(" ")}
            />


            {/* State glow */}
            <div
              className={[
                "pointer-events-none",
                "absolute",
                "-right-28",
                "-top-28",
                "h-96",
                "w-96",
                "rounded-full",
                "blur-[110px]",
                aiAvailable
                  ? (
                    "animate-pulse "
                    + "bg-emerald-400/[0.035]"
                  )
                  : aiConfigured
                    ? "bg-amber-400/[0.02]"
                    : "bg-slate-500/[0.02]",
              ].join(" ")}
            />


            <div
              className="
                relative
                grid
                gap-7
                xl:grid-cols-[1.15fr_0.85fr]
              "
            >
              <div>
                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >
                  <span
                    className={[
                      "h-2.5",
                      "w-2.5",
                      "rounded-full",
                      aiAvailable
                        ? (
                          "animate-pulse "
                          + "bg-emerald-400 "
                          + "shadow-[0_0_16px_rgba(52,211,153,0.85)]"
                        )
                        : aiConfigured
                          ? (
                            "bg-amber-400 "
                            + "shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                          )
                          : "bg-slate-600",
                    ].join(" ")}
                  />

                  <p
                    className={[
                      "text-[10px]",
                      "font-semibold",
                      "uppercase",
                      "tracking-[0.18em]",
                      aiAvailable
                        ? "text-emerald-300"
                        : aiConfigured
                          ? "text-amber-300"
                          : "text-slate-500",
                    ].join(" ")}
                  >
                    Optional Local Intelligence
                  </p>
                </div>


                <h2
                  className={[
                    "mt-4",
                    "text-2xl",
                    "font-semibold",
                    aiAvailable
                      ? "text-white"
                      : aiConfigured
                        ? "text-slate-300"
                        : "text-slate-400",
                  ].join(" ")}
                >
                  {aiAvailable
                    ? "Local AI Available"
                    : aiConfigured
                      ? "Local AI Unavailable"
                      : "Local AI Disabled"}
                </h2>


                <p
                  className={[
                    "mt-3",
                    "max-w-2xl",
                    "text-xs",
                    "leading-6",
                    aiOffline
                      ? "text-slate-600"
                      : "text-slate-400",
                  ].join(" ")}
                >
                  SENTINEL&apos;s AI layer is deliberately optional.
                  The deterministic security pipeline remains functional
                  when the local model provider is unavailable.
                  AI interprets already-established incident evidence
                  and supports analyst reasoning.
                </p>


                <div
                  className={[
                    "mt-5",
                    "rounded-xl",
                    "border",
                    "px-4",
                    "py-3",
                    aiAvailable
                      ? (
                        "border-emerald-900/35 "
                        + "bg-emerald-950/15"
                      )
                      : aiConfigured
                        ? (
                          "border-amber-900/35 "
                          + "bg-amber-950/10"
                        )
                        : (
                          "border-slate-800 "
                          + "bg-slate-950/25"
                        ),
                  ].join(" ")}
                >
                  <p
                    className={[
                      "text-[10px]",
                      "leading-5",
                      aiAvailable
                        ? "text-emerald-200/65"
                        : "text-slate-600",
                    ].join(" ")}
                  >
                    {aiStatus
                      ?.message
                      ?? (
                        "Local AI status has not been resolved yet."
                      )}
                  </p>
                </div>


                <div
                  className="
                    mt-5
                    flex
                    flex-wrap
                    gap-2
                  "
                >
                  <span
                    className="
                      rounded-lg
                      border
                      border-indigo-900/45
                      bg-indigo-950/20
                      px-3
                      py-1.5
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.12em]
                      text-indigo-300
                    "
                  >
                    Optional
                  </span>

                  <span
                    className="
                      rounded-lg
                      border
                      border-slate-800
                      bg-slate-950/25
                      px-3
                      py-1.5
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.12em]
                      text-slate-400
                    "
                  >
                    Local Inference
                  </span>

                  <span
                    className="
                      rounded-lg
                      border
                      border-slate-800
                      bg-slate-950/25
                      px-3
                      py-1.5
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-[0.12em]
                      text-slate-400
                    "
                  >
                    Evidence Grounded
                  </span>
                </div>
              </div>


              <div
                className="
                  grid
                  gap-3
                  sm:grid-cols-2
                "
              >
                <RuntimeMetric
                  label="Configuration"
                  value={
                    aiConfigured
                      ? "Enabled"
                      : "Disabled"
                  }
                  muted={
                    aiOffline
                  }
                />

                <RuntimeMetric
                  label="Availability"
                  value={
                    aiAvailable
                      ? "Available"
                      : "Unavailable"
                  }
                  muted={
                    aiOffline
                  }
                />

                <RuntimeMetric
                  label="Provider"
                  value={
                    aiStatus
                      ?.provider
                      ? (
                        aiStatus
                          .provider
                          .charAt(0)
                          .toUpperCase()
                        + aiStatus
                          .provider
                          .slice(1)
                      )
                      : "Ollama"
                  }
                  muted={
                    aiOffline
                  }
                />

                <RuntimeMetric
                  label="Configured Model"
                  value={
                    aiStatus
                      ?.model
                    ?? "—"
                  }
                  muted={
                    aiOffline
                  }
                />

                <RuntimeMetric
                  label="Inference"
                  value="Host-local"
                  detail="Runs outside SENTINEL's deterministic detection path."
                  muted={
                    aiOffline
                  }
                />

                <RuntimeMetric
                  label="Role"
                  value="Analyst assistance"
                  detail="Interprets established incident evidence."
                  muted={
                    aiOffline
                  }
                />
              </div>
            </div>
          </section>


          {/* =================================================
              DESIGN PRINCIPLES
          ================================================== */}
          <section
            className="
              relative
              mt-4
              overflow-hidden
              rounded-2xl
              border
              border-slate-700/55
              bg-[#101826]/90
              p-6
              shadow-[0_16px_45px_rgba(0,0,0,0.14)]
              sm:p-7
            "
          >
            <span
              className="
                absolute
                bottom-7
                left-0
                top-7
                w-[2px]
                rounded-r-full
                bg-gradient-to-b
                from-cyan-400
                to-indigo-500
                opacity-60
              "
            />

            <div
              className="
                max-w-3xl
              "
            >
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-cyan-400
                "
              >
                Engineering Principles
              </p>

              <h2
                className="
                  mt-2
                  text-xl
                  font-semibold
                  text-white
                "
              >
                Built around explicit operational boundaries
              </h2>

              <p
                className="
                  mt-2
                  text-xs
                  leading-6
                  text-slate-500
                "
              >
                SENTINEL keeps critical security decisions deterministic,
                observable and independent from optional assistive systems.
              </p>
            </div>


            <div
              className="
                mt-5
                grid
                gap-3
                md:grid-cols-2
                xl:grid-cols-5
              "
            >
              {DESIGN_PRINCIPLES.map(
                (
                  principle,
                ) => (
                  <PrincipleCard
                    key={
                      principle.code
                    }
                    code={
                      principle.code
                    }
                    title={
                      principle.title
                    }
                    description={
                      principle.description
                    }
                  />
                ),
              )}
            </div>
          </section>


          {/* =================================================
              PRODUCT FOOTER
          ================================================== */}
          <section
            className="
              relative
              mt-4
              overflow-hidden
              rounded-2xl
              border
              border-cyan-900/35
              bg-gradient-to-r
              from-cyan-950/20
              via-[#101826]
              to-indigo-950/15
              p-6
              shadow-[0_14px_40px_rgba(0,0,0,0.14)]
            "
          >
            <span
              className="
                absolute
                bottom-4
                left-0
                top-4
                w-[2px]
                rounded-r-full
                bg-cyan-400/70
              "
            />

            <div
              className="
                flex
                flex-col
                gap-4
                lg:flex-row
                lg:items-center
                lg:justify-between
              "
            >
              <div
                className="
                  max-w-3xl
                "
              >
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-cyan-400
                  "
                >
                  SENTINEL
                </p>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-6
                    text-slate-400
                  "
                >
                  Behavioral anomaly detection, deterministic
                  incident correlation, identity-aware investigation
                  and optional local AI assistance integrated into
                  one security intelligence workspace.
                </p>
              </div>


              <div
                className="
                  flex
                  shrink-0
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <span
                  className="
                    rounded-lg
                    border
                    border-cyan-900/45
                    bg-cyan-950/20
                    px-3
                    py-2
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-cyan-300
                  "
                >
                  Deterministic Core
                </span>

                <span
                  className="
                    rounded-lg
                    border
                    border-emerald-900/40
                    bg-emerald-950/15
                    px-3
                    py-2
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-emerald-300
                  "
                >
                  Persistent Runtime
                </span>

                <span
                  className="
                    rounded-lg
                    border
                    border-indigo-900/45
                    bg-indigo-950/20
                    px-3
                    py-2
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-indigo-300
                  "
                >
                  Optional Local AI
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      <footer
        className="
          mt-6
          border-t
          border-slate-800/70
          py-5
          text-[11px]
          leading-5
          text-slate-600
        "
      >
        SENTINEL architecture views describe the
        platform&apos;s operational components,
        processing boundaries and investigation flow.
        Detector performance details remain available
        in Model Intelligence, while optional services
        do not determine core detection outcomes.
      </footer>
    </main>
  );
}


export default ArchitecturePage;