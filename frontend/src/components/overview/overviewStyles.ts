import type {
  IncidentSeverity,
} from "../../types/api";


interface SeverityStyle {
  badge: string;
  dot: string;
  bar: string;
}


export const OVERVIEW_SEVERITY_STYLES:
  Record<
    IncidentSeverity,
    SeverityStyle
  > = {
    CRITICAL: {
      badge:
        "border-red-800/70 bg-red-950/45 text-red-300",

      dot:
        "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]",

      bar:
        "bg-red-500",
    },

    HIGH: {
      badge:
        "border-orange-800/70 bg-orange-950/35 text-orange-300",

      dot:
        "bg-orange-400",

      bar:
        "bg-orange-500",
    },

    MEDIUM: {
      badge:
        "border-amber-800/60 bg-amber-950/30 text-amber-300",

      dot:
        "bg-amber-400",

      bar:
        "bg-amber-500",
    },
  };


export function formatOverviewNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
  ).format(
    value,
  );
}


export function formatOverviewPercent(
  value: number,
  decimals = 1,
): string {
  return `${(
    value * 100
  ).toFixed(
    decimals,
  )}%`;
}


export function formatOverviewIncidentType(
  value: string,
): string {
  return value
    .split(
      "_",
    )
    .map(
      (word) =>
        word.charAt(
          0,
        )
        + word
          .slice(
            1,
          )
          .toLowerCase(),
    )
    .join(
      " ",
    );
}


export function formatOverviewTimestamp(
  timestamp: string,
): string {
  return new Date(
    timestamp,
  ).toLocaleString(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  );
}