interface OverviewRefreshControlsProps {
  isRefreshing: boolean;

  isBackgroundRefreshing:
    boolean;

  lastRefreshedAt:
    number | null;

  refreshAgeSeconds:
    number;

  onRefresh:
    () => void;
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


function OverviewRefreshControls({
  isRefreshing,
  isBackgroundRefreshing,
  lastRefreshedAt,
  refreshAgeSeconds,
  onRefresh,
}: OverviewRefreshControlsProps) {
  return (
    <div
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
        className="
          rounded-xl
          border
          border-emerald-900/40
          bg-emerald-950/15
          px-3.5 py-2.5
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <span
            className="
              h-2 w-2
              rounded-full
              bg-emerald-400
              shadow-[0_0_10px_rgba(52,211,153,0.7)]
            "
          />

          <span
            className="
              text-[10px]
              font-semibold
              tracking-[0.1em]
              text-emerald-300
            "
          >
            SYSTEM OPERATIONAL
          </span>
        </div>
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
          className={[
            "h-1.5 w-1.5",
            "rounded-full",

            isBackgroundRefreshing
              ? (
                  "animate-pulse "
                  + "bg-cyan-300"
                )
              : "bg-cyan-500",
          ].join(
            " ",
          )}
        />

        <span
          className="
            text-[10px]
            font-medium
            text-slate-500
          "
        >
          {isBackgroundRefreshing
            ? "Updating intelligence…"
            : formatRefreshLabel(
                refreshAgeSeconds,
                lastRefreshedAt,
              )}
        </span>
      </div>


      {/* Manual refresh */}
      <button
        type="button"
        disabled={
          isRefreshing
          || isBackgroundRefreshing
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