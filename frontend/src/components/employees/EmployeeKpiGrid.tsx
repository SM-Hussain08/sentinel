import type {
  EmployeeWorkforceSummary,
} from "../../types/api";

import {
  formatEmployeeNumber,
} from "./employeeFormatters";

import EmployeeKpiCard from "./EmployeeKpiCard";


interface EmployeeKpiGridProps {
  summary:
    EmployeeWorkforceSummary;
}


function EmployeeKpiGrid({
  summary,
}: EmployeeKpiGridProps) {
  return (
    <section
      className="
        grid
        gap-4
        sm:grid-cols-2
        xl:grid-cols-4
      "
    >
      <EmployeeKpiCard
        label="Workforce"
        value={
          formatEmployeeNumber(
            summary.total_employees,
          )
        }
        description={
          `${formatEmployeeNumber(
            summary.scored_employees,
          )} identities currently have selected-model security scoring.`
        }
        accent="cyan"
      />

      <EmployeeKpiCard
        label="Critical Exposure"
        value={
          formatEmployeeNumber(
            summary
              .critical_risk_employees,
          )
        }
        description="Employees whose highest current selected-model risk is critical."
        accent="red"
      />

      <EmployeeKpiCard
        label="Active Cases"
        value={
          formatEmployeeNumber(
            summary
              .employees_with_open_incidents,
          )
        }
        description="Employee identities currently owning at least one open security incident."
        accent="amber"
      />

      <EmployeeKpiCard
        label="Behavioral Signals"
        value={
          formatEmployeeNumber(
            summary
              .elevated_anomaly_count,
          )
        }
        description="Medium, high and critical anomaly signals produced by the selected detector."
        accent="violet"
      />
    </section>
  );
}


export default EmployeeKpiGrid;
