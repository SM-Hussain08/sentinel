import type {
  EmployeeDirectoryItem,
} from "../../types/api";

import {
  formatEmployeeNumber,
} from "./employeeFormatters";

import EmployeeDirectoryRow from "./EmployeeDirectoryRow";


interface EmployeeDirectoryProps {
  employees:
    EmployeeDirectoryItem[];

  totalResults: number;

  showingFrom: number;
  showingTo: number;

  isLoading: boolean;

  onOpenEmployee: (
    userId: string,
  ) => void;
}


function EmployeeDirectory({
  employees,
  totalResults,
  showingFrom,
  showingTo,
  isLoading,
  onOpenEmployee,
}: EmployeeDirectoryProps) {
  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-800
        bg-[#101826]/88
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-slate-800
          px-5 py-4
          sm:flex-row
          sm:items-end
          sm:justify-between
        "
      >
        <div>
          <p
            className="
              text-[10px]
              uppercase
              tracking-[0.17em]
              text-slate-600
            "
          >
            Identity Exposure
          </p>

          <h2
            className="
              mt-1
              text-lg
              font-semibold
              text-white
            "
          >
            Employee Directory
          </h2>

          <p
            className="
              mt-1
              text-xs
              text-slate-600
            "
          >
            Analyst-facing workforce
            identities ranked by current
            security context.
          </p>
        </div>

        <div
          className="
            flex
            items-center
            gap-2
            text-[10px]
            text-slate-600
          "
        >
          <span>
            Showing
          </span>

          <span
            className="
              rounded-lg
              border
              border-slate-800
              bg-[#0b111c]
              px-2.5 py-1.5
              font-mono
              text-slate-400
            "
          >
            {showingFrom}
            {"–"}
            {showingTo}
            {" of "}
            {formatEmployeeNumber(
              totalResults,
            )}
          </span>
        </div>
      </div>

      <div
        className="
          max-h-[720px]
          overflow-y-auto
          overscroll-contain
          [scrollbar-color:#1e293b_#0b111c]
          [scrollbar-width:thin]
        "
      >
        {isLoading ? (
          <div
            className="
              px-6 py-16
              text-center
            "
          >
            <div
              className="
                mx-auto
                h-6 w-6
                animate-spin
                rounded-full
                border-2
                border-slate-800
                border-t-cyan-400
              "
            />

            <p
              className="
                mt-4
                text-xs
                text-slate-600
              "
            >
              Loading employee
              intelligence...
            </p>
          </div>
        ) : employees.length
          === 0 ? (
            <div
              className="
                px-6 py-16
                text-center
              "
            >
              <div
                className="
                  mx-auto
                  flex h-11 w-11
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-800
                  bg-[#0b111c]
                  text-slate-600
                "
              >
                ◌
              </div>

              <p
                className="
                  mt-4
                  text-sm
                  font-medium
                  text-slate-400
                "
              >
                No employees found
              </p>

              <p
                className="
                  mx-auto
                  mt-1
                  max-w-md
                  text-xs
                  leading-5
                  text-slate-600
                "
              >
                No employee identities
                match the current search
                and security filters.
              </p>
            </div>
          ) : (
            employees.map(
              (employee) => (
                <EmployeeDirectoryRow
                  key={
                    employee.id
                  }
                  employee={
                    employee
                  }
                  onOpen={
                    onOpenEmployee
                  }
                />
              ),
            )
          )}
      </div>
    </section>
  );
}


export default EmployeeDirectory;
