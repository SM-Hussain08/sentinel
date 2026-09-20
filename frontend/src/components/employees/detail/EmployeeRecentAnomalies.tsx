import type {
  EmployeeAnomalyItem,
} from "../../../types/api";

import EmployeeRiskBadge from "../EmployeeRiskBadge";

import {
  formatEventType,
  formatShortTimestamp,
} from "./employeeDetailFormatters";


interface EmployeeRecentAnomaliesProps {
  anomalies:
    EmployeeAnomalyItem[];

  onOpenAnomaly: (
    eventId: string,
  ) => void;
}


function EmployeeRecentAnomalies({
  anomalies,
  onOpenAnomaly,
}: EmployeeRecentAnomaliesProps) {
  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-800
        bg-[#101826]/88
      "
    >
      <div
        className="
          flex
          items-end
          justify-between
          gap-4
          border-b
          border-slate-800
          px-5 py-4
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
            Behavioral Detection
          </p>

          <h2
            className="
              mt-1
              text-lg
              font-semibold
              text-white
            "
          >
            Recent Anomalies
          </h2>

          <p
            className="
              mt-1
              text-xs
              text-slate-600
            "
          >
            Latest non-normal selected-model
            detections for this identity.
          </p>
        </div>

        <span
          className="
            rounded-lg
            border
            border-slate-800
            bg-[#0b111c]
            px-2.5 py-1.5
            font-mono
            text-xs
            text-slate-400
          "
        >
          {anomalies.length}
        </span>
      </div>

      <div
        className="
          max-h-[480px]
          overflow-y-auto
          overscroll-contain
          [scrollbar-color:#1e293b_#0b111c]
          [scrollbar-width:thin]
        "
      >
        {anomalies.length
          === 0 ? (
            <div
              className="
                px-6 py-12
                text-center
                text-xs
                text-slate-600
              "
            >
              No selected-model anomaly
              signals are currently recorded
              for this employee.
            </div>
          ) : (
            anomalies.map(
              (anomaly) => (
                <button
                  key={
                    anomaly.event_id
                  }
                  type="button"
                  onClick={() => {
                    onOpenAnomaly(
                      anomaly.event_id,
                    );
                  }}
                  className="
                    group
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
                    hover:shadow-[inset_3px_0_0_rgba(34,211,238,0.30)]
                  "
                >
                  <div
                    className="
                      grid
                      gap-3
                      lg:grid-cols-[110px_1fr_170px_120px_38px]
                      lg:items-center
                    "
                  >
                    <EmployeeRiskBadge
                      risk={
                        anomaly.risk_level
                      }
                    />

                    <div
                      className="
                        min-w-0
                      "
                    >
                      <p
                        className="
                          font-mono
                          text-[9px]
                          text-cyan-500
                        "
                      >
                        {anomaly.event_id}
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-medium
                          text-slate-300
                          group-hover:text-white
                        "
                      >
                        {formatEventType(
                          anomaly.event_type,
                        )}
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
                        Resource
                      </p>

                      <p
                        className="
                          mt-1
                          truncate
                          text-xs
                          text-slate-400
                        "
                      >
                        {anomaly.resource_name
                          ?? anomaly.resource_type
                          ?? "—"}
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
                        Observed
                      </p>

                      <p
                        className="
                          mt-1
                          text-[11px]
                          text-slate-400
                        "
                      >
                        {formatShortTimestamp(
                          anomaly.timestamp,
                        )}
                      </p>
                    </div>

                    <span
                      className="
                        flex h-8 w-8
                        items-center
                        justify-center
                        justify-self-end
                        rounded-lg
                        border
                        border-slate-800
                        bg-slate-950/40
                        text-slate-600
                        transition-all
                        duration-200
                        group-hover:translate-x-1
                        group-hover:border-cyan-900/70
                        group-hover:text-cyan-300
                      "
                    >
                      →
                    </span>
                  </div>
                </button>
              ),
            )
          )}
      </div>
    </section>
  );
}


export default EmployeeRecentAnomalies;
