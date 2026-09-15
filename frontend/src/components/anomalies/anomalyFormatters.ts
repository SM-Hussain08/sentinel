import type {
  MLEventAnalysis,
} from "../../types/api";


export function formatAnomalyNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
  ).format(
    value,
  );
}


export function formatAnomalyPercent(
  value: number,
  decimals = 1,
): string {
  return `${(
    value * 100
  ).toFixed(
    decimals,
  )}%`;
}


export function formatAnomalyTimestamp(
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

      second:
        "2-digit",
    },
  );
}


export function formatAnomalyEventType(
  eventType: string,
): string {
  return eventType
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


export function getAnomalyNumberFeature(
  analysis:
    MLEventAnalysis,

  feature:
    string,
): number | null {
  const value =
    analysis
      .feature_snapshot[
        feature
      ];

  return typeof value
    === "number"
    ? value
    : null;
}