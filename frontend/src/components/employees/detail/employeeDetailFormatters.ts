import type {
  EmployeeRiskLevel,
} from "../../../types/api";


export function formatDetailNumber(
  value: number,
): string {
  return new Intl.NumberFormat().format(
    value,
  );
}


export function formatDetailTimestamp(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "No activity";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


export function formatShortTimestamp(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "No activity";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


export function formatBytes(
  bytes: number,
): string {
  if (
    bytes < 1000
  ) {
    return `${bytes} B`;
  }

  if (
    bytes < 1_000_000
  ) {
    return `${(
      bytes / 1000
    ).toFixed(1)} KB`;
  }

  if (
    bytes < 1_000_000_000
  ) {
    return `${(
      bytes / 1_000_000
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes / 1_000_000_000
  ).toFixed(2)} GB`;
}


export function formatEventType(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}


export function formatIncidentType(
  value: string,
): string {
  return formatEventType(
    value,
  );
}


export function formatRiskLabel(
  risk: EmployeeRiskLevel,
): string {
  if (
    risk === "NORMAL"
  ) {
    return "Normal";
  }

  return risk
    .charAt(0)
    + risk
      .slice(1)
      .toLowerCase();
}
