import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import AnomalyFilters from "./anomalies/AnomalyFilters";
import EmployeeFilters from "./employees/EmployeeFilters";


describe(
  "filter accessibility",
  () => {
    it(
      "exposes employee filter state and form controls programmatically",
      () => {
        render(
          <EmployeeFilters
            searchQuery=""
            department=""
            status="all"
            risk="CRITICAL"
            sort="RISK"
            departments={[
              "Engineering",
              "Finance",
            ]}
            onSearchChange={
              vi.fn()
            }
            onDepartmentChange={
              vi.fn()
            }
            onStatusChange={
              vi.fn()
            }
            onRiskChange={
              vi.fn()
            }
            onSortChange={
              vi.fn()
            }
          />,
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Critical",
            },
          ),
        ).toHaveAttribute(
          "aria-pressed",
          "true",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "High",
            },
          ),
        ).toHaveAttribute(
          "aria-pressed",
          "false",
        );

        expect(
          screen.getByRole(
            "searchbox",
            {
              name:
                "Search employees",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "combobox",
            {
              name:
                "Department",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "combobox",
            {
              name:
                "Employment status",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "combobox",
            {
              name:
                "Sort employees",
            },
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "exposes anomaly risk selection and search programmatically",
      () => {
        render(
          <AnomalyFilters
            riskFilter="HIGH"
            searchQuery=""
            riskCounts={{
              ALL:
                25,

              CRITICAL:
                3,

              HIGH:
                7,

              MEDIUM:
                8,

              LOW:
                7,
            }}
            onRiskChange={
              vi.fn()
            }
            onSearchQueryChange={
              vi.fn()
            }
            onSearch={
              vi.fn()
            }
          />,
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "HIGH risk filter",
            },
          ),
        ).toHaveAttribute(
          "aria-pressed",
          "true",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "LOW risk filter",
            },
          ),
        ).toHaveAttribute(
          "aria-pressed",
          "false",
        );

        expect(
          screen.getByRole(
            "searchbox",
            {
              name:
                "Search anomalies",
            },
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
