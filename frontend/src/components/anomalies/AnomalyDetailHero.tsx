import type {
  MLEventAnalysis,
  MLModelInfo,
} from "../../types/api";

import AnomalyRiskBadge from "./AnomalyRiskBadge";

import {
  ANOMALY_RISK_STYLES,
} from "./anomalyStyles";

import {
  formatAnomalyEventType,
  formatAnomalyPercent,
  formatAnomalyTimestamp,
} from "./anomalyFormatters";


interface AnomalyDetailHeroProps {
  analysis:
    MLEventAnalysis;

  model:
    MLModelInfo | null;
}


function AnomalyDetailHero({
  analysis,
  model,
}: AnomalyDetailHeroProps) {
  return (
    <article
      className={[
        "group",
        "relative",
        "overflow-hidden",
        "rounded-2xl",
        "border",
        "bg-[#101826]/90",
        "p-5",
        "shadow-[0_12px_35px_rgba(0,0,0,0.12)]",
        "transition-all",
        "duration-300",

        ANOMALY_RISK_STYLES[
          analysis.risk_level
        ].border,
      ].join(
        " ",
      )}
    >
      <div
        className="
          pointer-events-none
          absolute
          right-[-100px]
          top-[-120px]
          h-72 w-72
          rounded-full
          bg-cyan-400/[0.025]
          blur-[100px]
        "
      />


      <div
        className="
          relative
        "
      >
        <div
          className="
            flex
            flex-col
            gap-4
            sm:flex-row
            sm:items-start
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                font-mono
                text-[10px]
                text-cyan-400
              "
            >
              {analysis.event_id}
            </p>

            <h2
              className="
                mt-2
                text-2xl
                font-semibold
                tracking-tight
                text-white
              "
            >
              {formatAnomalyEventType(
                analysis.event_type,
              )}
            </h2>

            <p
              className="
                mt-1
                text-xs
                text-slate-600
              "
            >
              {
                analysis
                  .employee_user_id
              }

              {" · "}

              {formatAnomalyTimestamp(
                analysis.timestamp,
              )}
            </p>
          </div>

          <AnomalyRiskBadge
            risk={
              analysis.risk_level
            }
          />
        </div>


        <div
          className="
            mt-6
          "
        >
          <div
            className="
              flex
              flex-col
              gap-3
              sm:flex-row
              sm:items-end
              sm:justify-between
            "
          >
            <div>
              <p
                className="
                  text-[9px]
                  uppercase
                  tracking-[0.13em]
                  text-slate-600
                "
              >
                Anomaly Percentile
              </p>

              <p
                className={[
                  "mt-1",
                  "text-4xl",
                  "font-semibold",

                  ANOMALY_RISK_STYLES[
                    analysis.risk_level
                  ].text,
                ].join(
                  " ",
                )}
              >
                {formatAnomalyPercent(
                  analysis.anomaly_score,
                  1,
                )}
              </p>
            </div>

            <p
              className="
                text-xs
                text-slate-600
              "
            >
              threshold
              {" "}

              {model
                ? formatAnomalyPercent(
                    model
                      .threshold_percentile,
                    0,
                  )
                : "99%"}
            </p>
          </div>


          <div
            className="
              mt-4
              h-2
              overflow-hidden
              rounded-full
              bg-slate-800
            "
          >
            <div
              className={[
                "h-full",
                "rounded-full",
                "transition-[width]",
                "duration-500",

                ANOMALY_RISK_STYLES[
                  analysis.risk_level
                ].bar,
              ].join(
                " ",
              )}
              style={{
                width:
                  `${analysis.anomaly_score * 100}%`,
              }}
            />
          </div>


          <p
            className="
              mt-4
              max-w-3xl
              text-xs
              leading-5
              text-slate-500
            "
          >
            Historical anomaly percentile
            relative to the model&apos;s
            learned normal baseline. This
            value is not an attack
            probability.
          </p>
        </div>
      </div>
    </article>
  );
}


export default AnomalyDetailHero;