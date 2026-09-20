import type {
  EmployeeSecuritySummary as SecuritySummary,
} from "../../../types/api";

import {
  formatDetailNumber,
} from "./employeeDetailFormatters";


interface EmployeeSecuritySummaryProps {
  security:
    SecuritySummary;
}


interface MetricProps {
  label: string;

  value:
    | number
    | string;

  detail: string;

  accent:
    | "cyan"
    | "red"
    | "amber"
    | "violet";
}


const ACCENT_TEXT = {
  cyan:
    "text-cyan-300",

  red:
    "text-red-300",

  amber:
    "text-amber-300",

  violet:
    "text-violet-300",
};


function Metric({
  label,
  value,
  detail,
  accent,
}: MetricProps) {
  return (
    <div
      className="
        rounded-xl
        border
        border-slate-800
        bg-[#0b111c]/70
        p-4
        transition-all
        duration-200
        hover:border-slate-700
        hover:bg-[#0d1521]
      "
    >
      <p
        className="
          text-[9px]
          uppercase
          tracking-[0.14em]
          text-slate-700
        "
      >
        {label}
      </p>

      <p
        className={[
          "mt-2",
          "font-mono",
          "text-2xl",
          "font-semibold",
          ACCENT_TEXT[
            accent
          ],
        ].join(
          " ",
        )}
      >
        {value}
      </p>

      <p
        className="
          mt-2
          text-[10px]
          leading-4
          text-slate-600
        "
      >
        {detail}
      </p>
    </div>
  );
}


function EmployeeSecuritySummary({
  security,
}: EmployeeSecuritySummaryProps) {
  return (
    <section
      className="
        rounded-2xl
        border
        border-slate-800
        bg-[#101826]/88
        p-5
      "
    >
      <div>
        <p
          className="
            text-[10px]
            uppercase
            tracking-[0.17em]
            text-slate-600
          "
        >
          Security Posture
        </p>

        <h2
          className="
            mt-1
            text-lg
            font-semibold
            text-white
          "
        >
          Identity Risk Summary
        </h2>

        <p
          className="
            mt-1
            text-xs
            leading-5
            text-slate-600
          "
        >
          Current activity, selected-model
          detections and correlated case
          exposure for this identity.
        </p>
      </div>

      <div
        className="
          mt-5
          grid
          gap-3
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <Metric
          label="Activity"
          value={
            formatDetailNumber(
              security.total_events,
            )
          }
          detail={`${formatDetailNumber(
            security.scored_event_count,
          )} events scored by the selected detector.`}
          accent="cyan"
        />

        <Metric
          label="Anomalies"
          value={
            formatDetailNumber(
              security.anomaly_count,
            )
          }
          detail={`${formatDetailNumber(
            security.elevated_anomaly_count,
          )} medium-or-higher behavioral signals.`}
          accent="violet"
        />

        <Metric
          label="Critical Signals"
          value={
            formatDetailNumber(
              security
                .critical_anomaly_count,
            )
          }
          detail="Critical selected-model detections associated with this identity."
          accent="red"
        />

        <Metric
          label="Security Cases"
          value={
            formatDetailNumber(
              security.incident_count,
            )
          }
          detail={`${formatDetailNumber(
            security.open_incident_count,
          )} incidents currently remain open.`}
          accent="amber"
        />
      </div>
    </section>
  );
}


export default EmployeeSecuritySummary;
