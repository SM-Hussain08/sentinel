import {
  useNavigate,
} from "react-router-dom";

import type {
  IncidentTimelineEvent,
} from "../../types/api";

import SectionHeader from "../shared/SectionHeader";


interface IncidentTimelineProps {
  events: IncidentTimelineEvent[];
}


function formatTimestamp(
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
      second: "2-digit",
    },
  );
}


function formatEventType(
  value: string,
): string {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0)
        + word
          .slice(1)
          .toLowerCase(),
    )
    .join(" ");
}


function IncidentTimeline({
  events,
}: IncidentTimelineProps) {
  const navigate =
    useNavigate();


  function openAnomaly(
    eventId: string,
  ) {
    navigate(
      `/anomalies/${encodeURIComponent(
        eventId,
      )}`,
    );
  }


  return (
    <article
      className="
        rounded-2xl
        border border-slate-700/55
        bg-[#101826]/90
        p-5
      "
    >
      <SectionHeader
        eyebrow="Reconstruction"
        title="Incident Timeline"
        helper={`${events.length} correlated events`}
      />


      <div
        className="
          mt-6
          max-h-[720px]
          overflow-y-auto
          overscroll-contain
          pr-2
        "
      >
        {events.map(
          (
            event,
            index,
          ) => {
            const critical =
              event.risk_level
              === "CRITICAL";


            return (
              <div
                key={
                  event.event_id
                }
                className="
                  group
                  relative flex
                  gap-4 pb-5
                  last:pb-0
                "
              >
                {index
                  < events.length
                    - 1 && (
                    <div
                      className="
                        absolute
                        left-[15px]
                        top-8
                        bottom-0
                        w-px
                        bg-slate-800
                        transition-colors
                        duration-200
                        group-hover:bg-slate-700
                      "
                    />
                  )}


                <div
                  className={[
                    "relative z-10",
                    "flex h-8 w-8",
                    "shrink-0",
                    "items-center",
                    "justify-center",
                    "rounded-full",
                    "border",
                    "transition-all",
                    "duration-200",

                    critical
                      ? (
                          "border-red-900/60 "
                          + "bg-red-950/35 "
                          + "group-hover:border-red-800/80 "
                          + "group-hover:bg-red-950/50 "
                          + "group-hover:shadow-[0_0_14px_rgba(248,113,113,0.10)]"
                        )
                      : (
                          "border-slate-700 "
                          + "bg-[#0b111c] "
                          + "group-hover:border-cyan-900/70 "
                          + "group-hover:bg-cyan-950/20 "
                          + "group-hover:shadow-[0_0_14px_rgba(34,211,238,0.08)]"
                        ),
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-2 w-2",
                      "rounded-full",
                      "transition-all",
                      "duration-200",

                      critical
                        ? (
                            "bg-red-400 "
                            + "group-hover:scale-110"
                          )
                        : (
                            "bg-cyan-500 "
                            + "group-hover:scale-110 "
                            + "group-hover:bg-cyan-400"
                          ),
                    ].join(" ")}
                  />
                </div>


                <button
                  type="button"
                  onClick={() => {
                    openAnomaly(
                      event.event_id,
                    );
                  }}
                  className="
                    group/card
                    relative
                    min-w-0 flex-1
                    overflow-hidden
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    px-4 py-3
                    text-left
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:border-cyan-900/60
                    hover:bg-[#111a28]
                    hover:shadow-[0_10px_28px_rgba(0,0,0,0.14)]
                  "
                >
                  <div
                    className="
                      pointer-events-none
                      absolute
                      inset-y-0
                      left-0
                      w-[2px]
                      bg-cyan-400/0
                      transition-all
                      duration-200
                      group-hover/card:bg-cyan-400/50
                    "
                  />


                  <div
                    className="
                      flex flex-col
                      gap-2
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
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
                            transition-colors
                            duration-200
                            group-hover/card:text-cyan-300
                          "
                        >
                          {
                            event
                              .event_id
                          }
                        </span>


                        <span
                          className="
                            text-[10px]
                            uppercase
                            tracking-[0.1em]
                            text-slate-600
                            transition-colors
                            duration-200
                            group-hover/card:text-slate-500
                          "
                        >
                          {formatEventType(
                            event.event_type,
                          )}
                        </span>
                      </div>


                      <p
                        className="
                          mt-1
                          text-xs
                          text-slate-500
                          transition-colors
                          duration-200
                          group-hover/card:text-slate-400
                        "
                      >
                        {
                          event
                            .source_ip
                          ?? "—"
                        }

                        {" → "}

                        {
                          event
                            .destination_ip
                          ?? "—"
                        }
                      </p>
                    </div>


                    <div
                      className="
                        flex
                        shrink-0
                        items-center
                        gap-4
                      "
                    >
                      <div
                        className="
                          text-left
                          sm:text-right
                        "
                      >
                        <p
                          className="
                            text-xs
                            text-slate-400
                          "
                        >
                          {formatTimestamp(
                            event.timestamp,
                          )}
                        </p>


                        <p
                          className={[
                            "mt-1",
                            "text-[10px]",
                            "font-semibold",

                            critical
                              ? "text-red-300"
                              : "text-slate-600",
                          ].join(" ")}
                        >
                          Anomaly{" "}
                          {(
                            event
                              .anomaly_score
                            * 100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>


                      <span
                        aria-hidden="true"
                        className="
                          hidden
                          h-8 w-8
                          items-center
                          justify-center
                          rounded-lg
                          border
                          border-slate-800
                          bg-[#0a1019]
                          text-sm
                          text-slate-600
                          transition-all
                          duration-200
                          group-hover/card:translate-x-1
                          group-hover/card:border-cyan-900/70
                          group-hover/card:bg-cyan-950/20
                          group-hover/card:text-cyan-300
                          sm:flex
                        "
                      >
                        →
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          },
        )}
      </div>
    </article>
  );
}


export default IncidentTimeline;