import type {
  MLRiskLevel,
} from "../../types/api";

import {
  ANOMALY_RISK_STYLES,
} from "./anomalyStyles";


interface AnomalyRiskBadgeProps {
  risk:
    MLRiskLevel;
}


function AnomalyRiskBadge({
  risk,
}: AnomalyRiskBadgeProps) {
  return (
    <span
      className={[
        "inline-flex",
        "items-center",
        "rounded-full",
        "border",
        "px-2.5 py-1",
        "text-[10px]",
        "font-semibold",
        "tracking-[0.12em]",
        ANOMALY_RISK_STYLES[
          risk
        ].badge,
      ].join(
        " ",
      )}
    >
      {risk}
    </span>
  );
}


export default AnomalyRiskBadge;