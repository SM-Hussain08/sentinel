import type {
  EmployeeDetail,
} from "../../../types/api";

import EmployeeRiskBadge from "../EmployeeRiskBadge";

import {
  formatDetailTimestamp,
} from "./employeeDetailFormatters";


interface EmployeeDetailHeroProps {
  employee:
    EmployeeDetail;
}


function EmployeeDetailHero({
  employee,
}: EmployeeDetailHeroProps) {
  return (
    <section
      className="
        relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
        p-6
        shadow-[0_12px_35px_rgba(0,0,0,0.14)]
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          right-[-100px]
          top-[-120px]
          h-72 w-72
          rounded-full
          bg-cyan-400/[0.03]
          blur-[100px]
        "
      />

      <div
        className="
          relative
          flex
          flex-col
          gap-6
          xl:flex-row
          xl:items-center
          xl:justify-between
        "
      >
        <div
          className="
            flex
            min-w-0
            items-start
            gap-4
          "
        >
          <div
            className="
              flex h-14 w-14
              shrink-0
              items-center
              justify-center
              rounded-2xl
              border
              border-cyan-900/60
              bg-cyan-950/25
              font-mono
              text-lg
              font-semibold
              text-cyan-300
              shadow-[0_0_26px_rgba(34,211,238,0.06)]
            "
          >
            {employee.name
              .split(" ")
              .slice(
                0,
                2,
              )
              .map(
                (part) =>
                  part.charAt(0),
              )
              .join("")
              .toUpperCase()}
          </div>

          <div
            className="
              min-w-0
            "
          >
            <div
              className="
                flex
                flex-wrap
                items-center
                gap-3
              "
            >
              <h2
                className="
                  truncate
                  text-2xl
                  font-semibold
                  text-white
                "
              >
                {employee.name}
              </h2>

              <EmployeeRiskBadge
                risk={
                  employee
                    .security
                    .highest_risk_level
                }
              />
            </div>

            <div
              className="
                mt-2
                flex
                flex-wrap
                items-center
                gap-x-3
                gap-y-1
                text-xs
              "
            >
              <span
                className="
                  font-mono
                  text-cyan-500
                "
              >
                {employee.user_id}
              </span>

              <span
                className="
                  text-slate-700
                "
              >
                •
              </span>

              <span
                className="
                  text-slate-400
                "
              >
                {employee.job_role}
              </span>

              <span
                className="
                  text-slate-700
                "
              >
                •
              </span>

              <span
                className="
                  text-slate-500
                "
              >
                {employee.department}
              </span>
            </div>

            <div
              className="
                mt-3
                flex
                flex-wrap
                items-center
                gap-2
              "
            >
              <span
                className={[
                  "rounded-full",
                  "border",
                  "px-2.5 py-1",
                  "text-[9px]",
                  "font-semibold",
                  "uppercase",
                  "tracking-[0.12em]",

                  employee.is_active
                    ? (
                        "border-emerald-900/60 "
                        + "bg-emerald-950/20 "
                        + "text-emerald-300"
                      )
                    : (
                        "border-slate-700 "
                        + "bg-slate-950/40 "
                        + "text-slate-500"
                      ),
                ].join(
                  " ",
                )}
              >
                {employee.is_active
                  ? "Active Identity"
                  : "Inactive Identity"}
              </span>

              <span
                className="
                  rounded-full
                  border
                  border-slate-800
                  bg-slate-950/30
                  px-2.5 py-1
                  text-[9px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-500
                "
              >
                {employee
                  .baseline
                  .typical_location}
              </span>
            </div>
          </div>
        </div>

        <div
          className="
            grid
            gap-3
            sm:grid-cols-2
            xl:grid-cols-3
          "
        >
          <div
            className="
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]/75
              px-4 py-3
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
              Highest Score
            </p>

            <p
              className="
                mt-1.5
                font-mono
                text-lg
                font-semibold
                text-white
              "
            >
              {employee
                .security
                .highest_anomaly_score
                !== null
                ? employee
                    .security
                    .highest_anomaly_score
                    .toFixed(4)
                : "—"}
            </p>
          </div>

          <div
            className="
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]/75
              px-4 py-3
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
              Open Incidents
            </p>

            <p
              className="
                mt-1.5
                font-mono
                text-lg
                font-semibold
                text-white
              "
            >
              {
                employee
                  .security
                  .open_incident_count
              }
            </p>
          </div>

          <div
            className="
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]/75
              px-4 py-3
              sm:col-span-2
              xl:col-span-1
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
              Last Activity
            </p>

            <p
              className="
                mt-1.5
                text-xs
                font-medium
                text-slate-300
              "
            >
              {formatDetailTimestamp(
                employee
                  .security
                  .last_activity_at,
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


export default EmployeeDetailHero;
