import type {
  MLEventAnalysis,
} from "../../types/api";


interface AnomalyExplanationProps {
  analysis:
    MLEventAnalysis;
}


function AnomalyExplanation({
  analysis,
}: AnomalyExplanationProps) {
  const {
    explanation,
  } = analysis;


  const scoreInterpretation =
    typeof explanation
      .score_interpretation
      === "string"
      ? explanation
          .score_interpretation
      : null;


  const threshold =
    typeof explanation
      .alert_threshold
      === "number"
      ? explanation
          .alert_threshold
      : null;


  const thresholdReached =
    typeof explanation
      .alert_threshold_reached
      === "boolean"
      ? explanation
          .alert_threshold_reached
      : analysis
          .alert_threshold_reached;


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
          flex
          flex-col
          gap-3
          sm:flex-row
          sm:items-start
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
            Detection Interpretation
          </p>

          <h2
            className="
              mt-1.5
              text-lg
              font-semibold
              text-white
            "
          >
            Why This Event Was Ranked
          </h2>
        </div>


        <span
          className={[
            "self-start",
            "rounded-full",
            "border",
            "px-2.5 py-1",
            "text-[9px]",
            "font-semibold",
            "tracking-[0.11em]",

            thresholdReached
              ? (
                  "border-red-800/65 "
                  + "bg-red-950/30 "
                  + "text-red-300"
                )
              : (
                  "border-slate-700 "
                  + "bg-slate-800/60 "
                  + "text-slate-400"
                ),
          ].join(
            " ",
          )}
        >
          {thresholdReached
            ? "ALERT THRESHOLD REACHED"
            : "BELOW ALERT THRESHOLD"}
        </span>
      </div>


      <div
        className="
          mt-5
          rounded-xl
          border
          border-slate-800
          bg-[#0b111c]
          p-4
        "
      >
        <p
          className="
            text-xs
            leading-6
            text-slate-400
          "
        >
          {
            explanation
              .summary
          }
        </p>
      </div>


      <div
        className="
          mt-4
          grid gap-3
          md:grid-cols-2
        "
      >
        <div
          className="
            rounded-xl
            border
            border-slate-800
            bg-[#0b111c]
            p-4
          "
        >
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.12em]
              text-slate-600
            "
          >
            Score Interpretation
          </p>

          <p
            className="
              mt-2
              text-xs
              leading-5
              text-slate-400
            "
          >
            {scoreInterpretation
              ?? (
                "The anomaly score is a "
                + "historical percentile "
                + "relative to the learned "
                + "normal baseline, not an "
                + "attack probability."
              )}
          </p>
        </div>


        <div
          className="
            rounded-xl
            border
            border-slate-800
            bg-[#0b111c]
            p-4
          "
        >
          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.12em]
              text-slate-600
            "
          >
            Detector Decision
          </p>

          <p
            className="
              mt-2
              text-xs
              leading-5
              text-slate-400
            "
          >
            {thresholdReached
              ? (
                  "The event crossed the "
                  + "configured critical "
                  + "alert boundary."
                )
              : (
                  "The event was scored by "
                  + "the detector but did not "
                  + "cross the configured "
                  + "critical alert boundary."
                )}
          </p>

          {threshold !== null && (
            <p
              className="
                mt-2
                font-mono
                text-[10px]
                text-cyan-700
              "
            >
              Recorded threshold:
              {" "}
              {threshold}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}


export default AnomalyExplanation;