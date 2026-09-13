import type {
  IncidentSeverity,
} from "../../types/api";

import {
  SEVERITY_STYLES,
} from "./incidentStyles";


interface SeverityBadgeProps {
  severity: IncidentSeverity;
}


function SeverityBadge({
  severity,
}: SeverityBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center",
        "rounded-full border",
        "px-2.5 py-1",
        "text-[10px]",
        "font-semibold",
        "tracking-[0.12em]",
        SEVERITY_STYLES[
          severity
        ].badge,
      ].join(" ")}
    >
      {severity}
    </span>
  );
}


export default SeverityBadge;