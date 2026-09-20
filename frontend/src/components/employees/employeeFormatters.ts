import type {
  EmployeeRiskLevel,
} from "../../types/api";


export const EMPLOYEE_RISK_RANK:
Record<
  EmployeeRiskLevel,
  number
> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  NORMAL: 1,
};


export function formatEmployeeNumber(
  value: number,
): string {
  return new Intl.NumberFormat().format(
    value,
  );
}


export function formatEmployeeTimestamp(
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


export function formatEmployeeRisk(
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
