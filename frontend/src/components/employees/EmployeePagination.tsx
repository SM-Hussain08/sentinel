interface EmployeePaginationProps {
  currentPage: number;

  totalPages: number;

  showingFrom: number;
  showingTo: number;

  totalResults: number;

  hasPrevious: boolean;
  hasNext: boolean;

  onPrevious: () => void;
  onNext: () => void;
}


function EmployeePagination({
  currentPage,
  totalPages,
  showingFrom,
  showingTo,
  totalResults,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: EmployeePaginationProps) {
  return (
    <div
      className="
        flex
        flex-col
        gap-3
        rounded-2xl
        border
        border-slate-800
        bg-[#0d1521]/70
        px-4 py-3
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <p
        className="
          text-xs
          text-slate-600
        "
      >
        Showing{" "}
        <span
          className="
            font-mono
            text-slate-400
          "
        >
          {showingFrom}
          {"–"}
          {showingTo}
        </span>
        {" of "}
        <span
          className="
            font-mono
            text-slate-400
          "
        >
          {totalResults}
        </span>
        {" employees"}
      </p>

      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <button
          type="button"
          disabled={
            !hasPrevious
          }
          onClick={
            onPrevious
          }
          className="
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
            disabled:cursor-not-allowed
            disabled:opacity-35
            disabled:hover:border-slate-800
            disabled:hover:bg-slate-950/40
            disabled:hover:text-slate-400
          "
        >
          ← Previous
        </button>

        <span
          className="
            min-w-[100px]
            text-center
            font-mono
            text-[10px]
            text-slate-600
          "
        >
          Page{" "}
          <span
            className="
              text-slate-300
            "
          >
            {currentPage}
          </span>
          {" of "}
          <span
            className="
              text-slate-300
            "
          >
            {Math.max(
              totalPages,
              1,
            )}
          </span>
        </span>

        <button
          type="button"
          disabled={
            !hasNext
          }
          onClick={
            onNext
          }
          className="
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
            disabled:cursor-not-allowed
            disabled:opacity-35
            disabled:hover:border-slate-800
            disabled:hover:bg-slate-950/40
            disabled:hover:text-slate-400
          "
        >
          Next →
        </button>
      </div>
    </div>
  );
}


export default EmployeePagination;
