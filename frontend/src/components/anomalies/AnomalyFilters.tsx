export type AnomalyRiskFilter =
  | "ALL"
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";


interface AnomalyFiltersProps {
  riskFilter:
    AnomalyRiskFilter;

  searchQuery:
    string;

  riskCounts:
    Record<
      AnomalyRiskFilter,
      number
    >;

  onRiskChange: (
    risk:
      AnomalyRiskFilter,
  ) => void;

  onSearchQueryChange: (
    value:
      string,
  ) => void;

  onSearch:
    () => void;
}


const RISK_FILTERS:
  AnomalyRiskFilter[] = [
    "ALL",
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
  ];


function AnomalyFilters({
  riskFilter,
  searchQuery,
  riskCounts,
  onRiskChange,
  onSearchQueryChange,
  onSearch,
}: AnomalyFiltersProps) {
  return (
    <section
      className="
        flex flex-col
        gap-3
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
        p-4
        lg:flex-row
        lg:items-center
        lg:justify-between
      "
    >
      <div
        className="
          flex
          flex-wrap
          gap-2
        "
      >
        {RISK_FILTERS.map(
          (risk) => {
            const active =
              riskFilter
              === risk;

            return (
              <button
                key={
                  risk
                }
                type="button"
                aria-label={
                  `${risk} risk filter`
                }
                aria-pressed={
                  active
                }
                onClick={() => {
                  onRiskChange(
                    risk,
                  );
                }}
                className={[
                  "rounded-lg",
                  "border",
                  "px-3 py-2",
                  "text-[10px]",
                  "font-semibold",
                  "tracking-[0.11em]",
                  "transition-all",
                  "duration-200",

                  active
                    ? (
                        "border-cyan-800/70 "
                        + "bg-cyan-950/30 "
                        + "text-cyan-300 "
                        + "shadow-[0_0_18px_rgba(34,211,238,0.04)]"
                      )
                    : (
                        "border-slate-800 "
                        + "bg-[#0b111c] "
                        + "text-slate-500 "
                        + "hover:-translate-y-0.5 "
                        + "hover:border-slate-700 "
                        + "hover:text-slate-300"
                      ),
                ].join(
                  " ",
                )}
              >
                {risk}

                <span
                  className="
                    ml-1
                    text-slate-600
                  "
                >
                  {
                    riskCounts[
                      risk
                    ]
                  }
                </span>
              </button>
            );
          },
        )}
      </div>


      <div
        className="
          flex
          w-full
          gap-2
          lg:max-w-sm
        "
      >
        <div
          className="
            relative
            min-w-0
            flex-1
          "
        >
          <span
            className="
              pointer-events-none
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-xs
              text-slate-600
            "
          >
            ⌕
          </span>

          <input
            type="search"
            aria-label="Search anomalies"
            value={
              searchQuery
            }
            onChange={(
              event,
            ) => {
              onSearchQueryChange(
                event.target.value,
              );
            }}
            onKeyDown={(
              event,
            ) => {
              if (
                event.key
                === "Enter"
              ) {
                onSearch();
              }
            }}
            placeholder="Search all anomalies..."
            className="
              w-full
              rounded-xl
              border
              border-slate-800
              bg-[#0b111c]
              py-2.5
              pl-9 pr-3
              text-xs
              text-slate-200
              outline-none
              transition-all
              placeholder:text-slate-700
              focus:border-cyan-900
              focus:ring-2
              focus:ring-cyan-950/40
            "
          />
        </div>

        <button
          type="button"
          onClick={
            onSearch
          }
          className="
            rounded-xl
            border
            border-cyan-900/60
            bg-cyan-950/20
            px-4 py-2.5
            text-xs
            font-medium
            text-cyan-300
            transition-all
            duration-200
            hover:-translate-y-0.5
            hover:bg-cyan-950/35
          "
        >
          Search
        </button>
      </div>
    </section>
  );
}


export default AnomalyFilters;