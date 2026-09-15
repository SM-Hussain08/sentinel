interface AnomalyStatCardProps {
  eyebrow: string;

  value: string;

  label: string;

  tone?:
    | "default"
    | "critical"
    | "cyan";
}


function AnomalyStatCard({
  eyebrow,
  value,
  label,
  tone = "default",
}: AnomalyStatCardProps) {
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
        hover:border-slate-600/70
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
          text-[10px]
          uppercase
          tracking-[0.16em]
          text-slate-500
        "
      >
        {eyebrow}
      </p>

      <p
        className={[
          "mt-4",
          "text-3xl",
          "font-semibold",
          "tracking-tight",
          "transition-transform",
          "duration-300",
          "group-hover:translate-x-0.5",

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
          mt-2
          text-sm
          text-slate-400
        "
      >
        {label}
      </p>
    </article>
  );
}


export default AnomalyStatCard;