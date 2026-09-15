import type {
  MLEventAnalysis,
} from "../../types/api";


interface AnomalyDetectorContextProps {
  analysis:
    MLEventAnalysis;
}


function AnomalyDetectorContext({
  analysis,
}: AnomalyDetectorContextProps) {
  return (
    <article
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
            Detector Context
          </p>

          <h3
            className="
              mt-1.5
              text-lg
              font-semibold
              text-white
            "
          >
            Isolation Forest Analysis
          </h3>
        </div>

        <span
          className="
            self-start
            rounded-lg
            border
            border-cyan-900/60
            bg-cyan-950/25
            px-2.5 py-1.5
            text-[10px]
            font-semibold
            text-cyan-300
            sm:self-auto
          "
        >
          v{
            analysis
              .detector_version
          }
        </span>
      </div>


      <p
        className="
          mt-4
          text-xs
          leading-5
          text-slate-500
        "
      >
        {
          analysis
            .explanation
            .summary
        }
      </p>


      <div
        className="
          mt-5
          grid gap-3
          sm:grid-cols-3
        "
      >
        <div
          className="
            rounded-xl
            border
            border-slate-800
            bg-[#0b111c]
            p-4
            transition-all
            duration-200
            hover:-translate-y-0.5
            hover:border-slate-700
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
            Raw Score
          </p>

          <p
            className="
              mt-2
              font-mono
              text-sm
              text-slate-300
            "
          >
            {
              analysis
                .raw_score
                .toFixed(
                  6,
                )
            }
          </p>
        </div>


        <div
          className="
            rounded-xl
            border
            border-slate-800
            bg-[#0b111c]
            p-4
            transition-all
            duration-200
            hover:-translate-y-0.5
            hover:border-slate-700
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
            Recorded Features
          </p>

          <p
            className="
              mt-2
              text-sm
              font-semibold
              text-slate-300
            "
          >
            {Object.keys(
              analysis
                .feature_snapshot,
            ).length}
          </p>
        </div>


        <div
          className="
            rounded-xl
            border
            border-slate-800
            bg-[#0b111c]
            p-4
            transition-all
            duration-200
            hover:-translate-y-0.5
            hover:border-slate-700
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
            Detector
          </p>

          <p
            className="
              mt-2
              text-sm
              font-semibold
              text-slate-300
            "
          >
            {
              analysis
                .detector_name
            }
          </p>
        </div>
      </div>
    </article>
  );
}


export default AnomalyDetectorContext;