import type {
  IncidentInvestigation,
  IncidentSeverity,
  InvestigationFinding,
  InvestigationStep,
} from "../../types/api";

import SectionHeader from "../shared/SectionHeader";

import SeverityBadge from "./SeverityBadge";

import {
  SEVERITY_STYLES,
} from "./incidentStyles";


interface InvestigationPanelProps {
  investigation: IncidentInvestigation;
  severity: IncidentSeverity;
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


function FindingCard({
  finding,
}: {
  finding: InvestigationFinding;
}) {
  return (
    <div
      className="
        rounded-xl
        border border-slate-800
        bg-[#0b111c]
        p-4
        transition-all
        duration-200
        hover:border-slate-700
        hover:bg-[#111a28]
      "
    >
      <div
        className="
          flex items-center
          justify-between
          gap-3
        "
      >
        <p
          className="
            text-[9px]
            uppercase
            tracking-[0.13em]
            text-cyan-500
          "
        >
          {finding.category}
        </p>

        <span
          className="
            text-[9px]
            font-semibold
            tracking-[0.1em]
            text-slate-600
          "
        >
          {finding.confidence}
        </span>
      </div>

      <p
        className="
          mt-3 text-sm
          font-medium
          text-slate-200
        "
      >
        {finding.finding}
      </p>

      <p
        className="
          mt-2 text-xs
          text-slate-500
        "
      >
        Observed value:
        {" "}

        <span
          className="
            font-medium
            text-slate-300
          "
        >
          {formatIndicatorValue(
            finding.value,
          )}
        </span>
      </p>
    </div>
  );
}


function InvestigationStepCard({
  step,
}: {
  step: InvestigationStep;
}) {
  return (
    <div
      className="
        group flex
        gap-4 rounded-xl
        border border-slate-800
        bg-[#0b111c]
        p-4
        transition-all
        duration-200
        hover:border-cyan-900/50
        hover:bg-[#111a28]
      "
    >
      <div
        className="
          flex h-8 w-8
          shrink-0 items-center
          justify-center
          rounded-full
          border border-cyan-900/60
          bg-cyan-950/30
          text-xs font-semibold
          text-cyan-300
          transition-transform
          duration-200
          group-hover:scale-105
        "
      >
        {step.priority}
      </div>

      <div>
        <p
          className="
            text-sm font-medium
            text-slate-200
          "
        >
          {step.action}
        </p>

        <p
          className="
            mt-1.5 text-xs
            leading-5
            text-slate-500
          "
        >
          {step.reason}
        </p>
      </div>
    </div>
  );
}


function InvestigationPanel({
  investigation,
  severity,
}: InvestigationPanelProps) {
  return (
    <>
      <div
        className="
          grid gap-4
          xl:grid-cols-[1fr_0.8fr]
        "
      >
        <article
          className="
            rounded-2xl
            border
            border-slate-700/55
            bg-[#101826]/90
            p-5
          "
        >
          <SectionHeader
            eyebrow="Investigation Intelligence"
            title="Key Findings"
            helper={`${investigation.key_findings.length} findings`}
          />

          <div
            className="
              mt-5 grid gap-3
              sm:grid-cols-2
            "
          >
            {investigation
              .key_findings
              .map(
                (
                  finding,
                  index,
                ) => (
                  <FindingCard
                    key={
                      `${finding.category}-${index}`
                    }
                    finding={
                      finding
                    }
                  />
                ),
              )}
          </div>
        </article>

        <article
          className={[
            "rounded-2xl",
            "border p-5",
            "bg-[#101826]/90",
            SEVERITY_STYLES[
              severity
            ].border,
          ].join(" ")}
        >
          <SectionHeader
            eyebrow="Assessment"
            title="Severity Rationale"
          />

          <div
            className="
              mt-5
            "
          >
            <SeverityBadge
              severity={
                severity
              }
            />

            <p
              className="
                mt-4 text-sm
                leading-7
                text-slate-300
              "
            >
              {
                investigation
                  .severity_rationale
              }
            </p>

            <div
              className="
                mt-5 rounded-xl
                border border-slate-800
                bg-[#0b111c]
                p-4
              "
            >
              <p
                className="
                  text-[9px]
                  uppercase
                  tracking-[0.13em]
                  text-slate-600
                "
              >
                Intelligence Source
              </p>

              <p
                className="
                  mt-2 text-xs
                  leading-5
                  text-slate-400
                "
              >
                Multi-signal correlation
                with structured
                deterministic investigation
                intelligence.
              </p>
            </div>
          </div>
        </article>
      </div>

      <article
        className="
          rounded-2xl
          border
          border-slate-700/55
          bg-[#101826]/90
          p-5
        "
      >
        <SectionHeader
          eyebrow="Analyst Workflow"
          title="Recommended Investigation"
          helper="Prioritized response sequence"
        />

        <div
          className="
            mt-5 grid gap-3
          "
        >
          {investigation
            .investigation_steps
            .map(
              (step) => (
                <InvestigationStepCard
                  key={
                    step.priority
                  }
                  step={
                    step
                  }
                />
              ),
            )}
        </div>
      </article>
    </>
  );
}


export default InvestigationPanel;