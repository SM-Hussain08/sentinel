interface AnomalyDetailKpiCardProps {
  eyebrow: string;

  value: string;

  label: string;

  tone?:
    | "default"
    | "cyan"
    | "critical";
}


function AnomalyDetailKpiCard({
  eyebrow,
  value,
  label,
  tone = "default",
}: AnomalyDetailKpiCardProps) {
  return (
    <article
      className="
        group relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
        p-5
        shadow-[0_10px_30px_rgba(0,0,0,0.10)]
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-slate-600/75
        hover:bg-[#121c2b]
        hover:shadow-[0_16px_42px_rgba(0,0,0,0.16)]
      "
    >
      <div
        className={[
          "absolute",
          "inset-x-0",
          "top-0",
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
                  + "via-slate-500/50 "
                  + "to-transparent"
                ),
        ].join(
          " ",
        )}
      />

      <p
        className="
          text-[9px]
          font-medium
          uppercase
          tracking-[0.16em]
          text-slate-600
        "
      >
        {eyebrow}
      </p>

      <p
        className={[
          "mt-3",
          "truncate",
          "text-2xl",
          "font-semibold",
          "tracking-tight",
          "transition-transform",
          "duration-300",
          "group-hover:translate-x-0.5",

          tone
            === "critical"
            ? "text-red-300"
            : tone
                === "cyan"
              ? "text-cyan-300"
              : "text-white",
        ].join(
          " ",
        )}
        title={
          value
        }
      >
        {value}
      </p>

      <p
        className="
          mt-2
          text-xs
          leading-5
          text-slate-500
        "
      >
        {label}
      </p>
    </article>
  );
}


export default AnomalyDetailKpiCard;