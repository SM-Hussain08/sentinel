import type {
  IncidentListItem,
} from "../../types/api";

import {
  OVERVIEW_SEVERITY_STYLES,
  formatOverviewIncidentType,
  formatOverviewTimestamp,
} from "./overviewStyles";


interface OverviewIncidentQueueProps {
  incidents:
    IncidentListItem[];

  onOpenIncident: (
    incidentId:
      string,
  ) => void;

  onOpenAllIncidents:
    () => void;
}


function SeverityBadge({
  severity,
}: {
  severity:
    IncidentListItem[
      "severity"
    ];
}) {
  return (
    <span
      className={[
        "inline-flex items-center",
        "rounded-full border",
        "px-2.5 py-1",
        "text-[10px] font-semibold",
        "tracking-[0.12em]",

        OVERVIEW_SEVERITY_STYLES[
          severity
        ].badge,
      ].join(
        " ",
      )}
    >
      {severity}
    </span>
  );
}


function OverviewIncidentQueue({
  incidents,
  onOpenIncident,
  onOpenAllIncidents,
}: OverviewIncidentQueueProps) {
  return (
    <section
      className="
        mt-4
        overflow-hidden
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
        shadow-[0_12px_35px_rgba(0,0,0,0.12)]
      "
    >
      {/* Header */}
      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-slate-800
          px-5 py-5
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
              tracking-[0.17em]
              text-slate-500
            "
          >
            Investigation Queue
          </p>

          <h2
            className="
              mt-1.5
              text-lg
              font-semibold
              text-white
            "
          >
            Recent Security Incidents
          </h2>

          <p
            className="
              mt-1
              text-xs
              text-slate-600
            "
          >
            Selected priority incidents
            requiring operational awareness.
          </p>
        </div>


        <button
          type="button"
          onClick={
            onOpenAllIncidents
          }
          className="
            group
            inline-flex
            self-start
            items-center
            gap-2
            rounded-lg
            border
            border-slate-800
            bg-[#0b111c]
            px-3 py-2
            text-xs
            font-medium
            text-slate-400
            transition-all
            duration-200
            hover:border-cyan-900/60
            hover:bg-cyan-950/15
            hover:text-cyan-300
            sm:self-auto
          "
        >
          Go to Incidents

          <span
            aria-hidden="true"
            className="
              transition-transform
              duration-200
              group-hover:translate-x-0.5
            "
          >
            →
          </span>
        </button>
      </div>


      {/* Selected incidents */}
      <div
        className="
          divide-y
          divide-slate-800/70
        "
      >
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
                group
                grid
                w-full
                gap-4
                px-5 py-4
                text-left
                transition-all
                duration-200
                hover:bg-[#121b28]
                lg:grid-cols-[120px_1fr_160px_120px_130px_34px]
                lg:items-center
              "
            >
              <div>
                <SeverityBadge
                  severity={
                    incident
                      .severity
                  }
                />
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
                    gap-2
                  "
                >
                  <p
                    className="
                      font-mono
                      text-[10px]
                      text-cyan-400
                    "
                  >
                    {
                      incident
                        .incident_id
                    }
                  </p>

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
                      tracking-[0.1em]
                      text-slate-600
                    "
                  >
                    {formatOverviewIncidentType(
                      incident
                        .incident_type,
                    )}
                  </span>
                </div>


                <p
                  className="
                    mt-1
                    font-medium
                    text-slate-200
                    transition-colors
                    duration-200
                    group-hover:text-slate-100
                  "
                >
                  {
                    incident
                      .title
                  }
                </p>


                <p
                  className="
                    mt-1
                    line-clamp-1
                    text-xs
                    text-slate-600
                  "
                >
                  {
                    incident
                      .summary
                  }
                </p>
              </div>


              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.12em]
                    text-slate-600
                  "
                >
                  Identity
                </p>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-300
                  "
                >
                  {
                    incident
                      .primary_employee_user_id
                    ?? "Unknown"
                  }
                </p>
              </div>


              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.12em]
                    text-slate-600
                  "
                >
                  Events
                </p>

                <p
                  className="
                    mt-1
                    text-sm
                    font-semibold
                    text-slate-300
                  "
                >
                  {
                    incident
                      .event_count
                  }
                </p>
              </div>


              <div>
                <p
                  className="
                    text-[10px]
                    uppercase
                    tracking-[0.12em]
                    text-slate-600
                  "
                >
                  First Seen
                </p>

                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-400
                  "
                >
                  {formatOverviewTimestamp(
                    incident
                      .first_seen,
                  )}
                </p>
              </div>


              {/* Deliberately subtle navigation hint */}
              <span
                aria-hidden="true"
                className="
                  hidden
                  h-7 w-7
                  items-center
                  justify-center
                  rounded-md
                  text-sm
                  text-slate-700
                  transition-all
                  duration-200
                  group-hover:translate-x-0.5
                  group-hover:text-cyan-500
                  lg:flex
                "
              >
                →
              </span>
            </button>
          ),
        )}


        {incidents.length
          === 0 && (
          <div
            className="
              px-6 py-10
              text-center
            "
          >
            <p
              className="
                text-sm
                font-medium
                text-slate-400
              "
            >
              No active priority incidents
            </p>

            <p
              className="
                mt-1
                text-xs
                text-slate-600
              "
            >
              The operational queue is
              currently clear.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}


export default OverviewIncidentQueue;