import type {
  ProcessorRuntimeStatus,
  RuntimeHealthState,
} from "../../types/api";


interface OverviewRefreshControlsProps {
  isRefreshing: boolean;

  isBackgroundRefreshing:
    boolean;

  lastRefreshedAt:
    number | null;

  refreshAgeSeconds:
    number;

  processorStatus:
    ProcessorRuntimeStatus
    | null;

  currentTimeMs:
    number;

  onRefresh:
    () => void;
}


interface SystemPresentation {
  label: string;

  dotClass: string;

  textClass: string;

  borderClass: string;

  backgroundClass: string;
}


function formatRefreshLabel(
  ageSeconds: number,
  refreshedAt: number | null,
): string {
  if (
    refreshedAt === null
  ) {
    return "Waiting for refresh";
  }

  if (
    ageSeconds < 5
  ) {
    return "Refreshed just now";
  }

  if (
    ageSeconds < 60
  ) {
    return `Refreshed ${ageSeconds}s ago`;
  }

  if (
    ageSeconds < 3600
  ) {
    const minutes =
      Math.floor(
        ageSeconds / 60,
      );

    return `Refreshed ${minutes} ${
      minutes === 1
        ? "min"
        : "mins"
    } ago`;
  }

  const time =
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
    );

  return `Last refreshed at ${time}`;
}


function formatHeartbeatLabel(
  heartbeatAt:
    string | null,
  currentTimeMs: number,
): string {
  if (
    heartbeatAt === null
  ) {
    return "Last heartbeat unavailable";
  }

  const heartbeatTime =
    new Date(
      heartbeatAt,
    ).getTime();

  if (
    Number.isNaN(
      heartbeatTime,
    )
  ) {
    return "Last heartbeat unavailable";
  }

  if (
    currentTimeMs <= 0
  ) {
    return "Last heartbeat available";
  }

  const ageSeconds =
    Math.max(
      0,
      Math.floor(
        (
          currentTimeMs
          - heartbeatTime
        ) / 1000,
      ),
    );

  if (
    ageSeconds < 5
  ) {
    return "Last heartbeat just now";
  }

  if (
    ageSeconds < 60
  ) {
    return `Last heartbeat ${ageSeconds}s ago`;
  }

  if (
    ageSeconds < 3600
  ) {
    const minutes =
      Math.floor(
        ageSeconds / 60,
      );

    return `Last heartbeat ${minutes} ${
      minutes === 1
        ? "min"
        : "mins"
    } ago`;
  }

  const time =
    new Date(
      heartbeatAt,
    ).toLocaleTimeString(
      undefined,
      {
        hour:
          "numeric",

        minute:
          "2-digit",
      },
    );

  return `Last heartbeat at ${time}`;
}


function getSystemPresentation(
  health:
    RuntimeHealthState,
  operational: boolean,
): SystemPresentation {
  if (
    health === "HEALTHY"
    && operational
  ) {
    return {
      label:
        "SYSTEM OPERATIONAL",

      dotClass:
        "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]",

      textClass:
        "text-emerald-300",

      borderClass:
        "border-emerald-900/40",

      backgroundClass:
        "bg-emerald-950/15",
    };
  }

  if (
    health === "ERROR"
  ) {
    return {
      label:
        "SYSTEM ERROR",

      dotClass:
        "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.7)]",

      textClass:
        "text-rose-300",

      borderClass:
        "border-rose-900/40",

      backgroundClass:
        "bg-rose-950/15",
    };
  }

  if (
    health === "STALE"
  ) {
    return {
      label:
        "SYSTEM STALE",

      dotClass:
        "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]",

      textClass:
        "text-amber-300",

      borderClass:
        "border-amber-900/40",

      backgroundClass:
        "bg-amber-950/15",
    };
  }

  if (
    health === "STOPPED"
  ) {
    return {
      label:
        "SYSTEM STOPPED",

      dotClass:
        "bg-slate-500",

      textClass:
        "text-slate-300",

      borderClass:
        "border-slate-700/70",

      backgroundClass:
        "bg-slate-950/40",
    };
  }

  return {
    label:
      "STATUS UNKNOWN",

    dotClass:
      "bg-slate-600",

    textClass:
      "text-slate-400",

    borderClass:
      "border-slate-800",

    backgroundClass:
      "bg-slate-950/40",
  };
}


function OverviewRefreshControls({
  isRefreshing,
  isBackgroundRefreshing,
  lastRefreshedAt,
  refreshAgeSeconds,
  processorStatus,
  currentTimeMs,
  onRefresh,
}: OverviewRefreshControlsProps) {
  const presentation =
    getSystemPresentation(
      processorStatus?.health
      ?? "UNKNOWN",

      processorStatus?.operational
      ?? false,
    );

  const showHeartbeat =
    processorStatus !== null
    && !processorStatus.operational;


  return (
    <div
      aria-busy={
        isBackgroundRefreshing
      }
      className="
        flex
        flex-wrap
        items-center
        gap-2
        lg:justify-end
      "
    >
      {/* System health */}
      <div
        className={[
          "rounded-xl",
          "border",
          "px-3.5 py-2.5",
          presentation.borderClass,
          presentation.backgroundClass,
        ].join(
          " ",
        )}
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <span
            className={[
              "h-2 w-2",
              "rounded-full",
              processorStatus
                ?.operational
                ? "animate-pulse"
                : "",
              presentation.dotClass,
            ].join(
              " ",
            )}
          />

          <span
            className={[
              "text-[10px]",
              "font-semibold",
              "tracking-[0.1em]",
              presentation.textClass,
            ].join(
              " ",
            )}
          >
            {presentation.label}
          </span>
        </div>

        {showHeartbeat && (
          <p
            className="
              mt-1.5
              text-[9px]
              font-medium
              text-slate-600
            "
          >
            {
              formatHeartbeatLabel(
                processorStatus
                  .last_heartbeat_at,
                currentTimeMs,
              )
            }
          </p>
        )}
      </div>


      {/* Refresh age */}
      <div
        className="
          flex
          items-center
          gap-2
          rounded-xl
          border
          border-slate-800
          bg-[#0b111c]
          px-3.5 py-2.5
        "
      >
        <span
          className="
            h-1.5 w-1.5
            rounded-full
            bg-cyan-500
          "
        />

        <span
          className="
            whitespace-nowrap
            text-[10px]
            font-medium
            tabular-nums
            text-slate-500
          "
        >
          {
            formatRefreshLabel(
              refreshAgeSeconds,
              lastRefreshedAt,
            )
          }
        </span>
      </div>


      {/* Manual refresh */}
      <button
        type="button"
        disabled={
          isRefreshing
        }
        onClick={
          onRefresh
        }
        className="
          rounded-xl
          border
          border-slate-700/70
          bg-[#121a28]
          px-4 py-2.5
          text-xs
          font-medium
          text-slate-300
          shadow-lg
          transition-all
          duration-200
          hover:-translate-y-0.5
          hover:border-cyan-800/70
          hover:bg-cyan-950/20
          hover:text-cyan-300
          disabled:cursor-wait
          disabled:opacity-60
        "
      >
        {isRefreshing
          ? "Refreshing..."
          : "Refresh Intelligence"}
      </button>
    </div>
  );
}


export default OverviewRefreshControls;
