import type {
  EmployeeRiskFilter,
  EmployeeSortOption,
  EmployeeStatusFilter,
} from "./employeeTypes";


interface EmployeeFiltersProps {
  searchQuery: string;

  department:
    string;

  status:
    EmployeeStatusFilter;

  risk:
    EmployeeRiskFilter;

  sort:
    EmployeeSortOption;

  departments:
    string[];

  onSearchChange: (
    value: string,
  ) => void;

  onDepartmentChange: (
    value: string,
  ) => void;

  onStatusChange: (
    value:
      EmployeeStatusFilter,
  ) => void;

  onRiskChange: (
    value:
      EmployeeRiskFilter,
  ) => void;

  onSortChange: (
    value:
      EmployeeSortOption,
  ) => void;
}


const RISK_FILTERS:
Array<{
  label: string;
  value:
    EmployeeRiskFilter;
}> = [
  {
    label: "All",
    value: "ALL",
  },
  {
    label: "Critical",
    value: "CRITICAL",
  },
  {
    label: "High",
    value: "HIGH",
  },
  {
    label: "Medium",
    value: "MEDIUM",
  },
  {
    label: "Low",
    value: "LOW",
  },
  {
    label: "Normal",
    value: "NORMAL",
  },
];


const RISK_ACTIVE_STYLES:
Record<
  EmployeeRiskFilter,
  string
> = {
  ALL:
    "border-cyan-800/70 bg-cyan-950/35 text-cyan-300",

  CRITICAL:
    "border-red-800/70 bg-red-950/35 text-red-300",

  HIGH:
    "border-orange-800/65 bg-orange-950/30 text-orange-300",

  MEDIUM:
    "border-amber-800/60 bg-amber-950/25 text-amber-300",

  LOW:
    "border-sky-800/60 bg-sky-950/25 text-sky-300",

  NORMAL:
    "border-emerald-900/60 bg-emerald-950/20 text-emerald-300",
};


function EmployeeFilters({
  searchQuery,
  department,
  status,
  risk,
  sort,
  departments,
  onSearchChange,
  onDepartmentChange,
  onStatusChange,
  onRiskChange,
  onSortChange,
}: EmployeeFiltersProps) {
  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-800
        bg-[#0d1521]/80
      "
    >
      <div
        className="
          flex
          flex-wrap
          items-center
          gap-2
          border-b
          border-slate-800
          px-4 py-3
        "
      >
        {RISK_FILTERS.map(
          (option) => (
            <button
              key={
                option.value
              }
              type="button"
              onClick={() => {
                onRiskChange(
                  option.value,
                );
              }}
              className={[
                "rounded-lg",
                "border",
                "px-3 py-1.5",
                "text-[10px]",
                "font-semibold",
                "uppercase",
                "tracking-[0.1em]",
                "transition-all",
                "duration-200",

                risk
                  === option.value
                  ? RISK_ACTIVE_STYLES[
                      option.value
                    ]
                  : (
                      "border-slate-800 "
                      + "bg-slate-950/30 "
                      + "text-slate-600 "
                      + "hover:border-slate-700 "
                      + "hover:bg-slate-900 "
                      + "hover:text-slate-300"
                    ),
              ].join(
                " ",
              )}
            >
              {option.label}
            </button>
          ),
        )}
      </div>

      <div
        className="
          grid
          gap-3
          p-4
          xl:grid-cols-[minmax(280px,1fr)_210px_170px_210px]
        "
      >
        <label
          className="
            relative
            block
          "
        >
          <span
            className="
              pointer-events-none
              absolute
              left-3.5
              top-1/2
              -translate-y-1/2
              text-sm
              text-slate-600
            "
          >
            ⌕
          </span>

          <input
            type="search"
            value={
              searchQuery
            }
            onChange={
              (event) => {
                onSearchChange(
                  event.target.value,
                );
              }
            }
            placeholder="Search employee, ID, role or department..."
            className="
              h-11
              w-full
              rounded-xl
              border
              border-slate-800
              bg-[#080e17]
              pl-10 pr-4
              text-sm
              text-slate-200
              outline-none
              transition-all
              duration-200
              placeholder:text-slate-700
              focus:border-cyan-900
              focus:ring-2
              focus:ring-cyan-950/40
            "
          />
        </label>

        <select
          value={
            department
          }
          onChange={
            (event) => {
              onDepartmentChange(
                event.target.value,
              );
            }
          }
          className="
            h-11
            rounded-xl
            border
            border-slate-800
            bg-[#080e17]
            px-3
            text-xs
            text-slate-400
            outline-none
            transition-all
            hover:border-slate-700
            focus:border-cyan-900
          "
        >
          <option value="">
            All Departments
          </option>

          {departments.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ),
          )}
        </select>

        <select
          value={
            status
          }
          onChange={
            (event) => {
              onStatusChange(
                event.target.value as EmployeeStatusFilter,
              );
            }
          }
          className="
            h-11
            rounded-xl
            border
            border-slate-800
            bg-[#080e17]
            px-3
            text-xs
            text-slate-400
            outline-none
            transition-all
            hover:border-slate-700
            focus:border-cyan-900
          "
        >
          <option value="all">
            All Statuses
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>
        </select>

        <select
          value={
            sort
          }
          onChange={
            (event) => {
              onSortChange(
                event.target.value as EmployeeSortOption,
              );
            }
          }
          className="
            h-11
            rounded-xl
            border
            border-slate-800
            bg-[#080e17]
            px-3
            text-xs
            text-slate-400
            outline-none
            transition-all
            hover:border-slate-700
            focus:border-cyan-900
          "
        >
          <option value="RISK">
            Highest Risk First
          </option>

          <option value="ANOMALIES">
            Most Anomalies
          </option>

          <option value="INCIDENTS">
            Most Incidents
          </option>

          <option value="RECENT">
            Most Recent Activity
          </option>

          <option value="USER_ASC">
            User ID A–Z
          </option>
        </select>
      </div>
    </section>
  );
}


export default EmployeeFilters;
