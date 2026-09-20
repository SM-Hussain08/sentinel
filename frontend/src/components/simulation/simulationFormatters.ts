export function formatRuntimeDuration(
  seconds:
    | number
    | null
    | undefined,
): string {
  if (
    seconds === null
    || seconds === undefined
  ) {
    return "—";
  }

  const totalSeconds =
    Math.max(
      0,
      Math.round(
        seconds,
      ),
    );

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (
        totalSeconds % 3600
      ) / 60,
    );

  const remainingSeconds =
    totalSeconds % 60;

  if (hours > 0) {
    return (
      `${hours}h `
      + `${minutes}m`
    );
  }

  return (
    `${minutes}m `
    + `${remainingSeconds}s`
  );
}


export function formatSimulatedDuration(
  seconds:
    | number
    | null
    | undefined,
): string {
  if (
    seconds === null
    || seconds === undefined
  ) {
    return "—";
  }

  const totalMinutes =
    Math.round(
      seconds / 60,
    );

  const hours =
    Math.floor(
      totalMinutes / 60,
    );

  const minutes =
    totalMinutes % 60;

  if (hours > 0) {
    return (
      `${hours}h `
      + `${minutes}m`
    );
  }

  return `${minutes} min`;
}


export function formatRate(
  value:
    | number
    | null
    | undefined,
): string {
  if (
    value === null
    || value === undefined
  ) {
    return "—";
  }

  return value.toFixed(2);
}


export function formatSpeed(
  value:
    | number
    | null
    | undefined,
): string {
  if (
    value === null
    || value === undefined
  ) {
    return "—";
  }

  return `${value.toFixed(
    value % 1 === 0
      ? 0
      : 1,
  )}×`;
}


export function formatCount(
  value:
    | number
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


export function formatPreset(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "—";
  }

  return (
    value.charAt(0).toUpperCase()
    + value
      .slice(1)
      .toLowerCase()
  );
}


export function formatHeartbeatAge(
  heartbeat:
    | string
    | null
    | undefined,
  nowMs: number,
): string {
  if (!heartbeat) {
    return "Unknown";
  }

  const timestamp =
    new Date(
      heartbeat,
    ).getTime();

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return "Unknown";
  }

  const seconds =
    Math.max(
      0,
      Math.floor(
        (
          nowMs
          - timestamp
        ) / 1000,
      ),
    );

  if (seconds < 2) {
    return "Just now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes =
    Math.floor(
      seconds / 60,
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  return `${hours}h ago`;
}


export function formatRefreshAge(
  refreshedAt:
    | number
    | null,
  nowMs: number,
): string {
  if (
    refreshedAt === null
  ) {
    return "Not refreshed";
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

  if (seconds < 2) {
    return "Refreshed just now";
  }

  return (
    `Refreshed ${seconds}s ago`
  );
}


export function formatTimestamp(
  value:
    | string
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
    [],
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}