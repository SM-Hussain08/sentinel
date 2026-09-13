interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  helper?: string;
}


function SectionHeader({
  eyebrow,
  title,
  helper,
}: SectionHeaderProps) {
  return (
    <div>
      <p
        className="
          text-[10px]
          font-medium uppercase
          tracking-[0.17em]
          text-slate-600
        "
      >
        {eyebrow}
      </p>

      <div
        className="
          mt-1.5 flex
          flex-col gap-1
          sm:flex-row
          sm:items-end
          sm:justify-between
        "
      >
        <h2
          className="
            text-lg
            font-semibold
            text-white
          "
        >
          {title}
        </h2>

        {helper && (
          <p
            className="
              text-xs
              text-slate-600
            "
          >
            {helper}
          </p>
        )}
      </div>
    </div>
  );
}


export default SectionHeader;