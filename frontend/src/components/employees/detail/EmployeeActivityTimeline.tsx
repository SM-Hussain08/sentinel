import type {
  EmployeeActivityItem,
} from "../../../types/api";

import EmployeeRiskBadge from "../EmployeeRiskBadge";

import {
  formatBytes,
  formatEventType,
  formatShortTimestamp,
} from "./employeeDetailFormatters";


interface EmployeeActivityTimelineProps {
  activity:
    EmployeeActivityItem[];

  totalActivity: number;

  onOpenAnomaly: (
    eventId: string,
  ) => void;

  onOpenIncident: (
    incidentId: string,
  ) => void;
}


function EmployeeActivityTimeline({
  activity,
  totalActivity,
  onOpenAnomaly,
  onOpenIncident,
}: EmployeeActivityTimelineProps) {
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
          flex-col
          gap-3
          border-b
          border-slate-800
          px-5 py-4
          sm:flex-row
          sm:items-end
          sm:justify-between
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
            Operational Timeline
          </p>

          <h2
            className="
              mt-1
              text-lg
              font-semibold
              text-white
            "
          >
            Recent Security Activity
          </h2>

          <p
            className="
              mt-1
              text-xs
              text-slate-600
            "
          >
            Latest observed employee events
            with selected-detector and
            incident linkage where available.
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
            text-[10px]
            text-slate-400
          "
        >
          {activity.length}
          {" of "}
          {totalActivity}
        </span>
      </div>

      <div
        className="
          max-h-[620px]
          overflow-y-auto
          overscroll-contain
          [scrollbar-color:#1e293b_#0b111c]
          [scrollbar-width:thin]
        "
      >
        {activity.length
          === 0 ? (
            <div
              className="
                px-6 py-14
                text-center
                text-xs
                text-slate-600
              "
            >
              No employee activity is
              currently available.
            </div>
          ) : (
            activity.map(
              (item) => (
                <article
                  key={
                    item.event_id
                  }
                  className="
                    group
                    border-b
                    border-slate-800/70
                    px-5 py-4
                    transition-colors
                    duration-200
                    last:border-b-0
                    hover:bg-[#121b29]
                  "
                >
                  <div
                    className="
                      grid
                      gap-4
                      xl:grid-cols-[150px_minmax(200px,1fr)_170px_150px_190px]
                      xl:items-center
                    "
                  >
                    <div>
                      <p
                        className="
                          font-mono
                          text-[9px]
                          text-cyan-500
                        "
                      >
                        {item.event_id}
                      </p>

                      <p
                        className="
                          mt-1
                          text-[11px]
                          text-slate-500
                        "
                      >
                        {formatShortTimestamp(
                          item.timestamp,
                        )}
                      </p>
                    </div>

                    <div>
                      <p
                        className="
                          text-sm
                          font-medium
                          text-slate-300
                        "
                      >
                        {formatEventType(
                          item.event_type,
                        )}
                      </p>

                      <p
                        className="
                          mt-1
                          truncate
                          text-[10px]
                          text-slate-600
                        "
                      >
                        {item.resource_name
                          ?? item.resource_type
                          ?? "No resource context"}
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
                        Source
                      </p>

                      <p
                        className="
                          mt-1
                          font-mono
                          text-[11px]
                          text-slate-400
                        "
                      >
                        {item.source_ip}
                      </p>

                      <p
                        className="
                          mt-0.5
                          truncate
                          text-[9px]
                          text-slate-700
                        "
                      >
                        {item.source_location
                          ?? "Unknown location"}
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
                        Transfer
                      </p>

                      <p
                        className="
                          mt-1
                          text-[11px]
                          text-slate-400
                        "
                      >
                        ↑{" "}
                        {formatBytes(
                          item.bytes_sent,
                        )}
                      </p>

                      <p
                        className="
                          mt-0.5
                          text-[10px]
                          text-slate-600
                        "
                      >
                        ↓{" "}
                        {formatBytes(
                          item.bytes_received,
                        )}
                      </p>
                    </div>

                    <div
                      className="
                        flex
                        flex-wrap
                        items-center
                        gap-2
                        xl:justify-end
                      "
                    >
                      {item.risk_level
                        && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenAnomaly(
                                item.event_id,
                              );
                            }}
                            className="
                              rounded-full
                              transition-transform
                              duration-200
                              hover:scale-[1.03]
                            "
                          >
                            <EmployeeRiskBadge
                              risk={
                                item.risk_level
                              }
                            />
                          </button>
                        )}

                      {item
                        .linked_incident_ids
                        .slice(
                          0,
                          2,
                        )
                        .map(
                          (incidentId) => (
                            <button
                              key={
                                incidentId
                              }
                              type="button"
                              onClick={() => {
                                onOpenIncident(
                                  incidentId,
                                );
                              }}
                              className="
                                rounded-lg
                                border
                                border-amber-900/50
                                bg-amber-950/15
                                px-2 py-1
                                font-mono
                                text-[9px]
                                text-amber-400
                                transition-all
                                duration-200
                                hover:border-amber-700/70
                                hover:bg-amber-950/30
                                hover:text-amber-300
                              "
                            >
                              {incidentId}
                            </button>
                          ),
                        )}

                      {!item.risk_level
                        && item
                          .linked_incident_ids
                          .length
                          === 0
                        && (
                          <span
                            className="
                              text-[10px]
                              text-slate-700
                            "
                          >
                            Observed
                          </span>
                        )}
                    </div>
                  </div>
                </article>
              ),
            )
          )}
      </div>
    </section>
  );
}


export default EmployeeActivityTimeline;
