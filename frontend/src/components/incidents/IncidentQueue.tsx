import type {
  IncidentListItem,
} from "../../types/api";

import SeverityBadge from "./SeverityBadge";


interface IncidentQueueProps {
  incidents: IncidentListItem[];

  totalFiltered: number;

  pageStart: number;

  onOpenIncident: (
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
  totalFiltered,
  pageStart,
  onOpenIncident,
}: IncidentQueueProps) {
  const showingFrom =
    incidents.length > 0
      ? pageStart + 1
      : 0;

  const showingTo =
    pageStart
    + incidents.length;


  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border border-slate-700/55
        bg-[#101826]/90
        shadow-[0_14px_38px_rgba(0,0,0,0.14)]
      "
    >
      <div
        className="
          flex flex-col gap-3
          border-b border-slate-800
          px-5 py-4
          sm:flex-row
          sm:items-center
          sm:justify-between
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
            Incident Queue
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

        <div
          className="
            flex items-center gap-2
            text-[10px]
            text-slate-600
          "
        >
          <span>
            Showing
          </span>

          <span
            className="
              rounded-lg
              border border-slate-800
              bg-[#0b111c]
              px-2.5 py-1.5
              font-mono
              text-slate-400
            "
          >
            {showingFrom}
            {"–"}
            {showingTo}
            {" of "}
            {totalFiltered}
          </span>
        </div>
      </div>

      <div>
        {incidents.map(
          (incident) => (
            <button
              key={
                incident.incident_id
              }
              type="button"
              onClick={() => {
                onOpenIncident(
                  incident.incident_id,
                );
              }}
              className="
                group relative
                block w-full
                border-b
                border-slate-800/70
                px-5 py-5
                text-left
                transition-all
                duration-200
                last:border-b-0
                hover:bg-[#141e2d]
                hover:shadow-[inset_3px_0_0_rgba(34,211,238,0.35)]
              "
            >
              <div
                className="
                  flex gap-4
                  sm:items-center
                  sm:justify-between
                "
              >
                <div
                  className="
                    min-w-0 flex-1
                  "
                >
                  <div
                    className="
                      flex flex-wrap
                      items-center
                      gap-2.5
                    "
                  >
                    <SeverityBadge
                      severity={
                        incident.severity
                      }
                    />

                    <span
                      className="
                        rounded-md
                        border border-slate-800
                        bg-slate-950/30
                        px-2 py-1
                        text-[9px]
                        font-medium
                        uppercase
                        tracking-[0.1em]
                        text-slate-600
                      "
                    >
                      {incident.status}
                    </span>

                    <span
                      className="
                        font-mono
                        text-[10px]
                        text-cyan-500
                      "
                    >
                      {
                        incident.incident_id
                      }
                    </span>
                  </div>

                  <div
                    className="
                      mt-3
                      flex items-start
                      justify-between
                      gap-4
                    "
                  >
                    <div
                      className="
                        min-w-0
                      "
                    >
                      <p
                        className="
                          text-sm
                          font-semibold
                          text-slate-200
                          transition-colors
                          duration-200
                          group-hover:text-white
                        "
                      >
                        {incident.title}
                      </p>

                      <p
                        className="
                          mt-1.5
                          line-clamp-2
                          max-w-5xl
                          text-xs
                          leading-5
                          text-slate-600
                          transition-colors
                          duration-200
                          group-hover:text-slate-500
                        "
                      >
                        {incident.summary}
                      </p>
                    </div>

                    <span
                      aria-hidden="true"
                      className="
                        hidden
                        h-9 w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        border border-slate-800
                        bg-[#0b111c]
                        text-sm
                        text-slate-500
                        transition-all
                        duration-200
                        group-hover:translate-x-1
                        group-hover:border-cyan-900/70
                        group-hover:bg-cyan-950/20
                        group-hover:text-cyan-300
                        sm:flex
                      "
                    >
                      →
                    </span>
                  </div>

                  <div
                    className="
                      mt-4
                      flex flex-wrap
                      items-center
                      gap-x-5 gap-y-2
                      text-[10px]
                      text-slate-600
                    "
                  >
                    <span>
                      Identity:
                      {" "}
                      <span
                        className="
                          text-slate-500
                        "
                      >
                        {
                          incident
                            .primary_employee_user_id
                          ?? "Unknown"
                        }
                      </span>
                    </span>

                    <span>
                      {
                        incident.event_count
                      }
                      {" events"}
                    </span>

                    <span>
                      {
                        incident.anomaly_count
                      }
                      {" anomalies"}
                    </span>

                    <span>
                      {
                        incident.incident_type
                      }
                    </span>

                    <span>
                      {formatShortTimestamp(
                        incident.first_seen,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ),
        )}

        {incidents.length
          === 0 && (
          <div
            className="
              px-6 py-16
              text-center
            "
          >
            <div
              className="
                mx-auto flex
                h-11 w-11
                items-center
                justify-center
                rounded-xl
                border border-slate-800
                bg-[#0b111c]
                text-lg
                text-slate-600
              "
            >
              ⌕
            </div>

            <p
              className="
                mt-4 text-sm
                font-medium
                text-slate-400
              "
            >
              No incidents found
            </p>

            <p
              className="
                mt-1 text-xs
                text-slate-600
              "
            >
              Adjust the current search
              or severity filter.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}


export default IncidentQueue;