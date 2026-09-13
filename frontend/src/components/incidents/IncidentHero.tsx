import type {
  IncidentDetail,
} from "../../types/api";

import SeverityBadge from "./SeverityBadge";

import {
  SEVERITY_STYLES,
} from "./incidentStyles";


interface IncidentHeroProps {
  incident: IncidentDetail;
}


function formatTimestamp(
  timestamp: string,
): string {
  return new Date(
    timestamp,
  ).toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
}


function formatEventType(
  value: string,
): string {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0)
        + word
          .slice(1)
          .toLowerCase(),
    )
    .join(" ");
}


function formatIncidentType(
  value: string,
): string {
  return formatEventType(
    value,
  );
}


function IncidentHero({
  incident,
}: IncidentHeroProps) {
  return (
    <article
      className={[
        "relative overflow-hidden",
        "rounded-2xl border",
        "bg-[#101826]/90",
        "p-5 sm:p-6",
        "shadow-[0_12px_35px_rgba(0,0,0,0.12)]",
        SEVERITY_STYLES[
          incident.severity
        ].border,
      ].join(" ")}
    >
      <div
        className="
          pointer-events-none
          absolute right-[-100px]
          top-[-120px]
          h-72 w-72
          rounded-full
          bg-cyan-400/[0.025]
          blur-[100px]
        "
      />

      <div
        className="
          relative
        "
      >
        <div
          className="
            flex flex-col
            gap-5
            lg:flex-row
            lg:items-start
            lg:justify-between
          "
        >
          <div>
            <div
              className="
                flex flex-wrap
                items-center
                gap-2
              "
            >
              <span
                className="
                  font-mono
                  text-xs
                  text-cyan-400
                "
              >
                {
                  incident
                    .incident_id
                }
              </span>

              <span
                className="
                  text-slate-700
                "
              >
                ·
              </span>

              <span
                className="
                  text-[10px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-600
                "
              >
                {formatIncidentType(
                  incident
                    .incident_type,
                )}
              </span>
            </div>

            <h2
              className="
                mt-3 text-2xl
                font-semibold
                tracking-tight
                text-white
                sm:text-3xl
              "
            >
              {incident.title}
            </h2>

            <p
              className="
                mt-3 max-w-3xl
                text-sm
                leading-6
                text-slate-400
              "
            >
              {incident.summary}
            </p>
          </div>

          <div
            className="
              flex flex-wrap
              gap-2
            "
          >
            <SeverityBadge
              severity={
                incident.severity
              }
            />

            <span
              className="
                inline-flex
                rounded-full
                border
                border-emerald-900/50
                bg-emerald-950/20
                px-2.5 py-1
                text-[10px]
                font-semibold
                tracking-[0.12em]
                text-emerald-300
              "
            >
              {incident.status}
            </span>
          </div>
        </div>

        <div
          className="
            mt-6 grid gap-3
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          <div
            className="
              rounded-xl
              border border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              Affected Identity
            </p>

            <p
              className="
                mt-2 text-sm
                font-semibold
                text-slate-200
              "
            >
              {
                incident
                  .primary_employee_user_id
                ?? "Unknown"
              }
            </p>
          </div>

          <div
            className="
              rounded-xl
              border border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              Correlated Events
            </p>

            <p
              className="
                mt-2 text-sm
                font-semibold
                text-slate-200
              "
            >
              {
                incident
                  .event_count
              }
            </p>
          </div>

          <div
            className="
              rounded-xl
              border border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              First Seen
            </p>

            <p
              className="
                mt-2 text-xs
                font-medium
                text-slate-300
              "
            >
              {formatTimestamp(
                incident.first_seen,
              )}
            </p>
          </div>

          <div
            className="
              rounded-xl
              border border-slate-800
              bg-[#0b111c]
              p-4
            "
          >
            <p
              className="
                text-[9px]
                uppercase
                tracking-[0.13em]
                text-slate-600
              "
            >
              Peak Anomaly
            </p>

            <p
              className="
                mt-2 text-sm
                font-semibold
                text-red-300
              "
            >
              {(
                incident
                  .max_anomaly_score
                * 100
              ).toFixed(1)}
              %
            </p>
          </div>
        </div>

        <div
          className="
            mt-5 rounded-xl
            border border-cyan-950/45
            bg-cyan-950/10
            px-4 py-3
          "
        >
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.14em]
              text-cyan-500
            "
          >
            Correlation Rationale
          </p>

          <p
            className="
              mt-2 text-xs
              leading-5
              text-slate-400
            "
          >
            {
              incident
                .correlation_reason
            }
          </p>
        </div>
      </div>
    </article>
  );
}


export default IncidentHero;