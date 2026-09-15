import type {
  MLEventAnalysis,
} from "../../types/api";

import {
  getAnomalyNumberFeature,
} from "./anomalyFormatters";


interface SignalCardProps {
  label:
    string;

  value:
    string;

  warning?:
    boolean;
}


function SignalCard({
  label,
  value,
  warning = false,
}: SignalCardProps) {
  return (
    <div
      className={[
        "rounded-xl",
        "border",
        "p-4",
        "transition-all",
        "duration-200",
        "hover:-translate-y-0.5",

        warning
          ? (
              "border-red-900/55 "
              + "bg-red-950/15 "
              + "hover:border-red-800/65"
            )
          : (
              "border-slate-800 "
              + "bg-[#0b111c] "
              + "hover:border-slate-700 "
              + "hover:bg-[#111a28]"
            ),
      ].join(
        " ",
      )}
    >
      <p
        className="
          text-[9px]
          uppercase
          tracking-[0.13em]
          text-slate-600
        "
      >
        {label}
      </p>

      <p
        className={[
          "mt-2",
          "text-lg",
          "font-semibold",

          warning
            ? "text-red-300"
            : "text-slate-100",
        ].join(
          " ",
        )}
      >
        {value}
      </p>
    </div>
  );
}


interface AnomalyFeatureSignalsProps {
  analysis:
    MLEventAnalysis;
}


function AnomalyFeatureSignals({
  analysis,
}: AnomalyFeatureSignalsProps) {
  const failedLogins =
    getAnomalyNumberFeature(
      analysis,
      "failed_logins_10m",
    );

  const uniqueDestinations =
    getAnomalyNumberFeature(
      analysis,
      "unique_destinations_5m",
    );

  const outsideWorkHours =
    getAnomalyNumberFeature(
      analysis,
      "outside_work_hours",
    );

  const sourceIpIsBaseline =
    getAnomalyNumberFeature(
      analysis,
      "source_ip_is_baseline",
    );

  const dataVolumeRatio =
    getAnomalyNumberFeature(
      analysis,
      "data_volume_ratio",
    );


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
      <p
        className="
          text-[10px]
          uppercase
          tracking-[0.17em]
          text-slate-600
        "
      >
        Behavioral Evidence
      </p>

      <h3
        className="
          mt-1.5
          text-lg
          font-semibold
          text-white
        "
      >
        Feature Signals
      </h3>

      <p
        className="
          mt-2
          text-xs
          leading-5
          text-slate-600
        "
      >
        Observable feature values used
        to contextualize this detection.
      </p>


      <div
        className="
          mt-5
          grid
          grid-cols-1
          gap-3
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <SignalCard
          label="Failed Logins / 10m"
          value={String(
            failedLogins
            ?? "—",
          )}
          warning={
            (
              failedLogins
              ?? 0
            ) > 0
          }
        />

        <SignalCard
          label="Events / 5m"
          value={String(
            getAnomalyNumberFeature(
              analysis,
              "events_5m",
            )
            ?? "—",
          )}
        />

        <SignalCard
          label="Network Events / 5m"
          value={String(
            getAnomalyNumberFeature(
              analysis,
              "network_events_5m",
            )
            ?? "—",
          )}
        />

        <SignalCard
          label="Unique Destinations"
          value={String(
            uniqueDestinations
            ?? "—",
          )}
          warning={
            (
              uniqueDestinations
              ?? 0
            ) >= 10
          }
        />

        <SignalCard
          label="Outside Work Hours"
          value={
            outsideWorkHours
              === 1
              ? "YES"
              : "NO"
          }
          warning={
            outsideWorkHours
            === 1
          }
        />

        <SignalCard
          label="Baseline Source IP"
          value={
            sourceIpIsBaseline
              === 1
              ? "YES"
              : "NO"
          }
          warning={
            sourceIpIsBaseline
            === 0
          }
        />

        <SignalCard
          label="File Events / 30m"
          value={String(
            getAnomalyNumberFeature(
              analysis,
              "file_events_30m",
            )
            ?? "—",
          )}
        />

        <SignalCard
          label="Data Volume Ratio"
          value={
            dataVolumeRatio
              !== null
              ? dataVolumeRatio
                  .toFixed(
                    4,
                  )
              : "—"
          }
        />
      </div>
    </article>
  );
}


export default AnomalyFeatureSignals;