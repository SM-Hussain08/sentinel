import type {
  EmployeeBehaviorBaseline as BehaviorBaseline,
} from "../../../types/api";

import {
  formatBytes,
  formatDetailNumber,
} from "./employeeDetailFormatters";


interface EmployeeBehaviorBaselineProps {
  baseline:
    BehaviorBaseline;
}


interface BaselineItemProps {
  label: string;
  value: string;
}


function BaselineItem({
  label,
  value,
}: BaselineItemProps) {
  return (
    <div
      className="
        rounded-xl
        border
        border-slate-800
        bg-[#0b111c]/65
        px-4 py-3
      "
    >
      <p
        className="
          text-[9px]
          uppercase
          tracking-[0.13em]
          text-slate-700
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1.5
          text-sm
          font-medium
          text-slate-300
        "
      >
        {value}
      </p>
    </div>
  );
}


function EmployeeBehaviorBaseline({
  baseline,
}: EmployeeBehaviorBaselineProps) {
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
          Behavioral Context
        </p>

        <h2
          className="
            mt-1
            text-lg
            font-semibold
            text-white
          "
        >
          Expected Baseline
        </h2>

        <p
          className="
            mt-1
            text-xs
            leading-5
            text-slate-600
          "
        >
          Established normal operating
          patterns used as contextual
          reference during investigation.
        </p>
      </div>

      <div
        className="
          mt-5
          grid
          gap-3
          sm:grid-cols-2
          xl:grid-cols-3
        "
      >
        <BaselineItem
          label="Normal Access Window"
          value={`${String(
            baseline.normal_start_hour,
          ).padStart(
            2,
            "0",
          )}:00 – ${String(
            baseline.normal_end_hour,
          ).padStart(
            2,
            "0",
          )}:00`}
        />

        <BaselineItem
          label="Typical Source IP"
          value={
            baseline.typical_ip
          }
        />

        <BaselineItem
          label="Typical Location"
          value={
            baseline
              .typical_location
          }
        />

        <BaselineItem
          label="Login Frequency"
          value={`${formatDetailNumber(
            baseline
              .typical_login_frequency,
          )} expected logins`}
        />

        <BaselineItem
          label="File Activity"
          value={`${formatDetailNumber(
            baseline
              .typical_files_accessed,
          )} typical files`}
        />

        <BaselineItem
          label="Data Transfer"
          value={formatBytes(
            baseline
              .typical_data_transfer_bytes,
          )}
        />
      </div>
    </section>
  );
}


export default EmployeeBehaviorBaseline;
