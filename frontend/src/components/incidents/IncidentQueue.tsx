import type {
  IncidentListItem,
} from "../../types/api";

import SeverityBadge from "./SeverityBadge";

import {
  SEVERITY_STYLES,
} from "./incidentStyles";


interface IncidentQueueProps {
  incidents: IncidentListItem[];

  selectedIncidentId:
    | string
    | null;

  onSelectIncident: (
    incidentId: string,
  ) => void;
}


function formatShortTimestamp(
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
    },
  );
}


function IncidentQueue({
  incidents,
  selectedIncidentId,
  onSelectIncident,
}: IncidentQueueProps) {
  return (
    <aside
      className="
        overflow-hidden
        rounded-2xl
        border border-slate-700/55
        bg-[#101826]/90
        shadow-[0_12px_35px_rgba(0,0,0,0.12)]
      "
    >
      <div
        className="
          border-b
          border-slate-800
          px-4 py-4
        "
      >
        <div
          className="
            flex items-center
            justify-between
            gap-3
          "
        >
          <div>
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.16em]
                text-slate-600
              "
            >
              Investigation Queue
            </p>

            <p
              className="
                mt-1 text-sm
                font-semibold
                text-white
              "
            >
              Security Incidents
            </p>
          </div>

          <span
            className="
              rounded-lg
              border border-slate-800
              bg-[#0b111c]
              px-2.5 py-1.5
              text-xs
              font-semibold
              text-slate-400
            "
          >
            {incidents.length}
          </span>
        </div>
      </div>

      <div
        className="
          max-h-[calc(100vh-280px)]
          overflow-y-auto
        "
      >
        {incidents.map(
          (incident) => {
            const selected =
              selectedIncidentId
              === incident.incident_id;

            return (
              <button
                key={
                  incident.incident_id
                }
                type="button"
                onClick={() => {
                  onSelectIncident(
                    incident.incident_id,
                  );
                }}
                className={[
                  "group relative",
                  "block w-full",
                  "border-b",
                  "border-slate-800/70",
                  "px-4 py-4",
                  "text-left",
                  "transition-all",
                  "duration-200",
                  selected
                    ? SEVERITY_STYLES[
                        incident.severity
                      ].selected
                    : (
                      "bg-transparent "
                      + "hover:bg-[#141e2d]"
                    ),
                ].join(" ")}
              >
                {selected && (
                  <span
                    className={[
                      "absolute",
                      "left-0 top-3",
                      "bottom-3 w-[2px]",
                      "rounded-r-full",
                      incident.severity
                        === "CRITICAL"
                        ? "bg-red-400"
                        : incident.severity
                            === "HIGH"
                          ? "bg-orange-400"
                          : "bg-amber-400",
                    ].join(" ")}
                  />
                )}

                <div
                  className="
                    flex items-center
                    justify-between
                    gap-3
                  "
                >
                  <SeverityBadge
                    severity={
                      incident.severity
                    }
                  />

                  <span
                    className="
                      font-mono
                      text-[9px]
                      text-cyan-500
                    "
                  >
                    {
                      incident
                        .incident_id
                    }
                  </span>
                </div>

                <p
                  className="
                    mt-3 text-sm
                    font-semibold
                    text-slate-200
                    transition-colors
                    group-hover:text-white
                  "
                >
                  {incident.title}
                </p>

                <p
                  className="
                    mt-1
                    line-clamp-2
                    text-xs
                    leading-5
                    text-slate-600
                  "
                >
                  {incident.summary}
                </p>

                <div
                  className="
                    mt-3 flex
                    flex-wrap
                    items-center
                    gap-x-4 gap-y-2
                    text-[10px]
                    text-slate-600
                  "
                >
                  <span>
                    {
                      incident
                        .primary_employee_user_id
                      ?? "Unknown"
                    }
                  </span>

                  <span>
                    {
                      incident
                        .event_count
                    }
                    {" "}
                    events
                  </span>

                  <span>
                    {formatShortTimestamp(
                      incident.first_seen,
                    )}
                  </span>
                </div>
              </button>
            );
          },
        )}

        {incidents.length
          === 0 && (
            <div
              className="
                px-5 py-12
                text-center
              "
            >
              <p
                className="
                  text-sm
                  text-slate-500
                "
              >
                No incidents match
                the current filters.
              </p>
            </div>
          )}
      </div>
    </aside>
  );
}


export default IncidentQueue;