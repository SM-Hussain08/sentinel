interface EmployeeDetailHeaderProps {
  refreshLabel: string;

  isRefreshing: boolean;

  onBack: () => void;
  onRefresh: () => void;
}


function EmployeeDetailHeader({
  refreshLabel,
  isRefreshing,
  onBack,
  onRefresh,
}: EmployeeDetailHeaderProps) {
  return (
    <header>
      <button
        type="button"
        onClick={
          onBack
        }
        className="
          inline-flex
          items-center
          gap-2
          rounded-lg
          border
          border-slate-800
          bg-slate-950/40
          px-3 py-2
          text-xs
          text-slate-400
          transition-all
          duration-200
          hover:border-cyan-900/70
          hover:bg-cyan-950/20
          hover:text-cyan-300
        "
      >
        <span>
          ←
        </span>

        Back to Employees
      </button>

      <div
        className="
          mt-6
          flex
          flex-col
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

            Identity Investigation
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
            Employee Investigation
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
            Review identity context,
            behavioral baselines,
            anomaly signals, correlated
            incidents and recent security
            activity.
          </p>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-3
          "
        >
          <div
            className="
              inline-flex
              h-11
              items-center
              gap-2
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]
              px-4
              text-xs
              text-slate-500
            "
          >
            <span
              className="
                h-2 w-2
                rounded-full
                bg-emerald-400
                shadow-[0_0_10px_rgba(52,211,153,0.55)]
              "
            />

            {refreshLabel}
          </div>

          <button
            type="button"
            disabled={
              isRefreshing
            }
            onClick={
              onRefresh
            }
            className="
              inline-flex
              h-11
              items-center
              gap-2
              rounded-xl
              border
              border-slate-700
              bg-[#111a28]
              px-4
              text-xs
              font-semibold
              text-slate-300
              transition-all
              duration-200
              hover:border-cyan-800/70
              hover:bg-cyan-950/25
              hover:text-cyan-200
              disabled:cursor-wait
              disabled:opacity-60
            "
          >
            <span
              className={
                isRefreshing
                  ? "animate-spin"
                  : ""
              }
            >
              ↻
            </span>

            {isRefreshing
              ? "Refreshing"
              : "Refresh Employee"}
          </button>
        </div>
      </div>
    </header>
  );
}


export default EmployeeDetailHeader;
