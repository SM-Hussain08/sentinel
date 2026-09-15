interface OverviewMetricCardProps {
  eyebrow: string;

  value: string;

  label: string;

  helper: string;

  tone?:
    | "default"
    | "critical"
    | "cyan";
}


function OverviewMetricCard({
  eyebrow,
  value,
  label,
  helper,
  tone = "default",
}: OverviewMetricCardProps) {
  return (
    <article
      className={[
        "group relative",
        "overflow-hidden",
        "rounded-2xl border",
        "border-slate-700/55",
        "bg-[#101826]/90",
        "p-5",
        "shadow-[0_12px_35px_rgba(0,0,0,0.12)]",
        "transition-all duration-300",
        "hover:-translate-y-1",
        "hover:border-slate-600/70",
        "hover:bg-[#121c2b]",
        "hover:shadow-[0_18px_45px_rgba(0,0,0,0.2)]",
      ].join(
        " ",
      )}
    >
      <div
        className={[
          "absolute inset-x-0 top-0",
          "h-px",

          tone
            === "critical"
            ? (
                "bg-gradient-to-r "
                + "from-transparent "
                + "via-red-500 "
                + "to-transparent"
              )
            : tone
                === "cyan"
              ? (
                  "bg-gradient-to-r "
                  + "from-transparent "
                  + "via-cyan-400 "
                  + "to-transparent"
                )
              : (
                  "bg-gradient-to-r "
                  + "from-transparent "
                  + "via-slate-500/60 "
                  + "to-transparent"
                ),
        ].join(
          " ",
        )}
      />

      <p
        className="
          text-[10px]
          font-medium
          uppercase
          tracking-[0.17em]
          text-slate-500
        "
      >
        {eyebrow}
      </p>


      <div
        className="
          mt-4
          flex
          items-end
          justify-between
          gap-4
        "
      >
        <div>
          <p
            className={[
              "text-3xl",
              "font-semibold",
              "tracking-tight",

              tone
                === "critical"
                ? "text-red-300"
                : "text-white",
            ].join(
              " ",
            )}
          >
            {value}
          </p>

          <p
            className="
              mt-1
              text-sm
              font-medium
              text-slate-300
            "
          >
            {label}
          </p>
        </div>


        <div
          className={[
            "h-9 w-9",
            "rounded-xl border",
            "transition-all duration-300",
            "group-hover:scale-105",

            tone
              === "critical"
              ? (
                  "border-red-900/60 "
                  + "bg-red-950/30"
                )
              : tone
                  === "cyan"
                ? (
                    "border-cyan-900/60 "
                    + "bg-cyan-950/30"
                  )
                : (
                    "border-slate-700/70 "
                    + "bg-slate-900/70"
                  ),
          ].join(
            " ",
          )}
        />
      </div>


      <p
        className="
          mt-4
          text-xs
          leading-5
          text-slate-500
        "
      >
        {helper}
      </p>
    </article>
  );
}


export default OverviewMetricCard;