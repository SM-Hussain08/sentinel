import type {
  EmployeeRiskLevel,
} from "../../types/api";

import {
  formatEmployeeRisk,
} from "./employeeFormatters";


interface EmployeeRiskBadgeProps {
  risk:
    EmployeeRiskLevel;
}


const RISK_STYLES:
Record<
  EmployeeRiskLevel,
  string
> = {
  CRITICAL:
    "border-red-800/70 bg-red-950/35 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.05)]",

  HIGH:
    "border-orange-800/65 bg-orange-950/30 text-orange-300",

  MEDIUM:
    "border-amber-800/60 bg-amber-950/25 text-amber-300",

  LOW:
    "border-sky-800/55 bg-sky-950/20 text-sky-300",

  NORMAL:
    "border-emerald-900/60 bg-emerald-950/20 text-emerald-300",
};


function EmployeeRiskBadge({
  risk,
}: EmployeeRiskBadgeProps) {
  return (
    <span
      className={[
        "inline-flex",
        "w-fit",
        "items-center",
        "gap-1.5",
        "rounded-full",
        "border",
        "px-2.5 py-1",
        "text-[9px]",
        "font-semibold",
        "uppercase",
        "tracking-[0.12em]",
        RISK_STYLES[risk],
      ].join(
        " ",
      )}
    >
      <span
        className="
          h-1.5 w-1.5
          rounded-full
          bg-current
          opacity-80
        "
      />

      {formatEmployeeRisk(
        risk,
      )}
    </span>
  );
}


export default EmployeeRiskBadge;
