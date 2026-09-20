import type {
  EmployeeIncidentItem,
  IncidentSeverity,
} from "../../../types/api";

import {
  formatIncidentType,
  formatShortTimestamp,
} from "./employeeDetailFormatters";


interface EmployeeIncidentHistoryProps {
  incidents:
    EmployeeIncidentItem[];

  onOpenIncident: (
    incidentId: string,
  ) => void;
}


const SEVERITY_STYLES:
Record<
  IncidentSeverity,
  string
> = {
  MEDIUM:
    "border-amber-800/60 bg-amber-950/25 text-amber-300",

  HIGH:
    "border-orange-800/65 bg-orange-950/30 text-orange-300",

  CRITICAL:
    "border-red-800/70 bg-red-950/35 text-red-300",
};


function EmployeeIncidentHistory({
  incidents,
  onOpenIncident,
}: EmployeeIncidentHistoryProps) {
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
            Correlation Intelligence
          </p>

          <h2
            className="
              mt-1
              text-lg
              font-semibold
              text-white
            "
          >
            Security Incidents
          </h2>

          <p
            className="
              mt-1
              text-xs
              text-slate-600
            "
          >
            Historical correlated cases
            associated with this identity.
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
          {incidents.length}
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
        {incidents.length
          === 0 ? (
            <div
              className="
                px-6 py-12
                text-center
                text-xs
                text-slate-600
              "
            >
              No correlated incident history
              is currently associated with
              this employee.
            </div>
          ) : (
            incidents.map(
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
                      xl:grid-cols-[110px_minmax(220px,1fr)_110px_150px_38px]
                      xl:items-center
                    "
                  >
                    <span
                      className={[
                        "inline-flex",
                        "w-fit",
                        "rounded-full",
                        "border",
                        "px-2.5 py-1",
                        "text-[9px]",
                        "font-semibold",
                        "uppercase",
                        "tracking-[0.12em]",
                        SEVERITY_STYLES[
                          incident.severity
                        ],
                      ].join(
                        " ",
                      )}
                    >
                      {incident.severity}
                    </span>

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
                        {incident.incident_id}
                      </p>

                      <p
                        className="
                          mt-1
                          truncate
                          text-sm
                          font-medium
                          text-slate-300
                          group-hover:text-white
                        "
                      >
                        {incident.title}
                      </p>

                      <p
                        className="
                          mt-0.5
                          truncate
                          text-[10px]
                          text-slate-600
                        "
                      >
                        {formatIncidentType(
                          incident
                            .incident_type,
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
                        Status
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          text-slate-400
                        "
                      >
                        {incident.status}
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
                        Last Seen
                      </p>

                      <p
                        className="
                          mt-1
                          text-[11px]
                          text-slate-400
                        "
                      >
                        {formatShortTimestamp(
                          incident.last_seen,
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


export default EmployeeIncidentHistory;
