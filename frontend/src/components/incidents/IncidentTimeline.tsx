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
                    critical
                      ? (
                        "border-red-900/60 "
                        + "bg-red-950/35"
                      )
                      : (
                        "border-slate-700 "
                        + "bg-[#0b111c]"
                      ),
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-2 w-2",
                      "rounded-full",
                      critical
                        ? "bg-red-400"
                        : "bg-cyan-500",
                    ].join(" ")}
                  />
                </div>

                <div
                  className="
                    min-w-0 flex-1
                    rounded-xl
                    border
                    border-slate-800
                    bg-[#0b111c]
                    px-4 py-3
                    transition-all
                    duration-200
                    hover:border-slate-700
                    hover:bg-[#111a28]
                  "
                >
                  <div
                    className="
                      flex flex-col
                      gap-2
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
                    <div>
                      <div
                        className="
                          flex flex-wrap
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
                          "
                        >
                          {formatEventType(
                            event.event_type,
                          )}
                        </span>
                      </div>

                      <p
                        className="
                          mt-1 text-xs
                          text-slate-500
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
                          "mt-1 text-[10px]",
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
                  </div>
                </div>
              </div>
            );
          },
        )}
      </div>
    </article>
  );
}


export default IncidentTimeline;