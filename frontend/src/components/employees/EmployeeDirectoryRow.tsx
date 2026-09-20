import type {
  EmployeeDirectoryItem,
} from "../../types/api";

import {
  formatEmployeeNumber,
  formatEmployeeTimestamp,
} from "./employeeFormatters";

import EmployeeRiskBadge from "./EmployeeRiskBadge";


interface EmployeeDirectoryRowProps {
  employee:
    EmployeeDirectoryItem;

  onOpen: (
    userId: string,
  ) => void;
}


function EmployeeDirectoryRow({
  employee,
  onOpen,
}: EmployeeDirectoryRowProps) {
  const security =
    employee.security;

  return (
    <button
      type="button"
      onClick={() => {
        onOpen(
          employee.user_id,
        );
      }}
      className="
        group
        relative
        block
        w-full
        border-b
        border-slate-800/70
        px-5 py-4
        text-left
        transition-all
        duration-200
        last:border-b-0
        hover:bg-[#141e2d]
        hover:shadow-[inset_3px_0_0_rgba(34,211,238,0.35)]
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-inset
        focus-visible:ring-cyan-900/70
      "
    >
      <div
        className="
          grid
          gap-4
          xl:grid-cols-[120px_minmax(220px,1.4fr)_170px_120px_120px_150px_46px]
          xl:items-center
        "
      >
        <EmployeeRiskBadge
          risk={
            security
              .highest_risk_level
          }
        />

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
              gap-2
          "
          >
            <span
              className="
                truncate
                text-sm
                font-semibold
                text-slate-200
                transition-colors
                duration-200
                group-hover:text-white
              "
            >
              {employee.name}
            </span>

            <span
              className="
                font-mono
                text-[9px]
                text-cyan-500
              "
            >
              {employee.user_id}
            </span>

            {!employee.is_active && (
              <span
                className="
                  rounded-full
                  border
                  border-slate-700
                  bg-slate-950/60
                  px-2 py-0.5
                  text-[8px]
                  uppercase
                  tracking-[0.12em]
                  text-slate-500
                "
              >
                Inactive
              </span>
            )}
          </div>

          <p
            className="
              mt-1
              truncate
              text-xs
              text-slate-500
              transition-colors
              duration-200
              group-hover:text-slate-400
            "
          >
            {employee.job_role}
          </p>
        </div>

        <div>
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.12em]
              text-slate-700
            "
          >
            Department
          </p>

          <p
            className="
              mt-1
              truncate
              text-xs
              text-slate-400
            "
          >
            {employee.department}
          </p>

          <p
            className="
              mt-0.5
              truncate
              text-[10px]
              text-slate-600
            "
          >
            {employee.typical_location}
          </p>
        </div>

        <div>
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.12em]
              text-slate-700
            "
          >
            Anomalies
          </p>

          <p
            className="
              mt-1
              font-mono
              text-sm
              text-slate-300
            "
          >
            {formatEmployeeNumber(
              security.anomaly_count,
            )}
          </p>

          <p
            className="
              mt-0.5
              text-[9px]
              text-slate-700
            "
          >
            {
              security
                .scored_event_count
            } scored
          </p>
        </div>

        <div>
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.12em]
              text-slate-700
            "
          >
            Incidents
          </p>

          <p
            className="
              mt-1
              font-mono
              text-sm
              text-slate-300
            "
          >
            {formatEmployeeNumber(
              security.incident_count,
            )}
          </p>

          <p
            className="
              mt-0.5
              text-[9px]
              text-slate-700
            "
          >
            {
              security
                .open_incident_count
            } open
          </p>
        </div>

        <div>
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.12em]
              text-slate-700
            "
          >
            Last Activity
          </p>

          <p
            className="
              mt-1
              text-[11px]
              text-slate-400
            "
          >
            {formatEmployeeTimestamp(
              security
                .last_activity_at,
            )}
          </p>
        </div>

        <span
          className="
            flex
            h-9 w-9
            items-center
            justify-center
            justify-self-end
            rounded-lg
            border
            border-slate-800
            bg-slate-950/50
            text-base
            text-slate-600
            transition-all
            duration-200
            group-hover:translate-x-1
            group-hover:border-cyan-900/70
            group-hover:bg-cyan-950/20
            group-hover:text-cyan-300
          "
          aria-hidden="true"
        >
          →
        </span>
      </div>
    </button>
  );
}


export default EmployeeDirectoryRow;
