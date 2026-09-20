interface EmployeePageHeaderProps {
  refreshLabel: string;

  isRefreshing: boolean;

  onRefresh: () => void;
}


function EmployeePageHeader({
  refreshLabel,
  isRefreshing,
  onRefresh,
}: EmployeePageHeaderProps) {
  return (
    <header
      className="
        flex flex-col
        gap-6
        lg:flex-row
        lg:items-end
        lg:justify-between
      "
    >
      <div>
        <div
          className="
            flex items-center
            gap-2
            text-[11px]
            font-semibold
            uppercase
            tracking-[0.18em]
            text-cyan-400
          "
        >
          <span
            className="
              h-2 w-2
              rounded-full
              bg-cyan-400
              shadow-[0_0_12px_rgba(34,211,238,0.75)]
            "
          />

          Identity Intelligence
        </div>

        <h1
          className="
            mt-4
            text-3xl
            font-semibold
            tracking-tight
            text-white
            sm:text-4xl
          "
        >
          Employee Security
        </h1>

        <p
          className="
            mt-3
            max-w-4xl
            text-sm
            leading-6
            text-slate-500
            sm:text-base
          "
        >
          Monitor workforce identities,
          behavioral baselines and current
          security exposure across the
          SENTINEL environment.
        </p>
      </div>

      <div
        className="
          flex
          flex-col
          items-start
          gap-2
          sm:flex-row
          sm:items-center
          lg:justify-end
        "
      >
        <span
          className="
            rounded-xl
            border
            border-slate-800
            bg-[#0b111c]
            px-3 py-2.5
            text-[10px]
            font-medium
            text-slate-500
          "
        >
          {refreshLabel}
        </span>


        <button
          type="button"
          disabled={
            isRefreshing
          }
          onClick={
            onRefresh
          }
          className="
            rounded-xl
            border
            border-slate-700/70
            bg-[#121a28]
            px-4 py-2.5
            text-xs
            font-medium
            text-slate-300
            shadow-lg
            transition-all
            duration-200
            hover:-translate-y-0.5
            hover:border-cyan-800/70
            hover:bg-cyan-950/20
            hover:text-cyan-300
            disabled:cursor-wait
            disabled:opacity-60
          "
        >
          {isRefreshing
            ? "Refreshing..."
            : "Refresh Employees"}
        </button>
      </div>
    </header>
  );
}


export default EmployeePageHeader;
