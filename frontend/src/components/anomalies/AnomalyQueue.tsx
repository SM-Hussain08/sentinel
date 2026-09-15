import type {
  MLAnomaly,
} from "../../types/api";

import AnomalyRiskBadge from "./AnomalyRiskBadge";

import {
  ANOMALY_RISK_STYLES,
} from "./anomalyStyles";

import {
  formatAnomalyNumber,
  formatAnomalyPercent,
  formatAnomalyTimestamp,
  formatAnomalyEventType,
} from "./anomalyFormatters";


interface AnomalyQueueProps {
  anomalies:
    MLAnomaly[];

  totalResults:
    number;

  currentOffset:
    number;

  hasPrevious:
    boolean;

  hasNext:
    boolean;

  onOpenAnomaly: (
    eventId:
      string,
  ) => void;

  onPrevious:
    () => void;

  onNext:
    () => void;
}


function AnomalyQueue({
  anomalies,
  totalResults,
  currentOffset,
  hasPrevious,
  hasNext,
  onOpenAnomaly,
  onPrevious,
  onNext,
}: AnomalyQueueProps) {
  const showingFrom =
    totalResults
      === 0
      ? 0
      : currentOffset
        + 1;

  const showingTo =
    Math.min(
      currentOffset
      + anomalies.length,

      totalResults,
    );


  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
        shadow-[0_14px_38px_rgba(0,0,0,0.12)]
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
              text-slate-600
            "
          >
            Ranked Intelligence
          </p>

          <h2
            className="
              mt-1
              text-lg
              font-semibold
              text-white
            "
          >
            Behavioral Anomalies
          </h2>
        </div>

        <div
          className="
            flex
            items-center
            gap-2
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
              border
              border-slate-800
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
            {formatAnomalyNumber(
              totalResults,
            )}
          </span>
        </div>
      </div>


      <div
        className="
          max-h-[760px]
          overflow-y-auto
          overscroll-contain
        "
      >
        {anomalies.map(
          (anomaly) => (
            <button
              key={
                anomaly.score_id
              }
              type="button"
              onClick={() => {
                onOpenAnomaly(
                  anomaly.event_id,
                );
              }}
              className={[
                "group",
                "relative",
                "block",
                "w-full",
                "border-b",
                "border-slate-800/70",
                "px-5 py-4",
                "text-left",
                "transition-all",
                "duration-200",
                "last:border-b-0",
                "hover:bg-[#141e2d]",
                "hover:shadow-[inset_3px_0_0_rgba(34,211,238,0.30)]",

                ANOMALY_RISK_STYLES[
                  anomaly.risk_level
                ].hover,
              ].join(
                " ",
              )}
            >
              <div
                className="
                  grid gap-3
                  lg:grid-cols-[120px_1fr_140px_150px_42px]
                  lg:items-center
                "
              >
                <AnomalyRiskBadge
                  risk={
                    anomaly.risk_level
                  }
                />


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
                        anomaly.event_id
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
                      {formatAnomalyEventType(
                        anomaly.event_type,
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
                      group-hover:text-slate-400
                    "
                  >
                    {
                      anomaly
                        .employee_user_id
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
                    Percentile
                  </p>

                  <p
                    className={[
                      "mt-1",
                      "text-sm",
                      "font-semibold",

                      ANOMALY_RISK_STYLES[
                        anomaly.risk_level
                      ].text,
                    ].join(
                      " ",
                    )}
                  >
                    {formatAnomalyPercent(
                      anomaly.anomaly_score,
                      1,
                    )}
                  </p>
                </div>


                <p
                  className="
                    text-xs
                    text-slate-500
                  "
                >
                  {formatAnomalyTimestamp(
                    anomaly.timestamp,
                  )}
                </p>


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
                    lg:flex
                  "
                >
                  →
                </span>
              </div>
            </button>
          ),
        )}


        {anomalies.length
          === 0 && (
          <div
            className="
              px-6 py-16
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
                text-lg
                text-slate-600
              "
            >
              ⌕
            </div>

            <p
              className="
                mt-4
                text-sm
                font-medium
                text-slate-400
              "
            >
              No anomalies found
            </p>

            <p
              className="
                mt-1
                text-xs
                text-slate-600
              "
            >
              Adjust the search or
              risk-level filter.
            </p>
          </div>
        )}
      </div>


      <div
        className="
          flex
          flex-col
          gap-3
          border-t
          border-slate-800
          px-5 py-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <p
          className="
            text-xs
            text-slate-600
          "
        >
          Showing
          {" "}
          {showingFrom}
          {"–"}
          {showingTo}
          {" of "}
          {formatAnomalyNumber(
            totalResults,
          )}
        </p>


        <div
          className="
            flex gap-2
          "
        >
          <button
            type="button"
            disabled={
              !hasPrevious
            }
            onClick={
              onPrevious
            }
            className="
              rounded-lg
              border
              border-slate-800
              bg-[#0b111c]
              px-3 py-2
              text-xs
              text-slate-400
              transition-all
              duration-200
              hover:-translate-y-0.5
              hover:border-cyan-900/60
              hover:text-cyan-300
              disabled:cursor-not-allowed
              disabled:opacity-35
              disabled:hover:translate-y-0
              disabled:hover:border-slate-800
              disabled:hover:text-slate-400
            "
          >
            ← Previous
          </button>

          <button
            type="button"
            disabled={
              !hasNext
            }
            onClick={
              onNext
            }
            className="
              rounded-lg
              border
              border-slate-800
              bg-[#0b111c]
              px-3 py-2
              text-xs
              text-slate-400
              transition-all
              duration-200
              hover:-translate-y-0.5
              hover:border-cyan-900/60
              hover:text-cyan-300
              disabled:cursor-not-allowed
              disabled:opacity-35
              disabled:hover:translate-y-0
              disabled:hover:border-slate-800
              disabled:hover:text-slate-400
            "
          >
            Next →
          </button>
        </div>
      </div>
    </section>
  );
}


export default AnomalyQueue;