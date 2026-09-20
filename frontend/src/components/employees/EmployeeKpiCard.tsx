interface EmployeeKpiCardProps {
  label: string;

  value:
    | number
    | string;

  description: string;

  accent:
    | "cyan"
    | "red"
    | "amber"
    | "violet";
}


const ACCENT_STYLES = {
  cyan: {
    bar:
      "bg-cyan-400",

    value:
      "text-cyan-300",

    glow:
      "bg-cyan-400/[0.035]",
  },

  red: {
    bar:
      "bg-red-400",

    value:
      "text-red-300",

    glow:
      "bg-red-400/[0.035]",
  },

  amber: {
    bar:
      "bg-amber-400",

    value:
      "text-amber-300",

    glow:
      "bg-amber-400/[0.035]",
  },

  violet: {
    bar:
      "bg-violet-400",

    value:
      "text-violet-300",

    glow:
      "bg-violet-400/[0.035]",
  },
};


function EmployeeKpiCard({
  label,
  value,
  description,
  accent,
}: EmployeeKpiCardProps) {
  const styles =
    ACCENT_STYLES[
      accent
    ];

  return (
    <article
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-800
        bg-[#101826]/85
        p-5
        shadow-[0_12px_35px_rgba(0,0,0,0.12)]
        transition-all
        duration-300
        hover:-translate-y-0.5
        hover:border-slate-700
        hover:bg-[#121c2b]
        hover:shadow-[0_18px_42px_rgba(0,0,0,0.18)]
      "
    >
      <div
        className={[
          "absolute",
          "left-0 top-0",
          "h-full w-[2px]",
          "opacity-80",
          styles.bar,
        ].join(
          " ",
        )}
      />

      <div
        className={[
          "pointer-events-none",
          "absolute",
          "-right-14 -top-16",
          "h-36 w-36",
          "rounded-full",
          "blur-[70px]",
          "transition-opacity",
          "duration-300",
          "opacity-50",
          "group-hover:opacity-100",
          styles.glow,
        ].join(
          " ",
        )}
      />

      <p
        className="
          relative
          text-[10px]
          font-semibold
          uppercase
          tracking-[0.16em]
          text-slate-600
        "
      >
        {label}
      </p>

      <p
        className={[
          "relative",
          "mt-3",
          "text-3xl",
          "font-semibold",
          "tracking-tight",
          styles.value,
        ].join(
          " ",
        )}
      >
        {value}
      </p>

      <p
        className="
          relative
          mt-2
          text-xs
          leading-5
          text-slate-600
        "
      >
        {description}
      </p>
    </article>
  );
}


export default EmployeeKpiCard;
