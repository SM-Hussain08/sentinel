import type {
  IncidentIndicator,
} from "../../types/api";

import SectionHeader from "../shared/SectionHeader";

import {
  SEVERITY_STYLES,
} from "./incidentStyles";


interface IncidentIndicatorsProps {
  indicators: IncidentIndicator[];
}


function formatIndicatorValue(
  value: unknown,
): string {
  if (
    typeof value
    === "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  if (
    typeof value
      === "number"
    && value
      >= 1_000_000_000
  ) {
    return `${(
      value
      / 1_000_000_000
    ).toFixed(2)} GB`;
  }

  if (
    typeof value
      === "number"
    && value
      >= 1_000_000
  ) {
    return `${(
      value
      / 1_000_000
    ).toFixed(2)} MB`;
  }

  if (
    value === null
    || value === undefined
  ) {
    return "—";
  }

  return String(
    value,
  );
}


function IndicatorCard({
  indicator,
}: {
  indicator: IncidentIndicator;
}) {
  const severity =
    indicator.severity;

  return (
    <div
      className={[
        "group rounded-xl",
        "border bg-[#0b111c]",
        "p-4",
        "transition-all",
        "duration-200",
        "hover:-translate-y-0.5",
        "hover:bg-[#111a28]",
        SEVERITY_STYLES[
          severity
        ].border,
      ].join(" ")}
    >
      <div
        className="
          flex items-center
          justify-between
          gap-3
        "
      >
        <span
          className={[
            "h-2 w-2",
            "rounded-full",
            SEVERITY_STYLES[
              severity
            ].dot,
          ].join(" ")}
        />

        <span
          className={[
            "text-[9px]",
            "font-semibold",
            "uppercase",
            "tracking-[0.12em]",
            SEVERITY_STYLES[
              severity
            ].text,
          ].join(" ")}
        >
          {severity}
        </span>
      </div>

      <p
        className="
          mt-4 text-xs
          leading-5
          text-slate-500
        "
      >
        {indicator.label}
      </p>

      <p
        className="
          mt-1.5 text-xl
          font-semibold
          text-slate-100
        "
      >
        {formatIndicatorValue(
          indicator.value,
        )}
      </p>
    </div>
  );
}


function IncidentIndicators({
  indicators,
}: IncidentIndicatorsProps) {
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
        eyebrow="Evidence"
        title="Key Indicators"
        helper={`${indicators.length} correlated signals`}
      />

      <div
        className="
          mt-5 grid gap-3
          sm:grid-cols-2
          xl:grid-cols-3
        "
      >
        {indicators.map(
          (
            indicator,
            index,
          ) => (
            <IndicatorCard
              key={
                `${indicator.type}-${index}`
              }
              indicator={
                indicator
              }
            />
          ),
        )}
      </div>
    </article>
  );
}


export default IncidentIndicators;