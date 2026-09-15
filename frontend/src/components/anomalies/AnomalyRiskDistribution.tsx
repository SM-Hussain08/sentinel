import type {
  MLSummary,
  MLRiskLevel,
} from "../../types/api";

import {
  ANOMALY_RISK_STYLES,
} from "./anomalyStyles";

import {
  formatAnomalyNumber,
  formatAnomalyPercent,
} from "./anomalyFormatters";


interface AnomalyRiskDistributionProps {
  summary:
    MLSummary | null;
}


function AnomalyRiskDistribution({
  summary,
}: AnomalyRiskDistributionProps) {
  const total =
    summary
      ?.events_scored
    || 1;


  const values:
    Array<{
      risk:
        MLRiskLevel;

      count:
        number;
    }> =
      summary
        ? [
            {
              risk:
                "CRITICAL",

              count:
                summary
                  .risk_distribution
                  .critical,
            },

            {
              risk:
                "HIGH",

              count:
                summary
                  .risk_distribution
                  .high,
            },

            {
              risk:
                "MEDIUM",

              count:
                summary
                  .risk_distribution
                  .medium,
            },

            {
              risk:
                "LOW",

              count:
                summary
                  .risk_distribution
                  .low,
            },

            {
              risk:
                "NORMAL",

              count:
                summary
                  .risk_distribution
                  .normal,
            },
          ]
        : [];


  return (
    <section
      className="
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
        p-5
      "
    >
      <div
        className="
          flex flex-col
          gap-3
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
            Behavioral Population
          </p>

          <h2
            className="
              mt-1.5
              text-lg
              font-semibold
              text-white
            "
          >
            Risk Distribution
          </h2>
        </div>

        <p
          className="
            text-xs
            text-slate-600
          "
        >
          Historical anomaly percentiles,
          not attack probabilities
        </p>
      </div>


      <div
        className="
          mt-6
          grid gap-4
          lg:grid-cols-5
        "
      >
        {values.map(
          ({
            risk,
            count,
          }) => {
            const percentage =
              count / total;

            return (
              <div
                key={
                  risk
                }
                className={[
                  "group",
                  "rounded-xl",
                  "border",
                  "border-slate-800",
                  "bg-[#0b111c]",
                  "p-4",
                  "transition-all",
                  "duration-200",
                  "hover:-translate-y-0.5",
                  "hover:bg-[#111a28]",

                  ANOMALY_RISK_STYLES[
                    risk
                  ].hover,
                ].join(
                  " ",
                )}
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-2
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <span
                      className={[
                        "h-2 w-2",
                        "rounded-full",

                        ANOMALY_RISK_STYLES[
                          risk
                        ].dot,
                      ].join(
                        " ",
                      )}
                    />

                    <span
                      className="
                        text-[10px]
                        font-semibold
                        tracking-[0.1em]
                        text-slate-400
                      "
                    >
                      {risk}
                    </span>
                  </div>

                  <span
                    className="
                      text-xs
                      font-semibold
                      text-slate-300
                    "
                  >
                    {formatAnomalyNumber(
                      count,
                    )}
                  </span>
                </div>


                <div
                  className="
                    mt-4
                    h-1.5
                    overflow-hidden
                    rounded-full
                    bg-slate-800
                  "
                >
                  <div
                    className={[
                      "h-full",
                      "rounded-full",

                      ANOMALY_RISK_STYLES[
                        risk
                      ].bar,
                    ].join(
                      " ",
                    )}
                    style={{
                      width:
                        `${Math.max(
                          percentage
                          * 100,

                          percentage
                            > 0
                            ? 1
                            : 0,
                        )}%`,
                    }}
                  />
                </div>

                <p
                  className="
                    mt-3
                    text-xs
                    text-slate-600
                  "
                >
                  {formatAnomalyPercent(
                    percentage,
                  )}
                  {" "}
                  of scored events
                </p>
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}


export default AnomalyRiskDistribution;