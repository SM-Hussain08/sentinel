import type {
  IncidentListItem,
  IncidentSeverity,
} from "../../types/api";

import {
  formatAnomalyPercent,
  formatAnomalyTimestamp,
} from "./anomalyFormatters";


interface AnomalyLinkedIncidentsProps {
  incidents:
    IncidentListItem[];

  onOpenIncident: (
    incidentId:
      string,
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


function AnomalyLinkedIncidents({
  incidents,
  onOpenIncident,
}: AnomalyLinkedIncidentsProps) {
  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
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
            Correlation Intelligence
          </p>

          <h2
            className="
              mt-1.5
              text-lg
              font-semibold
              text-white
            "
          >
            Linked Incidents
          </h2>

          <p
            className="
              mt-1
              text-xs
              leading-5
              text-slate-600
            "
          >
            Correlated incident records
            containing this security event.
          </p>
        </div>


        <span
          className="
            self-start
            rounded-lg
            border
            border-slate-800
            bg-[#0b111c]
            px-2.5 py-1.5
            text-xs
            font-semibold
            text-slate-400
            sm:self-auto
          "
        >
          {incidents.length}
        </span>
      </div>


      {incidents.length
        === 0
        ? (
            <div
              className="
                px-6 py-10
                text-center
              "
            >
              <div
                className="
                  mx-auto
                  flex h-11 w-11
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-800
                  bg-[#0b111c]
                  text-slate-600
                "
              >
                ○
              </div>

              <p
                className="
                  mt-4
                  text-sm
                  font-medium
                  text-slate-400
                "
              >
                No linked incident
              </p>

              <p
                className="
                  mx-auto
                  mt-1
                  max-w-md
                  text-xs
                  leading-5
                  text-slate-600
                "
              >
                This anomaly is currently
                an individual ML detection
                and has not been correlated
                into an incident.
              </p>
            </div>
          )
        : (
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
                      group
                      block w-full
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
                        grid gap-4
                        xl:grid-cols-[120px_1fr_130px_130px_42px]
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
                          "tracking-[0.12em]",

                          SEVERITY_STYLES[
                            incident.severity
                          ],
                        ].join(
                          " ",
                        )}
                      >
                        {
                          incident
                            .severity
                        }
                      </span>


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

                          <span
                            className="
                              rounded-md
                              border
                              border-slate-800
                              bg-[#0b111c]
                              px-2 py-0.5
                              text-[9px]
                              uppercase
                              tracking-[0.1em]
                              text-slate-600
                            "
                          >
                            {
                              incident
                                .status
                            }
                          </span>
                        </div>

                        <p
                          className="
                            mt-2
                            truncate
                            text-sm
                            font-medium
                            text-slate-200
                            transition-colors
                            group-hover:text-white
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
                            line-clamp-2
                            text-xs
                            leading-5
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
                            text-[9px]
                            uppercase
                            tracking-[0.12em]
                            text-slate-600
                          "
                        >
                          Correlated Events
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
                            text-[9px]
                            uppercase
                            tracking-[0.12em]
                            text-slate-600
                          "
                        >
                          Max Percentile
                        </p>

                        <p
                          className="
                            mt-1
                            text-sm
                            font-semibold
                            text-slate-300
                          "
                        >
                          {formatAnomalyPercent(
                            incident
                              .max_anomaly_score,
                            1,
                          )}
                        </p>

                        <p
                          className="
                            mt-1
                            text-[9px]
                            text-slate-700
                          "
                        >
                          {formatAnomalyTimestamp(
                            incident
                              .last_seen,
                          )}
                        </p>
                      </div>


                      <span
                        aria-hidden="true"
                        className="
                          hidden
                          h-9 w-9
                          items-center
                          justify-center
                          rounded-lg
                          border
                          border-slate-800
                          bg-[#0b111c]
                          text-sm
                          text-slate-500
                          transition-all
                          duration-200
                          group-hover:translate-x-1
                          group-hover:border-cyan-900/70
                          group-hover:bg-cyan-950/20
                          group-hover:text-cyan-300
                          xl:flex
                        "
                      >
                        →
                      </span>
                    </div>
                  </button>
                ),
              )}
            </div>
          )}
    </section>
  );
}


export default AnomalyLinkedIncidents;