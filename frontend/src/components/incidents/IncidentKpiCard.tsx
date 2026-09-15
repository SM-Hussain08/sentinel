interface IncidentKpiCardProps {
  label: string;
  value: number;
  helper: string;
  accent?: "cyan" | "red" | "orange" | "emerald";
}


const ACCENT_STYLES = {
  cyan: {
    dot: "bg-cyan-400",
    value: "text-cyan-100",
    hover:
      "hover:border-cyan-800/70 hover:shadow-[0_16px_45px_rgba(34,211,238,0.07)]",
  },

  red: {
    dot: "bg-red-400",
    value: "text-red-100",
    hover:
      "hover:border-red-900/70 hover:shadow-[0_16px_45px_rgba(248,113,113,0.06)]",
  },

  orange: {
    dot: "bg-orange-400",
    value: "text-orange-100",
    hover:
      "hover:border-orange-900/70 hover:shadow-[0_16px_45px_rgba(251,146,60,0.06)]",
  },

  emerald: {
    dot: "bg-emerald-400",
    value: "text-emerald-100",
    hover:
      "hover:border-emerald-900/70 hover:shadow-[0_16px_45px_rgba(52,211,153,0.06)]",
  },
};


function IncidentKpiCard({
  label,
  value,
  helper,
  accent = "cyan",
}: IncidentKpiCardProps) {
  const styles =
    ACCENT_STYLES[accent];

  return (
    <article
      className={[
        "group relative overflow-hidden",
        "rounded-2xl",
        "border border-slate-800/90",
        "bg-[#101826]/90",
        "px-5 py-5",
        "shadow-[0_10px_30px_rgba(0,0,0,0.12)]",
        "transition-all duration-300",
        "hover:-translate-y-1",
        "hover:bg-[#121c2b]",
        styles.hover,
      ].join(" ")}
    >
      <div
        className="
          pointer-events-none
          absolute inset-x-0 top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-slate-500/15
          to-transparent
          opacity-0
          transition-opacity duration-300
          group-hover:opacity-100
        "
      />

      <div
        className="
          flex items-center gap-2
        "
      >
        <span
          className={[
            "h-1.5 w-1.5",
            "rounded-full",
            styles.dot,
            "shadow-[0_0_10px_currentColor]",
          ].join(" ")}
        />

        <p
          className="
            text-[10px]
            font-semibold uppercase
            tracking-[0.15em]
            text-slate-500
          "
        >
          {label}
        </p>
      </div>

      <p
        className={[
          "mt-4",
          "text-3xl font-semibold",
          "tracking-tight",
          styles.value,
          "transition-transform duration-300",
          "group-hover:translate-x-0.5",
        ].join(" ")}
      >
        {value.toLocaleString()}
      </p>

      <p
        className="
          mt-2
          text-xs leading-5
          text-slate-600
        "
      >
        {helper}
      </p>
    </article>
  );
}


export default IncidentKpiCard;