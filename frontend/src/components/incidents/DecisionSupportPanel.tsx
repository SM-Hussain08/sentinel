import type {
  ContainmentAction,
} from "../../types/api";

import SectionHeader from "../shared/SectionHeader";


interface DecisionSupportPanelProps {
  analystQuestions: string[];
  containmentActions: ContainmentAction[];
}


function ContainmentCard({
  action,
}: {
  action: ContainmentAction;
}) {
  const immediate =
    action.urgency
      === "IMMEDIATE";

  return (
    <div
      className={[
        "rounded-xl border",
        "p-4",
        immediate
          ? (
            "border-red-900/55 "
            + "bg-red-950/15"
          )
          : (
            "border-orange-900/45 "
            + "bg-orange-950/10"
          ),
      ].join(" ")}
    >
      <div
        className="
          flex flex-wrap
          items-center
          justify-between
          gap-3
        "
      >
        <span
          className={[
            "rounded-full",
            "border px-2.5",
            "py-1",
            "text-[9px]",
            "font-semibold",
            "tracking-[0.12em]",
            immediate
              ? (
                "border-red-800/70 "
                + "bg-red-950/40 "
                + "text-red-300"
              )
              : (
                "border-orange-800/70 "
                + "bg-orange-950/30 "
                + "text-orange-300"
              ),
          ].join(" ")}
        >
          {action.urgency}
        </span>
      </div>

      <p
        className="
          mt-4 text-sm
          font-medium
          text-slate-100
        "
      >
        {action.action}
      </p>

      <p
        className="
          mt-2 text-xs
          leading-5
          text-slate-500
        "
      >
        {action.condition}
      </p>
    </div>
  );
}


function DecisionSupportPanel({
  analystQuestions,
  containmentActions,
}: DecisionSupportPanelProps) {
  return (
    <div
      className="
        grid gap-4
        xl:grid-cols-[1fr_0.85fr]
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
          eyebrow="Analyst Decision Support"
          title="Questions to Resolve"
        />

        <div
          className="
            mt-5 space-y-3
          "
        >
          {analystQuestions.map(
            (
              question,
              index,
            ) => (
              <div
                key={
                  question
                }
                className="
                  group flex
                  gap-3
                  rounded-xl
                  border
                  border-slate-800
                  bg-[#0b111c]
                  p-4
                  transition-all
                  duration-200
                  hover:border-cyan-900/45
                  hover:bg-[#111a28]
                "
              >
                <div
                  className="
                    mt-0.5
                    flex h-5 w-5
                    shrink-0
                    items-center
                    justify-center
                    rounded-md
                    border
                    border-slate-700
                    text-[9px]
                    text-slate-600
                    transition-colors
                    group-hover:border-cyan-800
                    group-hover:text-cyan-400
                  "
                >
                  {index + 1}
                </div>

                <p
                  className="
                    text-xs
                    leading-5
                    text-slate-400
                  "
                >
                  {question}
                </p>
              </div>
            ),
          )}
        </div>
      </article>

      <article
        className="
          rounded-2xl
          border
          border-red-950/45
          bg-[#101826]/90
          p-5
        "
      >
        <SectionHeader
          eyebrow="Response Guidance"
          title="Containment"
        />

        <p
          className="
            mt-3 text-xs
            leading-5
            text-slate-600
          "
        >
          Containment actions
          remain conditional on
          analyst validation of
          the incident evidence.
        </p>

        <div
          className="
            mt-5 space-y-3
          "
        >
          {containmentActions.map(
            (
              action,
              index,
            ) => (
              <ContainmentCard
                key={
                  `${action.action}-${index}`
                }
                action={
                  action
                }
              />
            ),
          )}
        </div>
      </article>
    </div>
  );
}


export default DecisionSupportPanel;